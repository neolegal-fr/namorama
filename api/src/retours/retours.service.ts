import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { verifierLien } from './liens-de-retour';

/** Ce que rapporte la réponse en un clic, oui comme non (décision du 31/10/2026). */
export const CREDITS_UTILITE = 100;

export interface ReponseUtilite {
  /** La réponse vient d'être enregistrée par CE clic. */
  enregistree: boolean;
  /** Le compte avait déjà répondu : rien n'a changé. */
  dejaRepondu: boolean;
  /** La réponse gardée — la première, si le compte clique deux fois. */
  reponse: 'oui' | 'non';
  /** Crédits accordés par ce clic : 100 la première fois, 0 ensuite. */
  credits: number;
}

/**
 * Réponses aux liens des demandes de retour (chantier
 * `demande-de-retour-automatique`). Sans connexion : le lien signé désigne le
 * compte. Appelées par la page du front une fois exécutée, jamais au simple
 * GET du lien — les antivirus de messagerie suivent les liens.
 */
@Injectable()
export class RetoursService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: AppLoggerService,
    private readonly config: ConfigService,
  ) {}

  private lire(jeton: unknown) {
    const lu = verifierLien(this.config.get<string>('FEEDBACK_LINK_SECRET') ?? '', jeton);
    if (!lu) throw new BadRequestException('Ce lien n\'est pas valide, ou a expiré.');
    return lu;
  }

  /**
   * Enregistre « oui » ou « non » et accorde 100 crédits, une seule fois par
   * compte : la réponse et les crédits partent dans la même transaction, et
   * c'est la première réponse (`utiliteAt IS NULL`) qui sert de verrou.
   */
  async repondre(jeton: unknown): Promise<ReponseUtilite> {
    const { keycloakId, action } = this.lire(jeton);
    if (action !== 'oui' && action !== 'non') throw new BadRequestException('Ce lien n\'est pas valide, ou a expiré.');

    return this.dataSource.transaction(async (manager) => {
      const pose = await manager.createQueryBuilder()
        .update(User)
        .set({ utilite: action, utiliteAt: () => 'NOW()' })
        .where('keycloakId = :keycloakId AND utiliteAt IS NULL', { keycloakId })
        .execute();
      const user = await manager.findOne(User, { where: { keycloakId } });
      if (!user) throw new BadRequestException('Ce lien n\'est pas valide, ou a expiré.');

      if (!pose.affected) {
        return { enregistree: false, dejaRepondu: true, reponse: user.utilite ?? action, credits: 0 };
      }
      await manager.increment(User, { keycloakId }, 'extraCredits', CREDITS_UTILITE);
      const delaiDepuisEnvoiS = user.demandeRetourAt && user.utiliteAt
        ? Math.round((new Date(user.utiliteAt).getTime() - new Date(user.demandeRetourAt).getTime()) / 1000)
        : null;
      // Un délai de quelques secondes signale un analyseur qui exécute la page.
      this.events.event('feedback_utility_answered', { userId: keycloakId, reponse: action, delaiDepuisEnvoiS });
      return { enregistree: true, dejaRepondu: false, reponse: action, credits: CREDITS_UTILITE };
    });
  }

  /** Désinscrit des demandes de retour, automatiques et manuelles. Idempotent. */
  async desinscrire(jeton: unknown): Promise<{ desinscrit: true }> {
    const { keycloakId, action } = this.lire(jeton);
    if (action !== 'desinscription') throw new BadRequestException('Ce lien n\'est pas valide, ou a expiré.');
    const res = await this.dataSource.createQueryBuilder()
      .update(User)
      .set({ desinscritRetoursAt: () => 'NOW()' })
      .where('keycloakId = :keycloakId AND desinscritRetoursAt IS NULL', { keycloakId })
      .execute();
    if (res.affected) this.events.event('feedback_unsubscribed', { userId: keycloakId });
    return { desinscrit: true };
  }
}
