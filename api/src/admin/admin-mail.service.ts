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
export const CONSIGNES_VERSION = '2026-09-25.3';

/** Ce que le modèle sait du destinataire — et rien de plus. */
export interface ContexteDestinataire {
  prenom: string | null;
  langue: string;
  inscritLe: string;
  derniereActivite: string | null;
  creditsDisponibles: number;
  /**
   * Sans leur nom : il est généré par défaut (`suggest_name`), l'utilisateur
   * ne l'a pas choisi et ne le reconnaîtrait pas dans un courriel.
   */
  projets: {
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
  dejaEcrit: { le: string; extrait: string }[];
}

export interface Liens {
  /** Le site, cité pour rappeler de quoi on parle : un visiteur de quelques minutes a pu l'oublier. */
  site: string;
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

/**
 * L'objet est FIXE, décidé et non généré : il dit d'emblée ce qu'on demande.
 * Le modèle ne rédige plus que le corps.
 */
export const OBJET: Record<string, string> = {
  fr: 'Aidez-nous à améliorer Namorama', en: 'Help us improve Namorama', de: 'Helfen Sie uns, Namorama zu verbessern',
  es: 'Ayúdenos a mejorar Namorama', pt: 'Ajude-nos a melhorar o Namorama', it: 'Ci aiuti a migliorare Namorama',
  nl: 'Help ons Namorama te verbeteren',
};

/** Qui signe : son nom complet, et ce qu'il est pour Namorama, dans la langue du message. */
export interface Signataire {
  prenom: string;
  nomComplet: string;
}

const TITRE: Record<string, string> = {
  fr: 'Créateur de Namorama', en: 'Creator of Namorama', de: 'Gründer von Namorama', es: 'Creador de Namorama',
  pt: 'Criador do Namorama', it: 'Creatore di Namorama', nl: 'Maker van Namorama',
};

/**
 * La signature est ajoutée par le code, pas écrite par le modèle : elle doit
 * être exacte à chaque fois, et c'est elle qui fait d'un courriel celui d'une
 * personne plutôt que d'une marque.
 */
export function signature(qui: Signataire, langue: string): string {
  return `${qui.nomComplet}\n${TITRE[langue] ?? TITRE.en}`;
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
/** `[texte](https://…)` : la seule syntaxe reconnue, pour un lien porté par des mots plutôt qu'une URL nue. */
const LIEN_NOMME = /\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g;
/** Un lien nommé, ou à défaut une URL nue. */
const LIEN = new RegExp(`${LIEN_NOMME.source}|${URL_HTTPS.source}`, 'g');

/** La version texte : `[texte](url)` devient « texte (url) », lisible partout. */
export function versionTexte(texte: string): string {
  return texte.replace(LIEN_NOMME, (_m, t: string, u: string) => `${t} (${u})`);
}

/**
 * Le texte saisi, en HTML volontairement nu.
 *
 * Pas de logo, pas de bouton, pas de pied de page : c'est ce qui distingue un
 * courriel qu'une personne écrit d'une campagne, pour le lecteur comme pour
 * les filtres. Le corps est du TEXTE, jamais du HTML : il est échappé, les
 * lignes vides font les paragraphes et les liens `https://` deviennent
 * cliquables, comme `[texte](https://…)`. Un brouillon du modèle passe par
 * là comme le reste : l'URL d'un lien nommé passe par l'échappement, un
 * guillemet ne peut donc pas sortir de l'attribut `href`.
 */
export function mettreEnPage(texte: string): string {
  const paragraphes = texte
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      echapper(p)
        .replace(LIEN, (m, texte?: string, url?: string) =>
          texte && url ? `<a href="${url}">${texte}</a>` : `<a href="${m}">${m}</a>`)
        .replace(/\n/g, '<br>'),
    )
    .map((p) => `<p>${p}</p>`)
    .join('\n');
  return `<!DOCTYPE html>\n<html>\n<body>\n${paragraphes}\n</body>\n</html>`;
}

/**
 * Lit la réponse du modèle. Un brouillon sans corps n'est pas un brouillon :
 * on le refuse plutôt que de pré-remplir un champ vide.
 */
export function lireBrouillon(contenu: string | null | undefined): string | null {
  try {
    const brut = JSON.parse(contenu ?? '') as { corps?: unknown };
    const body = typeof brut.corps === 'string' ? brut.corps.trim() : '';
    return body || null;
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
  const connus = new Set([liens.site, liens.formulaire, liens.avis].filter(Boolean));
  const inconnus = (body.match(URL_HTTPS) ?? []).filter((u) => !connus.has(u));
  if (inconnus.length) alertes.push(`Lien(s) non fourni(s) au modèle : ${[...new Set(inconnus)].join(', ')}`);
  return alertes;
}

/**
 * Les consignes. Le but est fixe — obtenir un retour sur un point à
 * améliorer — et la personnalisation n'est pas un ornement : un message qui
 * pourrait partir tel quel à quelqu'un d'autre est un publipostage.
 */
export function consignes(langue: string, qui: Signataire, liens: Liens): string {
  return [
    `Tu écris, au nom de ${qui.nomComplet}, créateur de Namorama, un courriel personnel à UN utilisateur.`,
    "Namorama aide à trouver un nom de marque et un domaine disponibles à partir de la description d'un produit ; " +
      'un rapport de marque payant vérifie domaines, réseaux sociaux et dépôts INPI.',
    '',
    `BUT : demander de l'AIDE. ${qui.prenom} a besoin de son regard pour améliorer Namorama, et le lui dit simplement. ` +
      "C'est l'interlocuteur qui rend service : valorise son avis, sans flatterie. Pas vendre, pas relancer l'usage.",
    '',
    'SALUTATION : « Bonjour <prénom>, » (ou l’équivalent dans la langue) si le prénom est connu, « Bonjour, » sinon.',
    '',
    'OUVERTURE : une phrase pour se présenter et rappeler ce qu’est Namorama — la personne y a passé peu de temps ' +
      `et a pu l'oublier. Cite-le comme lien : [Namorama](${liens.site}). ` +
      "Ne commence JAMAIS par « J'ai vu que », « J'ai remarqué », « I noticed » ou équivalent : on ne doit pas se sentir observé.",
    '',
    'PERSONNALISATION — le message ne doit pouvoir être envoyé à personne d’autre :',
    "- Un seul élément concret de son activité, cité naturellement, en prenant LE PLUS FORT qui existe : " +
      "1) un nom pour lequel il a acheté un rapport ; 2) sinon un nom mis en favori ; 3) sinon le sujet de son projet, " +
      "dit en quelques mots d'après sa description. Les projets n'ont pas de nom : n'en invente pas.",
    "- Formule la demande comme un service qu'il rendrait (« pourriez-vous m'aider », « j'aurais besoin de votre regard »).",
    "- UNE question ouverte, adaptée à l'endroit où il s'est arrêté : aucun projet → ce qui a bloqué ; " +
      "des noms proposés mais aucun en favori → pourquoi ils ne convenaient pas ; des favoris sans rapport → ce qui " +
      "manquait pour aller plus loin ; un rapport acheté → s'il lui a servi.",
    "- S'il a déjà donné un retour, remercie-le de celui-ci et demande ce qui manque encore.",
    "- Si on lui a déjà écrit, ne reprends pas le même angle.",
    "- N'invente aucun fait.",
    '',
    'CE QUE LE MESSAGE DOIT DIRE :',
    `- Il peut répondre directement à ce courriel, ou passer par [ce court formulaire](${liens.formulaire}).`,
    '- Comme annoncé sur le site, un retour lui vaut jusqu’à 500 crédits, ajoutés après lecture. ' +
      'Une fois, en passant : c’est un remerciement, pas l’argument.',
    ...(liens.avis
      ? [
          `- OBLIGATOIRE, juste avant la formule de politesse, une phrase courte qui laisse le choix : s'il le souhaite, ` +
            `il peut aussi partager son expérience, quelle qu'elle soit, dans [un avis sur Trustpilot](${liens.avis}). ` +
            'Ne la relie pas aux crédits.',
        ]
      : []),
    '',
    'FORME :',
    `- En ${LANGUES[langue]}, vouvoiement. 50 à 100 mots, signature non comprise. Court : chaque phrase doit servir.`,
    '- Le ton d’une personne qui écrit à une autre : simple, direct, chaleureux. Aucune formule publicitaire, aucun emoji, ' +
      "pas de points d'exclamation en série, pas de « cher utilisateur ».",
    '- Termine par une formule de politesse brève. NE SIGNE PAS : la signature est ajoutée ensuite.',
    '- Liens : UNIQUEMENT sous la forme [texte](url), avec les URL ci-dessus recopiées à l’identique. Aucune autre URL.',
    "- Ne cite jamais de coût, de modèle d'IA ou d'information technique interne.",
    '- Évite le vocabulaire des campagnes, que les filtres anti-spam repèrent : « offert », « gratuit », « cadeau », ' +
      '« profitez », « exclusif », « cliquez ici », « urgent ».',
    '- Texte brut : paragraphes séparés par une ligne vide. Aucune autre mise en forme que les liens [texte](url).',
    '',
    'L’objet est fixé à part : n’écris que le corps. Réponds uniquement en JSON : {"corps": "..."}.',
  ].join('\n');
}

/**
 * « ADEM » → « Adem », « JEAN-LUC » → « Jean-Luc ». Seulement quand le prénom
 * est tout en capitales : une casse choisie (« McKay », « de Villiers ») est
 * laissée telle quelle. « Bonjour ADEM » sonne comme un fichier client.
 */
export function prenomLisible(prenom: string | null | undefined): string | null {
  const p = prenom?.trim();
  if (!p) return null;
  if (p !== p.toUpperCase() || p === p.toLowerCase()) return p;
  return p.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, l: string) => sep + l.toUpperCase());
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
      site,
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
        `SELECT p.id, p.description, p.createdAt,
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
      prenom: prenomLisible(user.firstName),
      langue: langueDe(user.locale),
      inscritLe: jour(user.createdAt)!,
      derniereActivite: jour(user.lastLogin),
      creditsDisponibles: user.credits + user.extraCredits,
      projets: projets.map((p: any) => ({
        description: raccourcir(p.description, 400),
        creeLe: jour(p.createdAt)!,
        nomsProposes: Number(p.proposes),
        nomsAimes: aimes.filter((a: any) => a.projectId === p.id).slice(0, 8).map((a: any) => String(a.domainName)),
        nomsEcartes: Number(p.ecartes),
      })),
      rapportsAchetes: rapports.map((r: any) => String(r.name)),
      retoursDonnes: retours.map((r: any) => ({ le: jour(r.createdAt)!, extrait: raccourcir(r.message, 300) })),
      dejaEcrit: envois.filter((e) => e.delivered).slice(0, 5).map((e) => ({ le: jour(e.createdAt)!, extrait: raccourcir(e.body, 300) })),
    };
  }

  /**
   * Un brouillon rédigé à partir de l'activité du compte. `note` est une
   * consigne facultative de l'administrateur (un angle, un fait à citer) ;
   * elle ne peut pas ajouter de promesse, les consignes l'interdisent.
   */
  async rediger(userId: number, qui: Signataire, note?: string): Promise<Brouillon> {
    if (!this.openai) throw new ServiceUnavailableException('Rédaction assistée indisponible : OPENAI_API_KEY absente');
    const ctx = await this.contexte(userId);
    const liens = this.liens();
    const demande = [
      note ? `Consigne de ${qui.prenom} pour ce message : ${note}\n` : '',
      `Compte :\n${JSON.stringify(ctx, null, 2)}`,
    ].join('');
    const appel = this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: consignes(ctx.langue, qui, liens) },
        { role: 'user', content: demande },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 900,
      reasoning_effort: 'none',
    });
    const res = await this.usage.mesurer('admin_mail_draft', appel);
    const texte = lireBrouillon(res.choices[0]?.message?.content);
    if (!texte) throw new ServiceUnavailableException('Le modèle a rendu un brouillon inutilisable');
    // La signature suit le texte dans le formulaire : elle se relit et se retouche comme le reste.
    const body = `${texte}\n\n${signature(qui, ctx.langue)}`;
    return { subject: OBJET[ctx.langue] ?? OBJET.fr, body, promptVersion: CONSIGNES_VERSION, avertissements: verifierBrouillon(body, liens) };
  }

  /**
   * Envoie le message relu, sous le nom de l'administrateur, réponses vers
   * son adresse. Tracé même en échec : une tentative ratée dit qu'il reste
   * quelque chose à faire, et ne se confond pas avec « jamais écrit ».
   */
  async envoyer(
    userId: number,
    admin: { sub: string; nomComplet: string },
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
      text: versionTexte(body),
      fromName: admin.nomComplet,
      parAdmin: true,
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
