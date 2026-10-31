import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdminMail } from './entities/admin-mail.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { AppLoggerService } from '../common/logging/app-logger.service';
import {
  AdminMailService, CONSIGNES_VERSION, OBJET, Signataire, composer, langueDe, mettreEnPage, prenomLisible, versionTexte,
} from './admin-mail.service';

/** Une heure : une demande partie à 24 h 50 au lieu de 24 h ne change rien. */
export const INTERVALLE_MS = 60 * 60 * 1000;
/** Premier passage après le démarrage : laisser l'application s'installer. */
export const PREMIER_PASSAGE_MS = 5 * 60 * 1000;
/** Au plus 20 envois par passage : jamais de rafale, même après une panne. */
export const LOT_MAX = 20;

export interface BilanDePassage { eligibles: number; envoyes: number; echecs: number }

/**
 * La demande de retour part seule, 24 h après la création du compte (chantier
 * `demande-de-retour-automatique`). L'administrateur l'envoyait à la main,
 * compte par compte : 70 comptes sur 75 n'ont aucune activité après leur
 * premier jour, et une demande écrite plusieurs jours plus tard arrivait
 * quand la personne avait oublié ce qu'elle cherchait.
 *
 * Aucun appel au modèle : le gabarit fixe, traduit, signé de
 * `FEEDBACK_SIGNATAIRE`. Rien ne part sans relecture humaine qui n'ait été
 * écrit par un humain.
 *
 * Une minuterie horaire, comme les purges quotidiennes : un seul conteneur.
 * Le verrou est la ligne elle-même (`demandeRetourAt`), posé AVANT l'envoi.
 */
@Injectable()
export class DemandeDeRetourService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemandeDeRetourService.name);
  private premier?: NodeJS.Timeout;
  private minuterie?: NodeJS.Timeout;
  private enCours = false;

  constructor(
    @InjectRepository(AdminMail) private readonly mails: Repository<AdminMail>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
    private readonly adminMail: AdminMailService,
    private readonly events: AppLoggerService,
    private readonly config: ConfigService,
  ) {}

  /** Ce qui manque pour envoyer — sans quoi la minuterie ne démarre pas. */
  configurationManquante(): string[] {
    return ['FEEDBACK_SIGNATAIRE', 'FEEDBACK_LINK_SECRET', 'FEEDBACK_AUTO_DEPUIS'].filter((v) => !this.config.get<string>(v)?.trim());
  }

  onModuleInit(): void {
    const manque = this.configurationManquante();
    if (manque.length) {
      // Mieux vaut aucun envoi qu'une vague rétroactive ou un courriel sans signataire.
      this.logger.warn(`Demande de retour automatique inactive : ${manque.join(', ')} non défini(s)`);
      return;
    }
    this.premier = setTimeout(() => void this.passage(), PREMIER_PASSAGE_MS);
    this.premier.unref();
    this.minuterie = setInterval(() => void this.passage(), INTERVALLE_MS);
    this.minuterie.unref();
  }

  onModuleDestroy(): void {
    if (this.premier) clearTimeout(this.premier);
    if (this.minuterie) clearInterval(this.minuterie);
  }

  /** Le signataire configuré : « Nicolas Riousset » → prénom « Nicolas ». */
  signataire(): Signataire {
    const nomComplet = (this.config.get<string>('FEEDBACK_SIGNATAIRE') ?? '').trim();
    return { nomComplet, prenom: nomComplet.split(/\s+/)[0] ?? nomComplet };
  }

  /**
   * Comptes éligibles, les plus anciens d'abord : adresse, ni admin ni
   * interne, créés depuis la mise en service et il y a plus de 24 h, jamais
   * sollicités (ni automatiquement, ni par un courriel délivré à la main),
   * sans feedback déjà donné, non désinscrits. Les dates se comparent à
   * l'horloge de la base, celle qui a daté `createdAt`.
   */
  async eligibles(limite = LOT_MAX): Promise<User[]> {
    const depuis = this.config.get<string>('FEEDBACK_AUTO_DEPUIS')?.trim();
    if (!depuis) return [];
    return this.users.createQueryBuilder('u')
      .where('u.demandeRetourAt IS NULL')
      .andWhere('u.desinscritRetoursAt IS NULL')
      .andWhere("u.email IS NOT NULL AND u.email <> ''")
      .andWhere('u.isAdmin = false AND u.isInternal = false')
      .andWhere('u.createdAt >= :depuis', { depuis })
      .andWhere('u.createdAt <= NOW() - INTERVAL 24 HOUR')
      .andWhere('NOT EXISTS (SELECT 1 FROM admin_mail m WHERE m.userId = u.id AND m.delivered = 1)')
      .andWhere('NOT EXISTS (SELECT 1 FROM feedback f WHERE f.keycloakId = u.keycloakId)')
      .orderBy('u.createdAt', 'ASC')
      .limit(limite)
      .getMany();
  }

  /** Un passage : sélection, réservation, envoi. Ne lève jamais. */
  async passage(): Promise<BilanDePassage> {
    const bilan: BilanDePassage = { eligibles: 0, envoyes: 0, echecs: 0 };
    if (this.enCours || this.configurationManquante().length) return bilan;
    this.enCours = true;
    try {
      const comptes = await this.eligibles();
      bilan.eligibles = comptes.length;
      for (const user of comptes) {
        const resultat = await this.envoyer(user);
        if (resultat === 'envoye') bilan.envoyes++;
        else if (resultat === 'echec') bilan.echecs++;
      }
    } catch (e) {
      this.logger.error(`Passage de la demande de retour interrompu : ${e instanceof Error ? e.message : e}`);
    } finally {
      this.enCours = false;
      this.events.event('demande_retour_passage', { ...bilan });
    }
    return bilan;
  }

  /**
   * Réserve, compose, envoie, note. La réservation passe par la ligne : deux
   * passages qui se croisent ne peuvent pas envoyer deux fois. Un échec SMTP
   * laisse la réservation posée — pas de nouvel essai en boucle ; l'échec se
   * lit dans l'historique, d'où l'administrateur peut écrire à la main.
   */
  async envoyer(user: User): Promise<'envoye' | 'echec' | 'deja'> {
    const reserve = await this.users.createQueryBuilder()
      .update(User)
      .set({ demandeRetourAt: () => 'NOW()' })
      .where('id = :id AND demandeRetourAt IS NULL', { id: user.id })
      .execute();
    if (!reserve.affected) return 'deja';

    const langue = langueDe(user.locale) ?? langueDe(user.langueInscription) ?? 'fr';
    const liens = this.adminMail.liens(user.keycloakId, true);
    const body = composer(langue, prenomLisible(user.firstName), null, this.signataire(), liens);
    const subject = OBJET[langue] ?? OBJET.fr;
    const desinscription = this.adminMail.enteteDesinscription(user.keycloakId);
    const delivered = await this.mail.send({
      to: user.email!,
      subject,
      html: mettreEnPage(body),
      text: versionTexte(body),
      fromName: 'Namorama',
      ...(desinscription ? {
        headers: { 'List-Unsubscribe': `<${desinscription}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      } : {}),
    });

    try {
      await this.mails.save(this.mails.create({
        userId: user.id,
        keycloakId: user.keycloakId,
        adminSub: null,
        subject,
        body,
        aiDrafted: false,
        promptVersion: CONSIGNES_VERSION,
        delivered,
        automatique: true,
      }));
    } catch (e) {
      // L'envoi a eu lieu (ou non) : la trace manquante ne doit pas le refaire.
      this.logger.error(`Demande de retour envoyée à ${user.id} sans trace en base : ${e instanceof Error ? e.message : e}`);
    }
    this.events.event('feedback_request_sent', { userId: user.keycloakId, delivered, langue });
    if (!delivered) this.logger.error(`Demande de retour automatique non délivrée (compte ${user.id})`);
    return delivered ? 'envoye' : 'echec';
  }
}
