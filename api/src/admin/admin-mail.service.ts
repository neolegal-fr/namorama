import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import OpenAI from 'openai';
import { AdminMail } from './entities/admin-mail.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { FeedbackService } from '../feedback/feedback.service';
import { ModelUsageService } from '../common/model-usage/model-usage.service';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { jourISO } from './predicats';

/**
 * Version des consignes de rédaction. À CHANGER à chaque modification du
 * prompt : chaque envoi la garde, et c'est ce qui dit, après coup, à qui
 * l'ancienne version a écrit.
 */
export const CONSIGNES_VERSION = '2026-09-25';

/** Ce que le modèle sait du destinataire — et rien de plus. */
export interface ContexteDestinataire {
  prenom: string | null;
  langue: string;
  inscritLe: string;
  derniereActivite: string | null;
  creditsDisponibles: number;
  projets: {
    nom: string;
    description: string;
    creeLe: string;
    nomsProposes: number;
    nomsAimes: string[];
    nomsEcartes: number;
  }[];
  rapportsAchetes: string[];
  /** Retours déjà envoyés par formulaire ou par courriel. */
  retoursDonnes: { le: string; extrait: string }[];
  /** Messages déjà envoyés : ne pas répéter le même angle. */
  dejaEcrit: { le: string; objet: string }[];
}

export interface Liens {
  /** Ouvre le formulaire de retour, après connexion. */
  formulaire: string;
  /** Page d'avis publics — absente tant qu'aucun profil n'est configuré. */
  avis: string | null;
}

export interface Brouillon {
  subject: string;
  body: string;
  promptVersion: string;
  /** Ce que la relecture doit regarder en priorité ; le brouillon reste modifiable. */
  avertissements: string[];
}

const LANGUES: Record<string, string> = {
  fr: 'français', en: 'anglais', de: 'allemand', es: 'espagnol', pt: 'portugais', it: 'italien', nl: 'néerlandais',
};

/** `fr-FR` → `fr` ; inconnue ou absente → `fr`, la langue du produit. */
export function langueDe(locale: string | null | undefined): string {
  const l = (locale ?? '').split('-')[0].toLowerCase();
  return LANGUES[l] ? l : 'fr';
}

const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const URL_HTTPS = /https:\/\/[^\s<>"]+[^\s<>".,;:!?)]/g;

/**
 * Le texte saisi, en HTML volontairement nu.
 *
 * Pas de logo, pas de bouton, pas de pied de page : c'est ce qui distingue un
 * courriel qu'une personne écrit d'une campagne, pour le lecteur comme pour
 * les filtres. Le corps est du TEXTE, jamais du HTML : il est échappé, les
 * lignes vides font les paragraphes et les liens `https://` deviennent
 * cliquables. Un brouillon du modèle passe par là comme le reste.
 */
export function mettreEnPage(texte: string): string {
  const paragraphes = texte
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => echapper(p).replace(URL_HTTPS, (url) => `<a href="${url}">${url}</a>`).replace(/\n/g, '<br>'))
    .map((p) => `<p>${p}</p>`)
    .join('\n');
  return `<!DOCTYPE html>\n<html>\n<body>\n${paragraphes}\n</body>\n</html>`;
}

/**
 * Lit la réponse du modèle. Un brouillon sans objet ou sans corps n'est pas
 * un brouillon : on le refuse plutôt que de pré-remplir un champ vide.
 */
export function lireBrouillon(contenu: string | null | undefined): { subject: string; body: string } | null {
  try {
    const brut = JSON.parse(contenu ?? '') as { objet?: unknown; corps?: unknown };
    const subject = typeof brut.objet === 'string' ? brut.objet.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    const body = typeof brut.corps === 'string' ? brut.corps.trim() : '';
    return subject && body ? { subject, body } : null;
  } catch {
    return null;
  }
}

/**
 * Ce que la relecture doit vérifier, contrôlé mécaniquement : le modèle a
 * reçu les liens et la promesse, rien ne garantit qu'il les ait recopiés.
 * Un lien inventé, surtout, partirait sous le nom de l'administrateur.
 */
export function verifierBrouillon(body: string, liens: Liens): string[] {
  const alertes: string[] = [];
  if (!body.includes(liens.formulaire)) alertes.push('Le lien vers le formulaire de retour manque.');
  if (!/500/.test(body)) alertes.push('Les 500 crédits promis ne sont pas mentionnés.');
  if (liens.avis && !body.includes(liens.avis)) alertes.push("Le lien vers la page d'avis manque.");
  const connus = new Set([liens.formulaire, liens.avis].filter(Boolean));
  const inconnus = (body.match(URL_HTTPS) ?? []).filter((u) => !connus.has(u));
  if (inconnus.length) alertes.push(`Lien(s) non fourni(s) au modèle : ${[...new Set(inconnus)].join(', ')}`);
  return alertes;
}

/**
 * Les consignes. Le but est fixe — obtenir un retour sur un point à
 * améliorer — et la personnalisation n'est pas un ornement : un message qui
 * pourrait partir tel quel à quelqu'un d'autre est un publipostage.
 */
export function consignes(langue: string, signataire: string, liens: Liens): string {
  return [
    `Tu écris, au nom de ${signataire}, qui fait Namorama, un courriel personnel à UN utilisateur.`,
    "Namorama aide à trouver un nom de marque et un domaine disponibles à partir de la description d'un produit ; " +
      'un rapport de marque payant vérifie domaines, réseaux sociaux et dépôts INPI.',
    '',
    "BUT : obtenir un retour honnête sur UN point à améliorer. Pas vendre, pas relancer l'usage.",
    '',
    'OUVERTURE : présente-toi en une phrase (qui tu es, pourquoi tu écris à cette personne en particulier). ' +
      "Ne commence JAMAIS par « J'ai vu que », « J'ai remarqué », « I noticed » ou une formule équivalente : " +
      'on ne doit pas se sentir observé. Varie la construction d’un message à l’autre.',
    '',
    'PERSONNALISATION — le message ne doit pouvoir être envoyé à personne d’autre :',
    "- Appuie-toi sur un ou deux éléments concrets de son activité (un projet par son nom, un nom qu'il a aimé, " +
      'un rapport acheté), cités naturellement. Pas de statistiques, pas d’énumération : il ne doit pas se sentir épié.',
    "- Pose une ou deux questions ouvertes adaptées à l'endroit où il s'est arrêté : aucun projet → ce qui a bloqué ; " +
      "des noms proposés mais aucun aimé → pourquoi ils ne convenaient pas ; des noms aimés sans rapport → ce qui " +
      "manquait pour aller plus loin ; un rapport acheté → s'il lui a servi, ce qui manquait.",
    "- S'il a déjà donné un retour, remercie-le de celui-ci et demande ce qui manque encore, sans le redemander à l'identique.",
    "- Si on lui a déjà écrit, ne reprends pas le même angle.",
    "- N'invente aucun fait. N'utilise que ce qui figure dans le compte.",
    '',
    'CE QUE LE MESSAGE DOIT DIRE :',
    `- Deux façons de répondre : répondre directement à ce courriel, ou le formulaire : ${liens.formulaire}`,
    '- Comme annoncé sur le site, un retour lui vaut jusqu’à 500 crédits offerts, ajoutés après lecture de son message. ' +
      'Dis-le simplement, une fois, sans en faire l’argument principal.',
    "- Ces retours servent directement à améliorer le produit et à en faire un outil vraiment utile.",
    ...(liens.avis
      ? [
          `- En dernière ligne avant la signature, une phrase facultative : s'il souhaite partager son expérience publiquement, ` +
            `quelle qu'elle soit, il peut le faire ici : ${liens.avis} — sans rapport avec les crédits, en quelques mots.`,
        ]
      : []),
    '',
    'FORME :',
    `- En ${LANGUES[langue]}, vouvoiement. 80 à 140 mots.`,
    '- Le ton d’une personne qui écrit à une autre : simple, direct, chaleureux. Aucune formule publicitaire, aucun emoji, ' +
      "pas de points d'exclamation en série, pas de « cher utilisateur ».",
    '- Objet court et personnel, qui ne ressemble pas à une newsletter (ni majuscules, ni « offre », ni « gratuit »).',
    `- Signature : « ${signataire} » seul sur sa ligne, puis « Namorama ».`,
    '- Recopie les liens à l’identique, et n’en ajoute aucun autre.',
    "- Ne cite jamais de coût, de modèle d'IA ou d'information technique interne.",
    '- Texte brut : paragraphes séparés par une ligne vide, pas de Markdown, pas de HTML.',
    '',
    'Réponds uniquement en JSON : {"objet": "...", "corps": "..."}.',
  ].join('\n');
}

const raccourcir = (s: string | null | undefined, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * Écrire à un utilisateur pour lui demander un retour, un à la fois.
 *
 * Le modèle propose, l'administrateur dispose : le brouillon revient dans le
 * formulaire pour être relu, et l'envoi est une seconde requête, avec le
 * texte validé. Rien ne part automatiquement.
 */
@Injectable()
export class AdminMailService {
  private readonly logger = new Logger(AdminMailService.name);
  /** Absent sans clé : la rédaction assistée est indisponible, l'envoi reste possible. */
  private readonly openai?: OpenAI;
  private readonly model: string;

  constructor(
    @InjectRepository(AdminMail) private readonly repo: Repository<AdminMail>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
    private readonly feedback: FeedbackService,
    private readonly usage: ModelUsageService,
    private readonly events: AppLoggerService,
    private readonly config: ConfigService,
  ) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : undefined;
    // Un courriel se lit : le modèle créatif, à un appel par brouillon.
    this.model = config.get<string>('OPENAI_MODEL_CREATIVE') ?? config.get<string>('OPENAI_MODEL') ?? 'gpt-5.6-luna';
  }

  liens(): Liens {
    const site = this.config.get<string>('FRONTEND_URL', 'https://namorama.com').replace(/\/+$/, '');
    return {
      formulaire: `${site}/app?avis=1`,
      avis: this.config.get<string>('REVIEW_URL')?.trim() || null,
    };
  }

  /** Les envois passés à ce compte, du plus récent au plus ancien. */
  async historique(userId: number): Promise<AdminMail[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
  }

  async contexte(userId: number): Promise<ContexteDestinataire> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const [projets, aimes, rapports, retours, envois] = await Promise.all([
      this.dataSource.query(
        `SELECT p.id, p.name, p.description, p.createdAt,
                COUNT(ds.id) AS proposes, COALESCE(SUM(ds.rating = 'disliked'), 0) AS ecartes
           FROM project p LEFT JOIN domain_suggestion ds ON ds.projectId = p.id
          WHERE p.userId = ?
          GROUP BY p.id ORDER BY p.createdAt DESC LIMIT 5`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT ds.projectId, ds.domainName FROM domain_suggestion ds INNER JOIN project p ON p.id = ds.projectId
          WHERE p.userId = ? AND ds.rating = 'liked' ORDER BY ds.createdAt DESC LIMIT 40`,
        [userId],
      ),
      this.dataSource.query(
        'SELECT name FROM brand_report_record WHERE keycloakId = ? ORDER BY createdAt DESC LIMIT 5',
        [user.keycloakId],
      ),
      this.dataSource.query(
        'SELECT message, createdAt FROM feedback WHERE keycloakId = ? ORDER BY createdAt DESC LIMIT 3',
        [user.keycloakId],
      ),
      this.historique(userId),
    ]);

    const jour = (d: Date | string | null) => (d ? jourISO(new Date(d)) : null);
    return {
      prenom: user.firstName?.trim() || null,
      langue: langueDe(user.locale),
      inscritLe: jour(user.createdAt)!,
      derniereActivite: jour(user.lastLogin),
      creditsDisponibles: user.credits + user.extraCredits,
      projets: projets.map((p: any) => ({
        nom: String(p.name),
        description: raccourcir(p.description, 400),
        creeLe: jour(p.createdAt)!,
        nomsProposes: Number(p.proposes),
        nomsAimes: aimes.filter((a: any) => a.projectId === p.id).slice(0, 8).map((a: any) => String(a.domainName)),
        nomsEcartes: Number(p.ecartes),
      })),
      rapportsAchetes: rapports.map((r: any) => String(r.name)),
      retoursDonnes: retours.map((r: any) => ({ le: jour(r.createdAt)!, extrait: raccourcir(r.message, 300) })),
      dejaEcrit: envois.filter((e) => e.delivered).slice(0, 5).map((e) => ({ le: jour(e.createdAt)!, objet: e.subject })),
    };
  }

  /**
   * Un brouillon rédigé à partir de l'activité du compte. `note` est une
   * consigne facultative de l'administrateur (un angle, un fait à citer) ;
   * elle ne peut pas ajouter de promesse, les consignes l'interdisent.
   */
  async rediger(userId: number, signataire: string, note?: string): Promise<Brouillon> {
    if (!this.openai) throw new ServiceUnavailableException('Rédaction assistée indisponible : OPENAI_API_KEY absente');
    const ctx = await this.contexte(userId);
    const liens = this.liens();
    const demande = [
      note ? `Consigne de ${signataire} pour ce message : ${note}\n` : '',
      `Compte :\n${JSON.stringify(ctx, null, 2)}`,
    ].join('');
    const appel = this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: consignes(ctx.langue, signataire, liens) },
        { role: 'user', content: demande },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 900,
      reasoning_effort: 'none',
    });
    const res = await this.usage.mesurer('admin_mail_draft', appel);
    const brouillon = lireBrouillon(res.choices[0]?.message?.content);
    if (!brouillon) throw new ServiceUnavailableException('Le modèle a rendu un brouillon inutilisable');
    return { ...brouillon, promptVersion: CONSIGNES_VERSION, avertissements: verifierBrouillon(brouillon.body, liens) };
  }

  /**
   * Envoie le message relu, sous le nom de l'administrateur, réponses vers
   * son adresse. Tracé même en échec : une tentative ratée dit qu'il reste
   * quelque chose à faire, et ne se confond pas avec « jamais écrit ».
   */
  async envoyer(
    userId: number,
    admin: { sub: string; nom: string },
    message: { subject: string; body: string; promptVersion: string | null },
  ): Promise<AdminMail> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (!user.email) throw new BadRequestException("Ce compte n'a pas d'adresse e-mail");

    const subject = message.subject.replace(/\s+/g, ' ').trim();
    const body = message.body.trim();
    if (!subject || !body) throw new BadRequestException('Objet et message sont requis');

    const delivered = await this.mail.send({
      to: user.email,
      subject,
      html: mettreEnPage(body),
      text: body,
      fromName: `${admin.nom} — Namorama`,
      replyTo: this.config.get<string>('ADMIN_MAIL_REPLY_TO', 'nicolas@namorama.com'),
    });

    const envoi = await this.repo.save(this.repo.create({
      userId,
      keycloakId: user.keycloakId,
      adminSub: admin.sub,
      subject,
      body,
      aiDrafted: message.promptVersion !== null,
      promptVersion: message.promptVersion,
      delivered,
      feedbackId: null,
    }));
    // Le `sub` seul : ni adresse, ni contenu dans les logs.
    this.events.event('admin_mail_sent', { sub: user.keycloakId, delivered, promptVersion: message.promptVersion });
    if (!delivered) this.logger.warn(`Courriel admin non remis au compte ${userId}`);
    return envoi;
  }

  /**
   * La réponse reçue par courriel devient un feedback, à valider comme les
   * autres dans l'onglet Feedbacks — c'est là que les crédits se versent.
   */
  async enregistrerReponse(mailId: number, message: string): Promise<AdminMail> {
    const envoi = await this.repo.findOne({ where: { id: mailId } });
    if (!envoi) throw new NotFoundException(`Mail ${mailId} not found`);
    if (envoi.feedbackId) throw new BadRequestException('Réponse déjà enregistrée pour ce courriel');
    const user = await this.users.findOne({ where: { id: envoi.userId } });
    const fb = await this.feedback.recordEmailReply(envoi.keycloakId, user?.email ?? null, message);
    envoi.feedbackId = fb.id;
    await this.repo.save(envoi);
    this.events.event('admin_mail_reply_recorded', { sub: envoi.keycloakId });
    return envoi;
  }
}
