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
import { BRAND_REPORT_COST } from '../brand-report/brand-report.service';
import { FREE_MONTHLY_QUOTA } from '../users/users.service';

/**
 * Version des consignes de rédaction. À CHANGER à chaque modification du
 * prompt : chaque envoi la garde, et c'est ce qui dit, après coup, à qui
 * l'ancienne version a écrit.
 */
export const CONSIGNES_VERSION = '2026-09-25.5';

/** Ce que le modèle sait du destinataire — et rien de plus. */
export interface ContexteDestinataire {
  prenom: string | null;
  /**
   * Langue du compte, si Keycloak la connaît. `null` pour la plupart (64 sur
   * 79 le 25/09/2026) : le modèle la déduit alors des descriptions de projet.
   */
  langue: string | null;
  /**
   * Extension du domaine de son adresse (`fr`, `de`, `com`…), jamais
   * l'adresse : un indice de langue quand Keycloak n'en a pas.
   */
  extensionEmail: string | null;
  inscritLe: string;
  derniereActivite: string | null;
  /** 1 par nom proposé + le coût réel des rapports. */
  creditsConsommes: number;
  /**
   * Le solde en base. Le renouvellement mensuel étant paresseux, c'est celui
   * qu'il avait en partant — ce qui dit s'il a pu être bloqué.
   */
  soldeADerniereVisite: number;
  /**
   * Ce que ses chiffres laissent deviner de son parcours, dit en clair. Le
   * modèle choisit le plus révélateur pour sa question : interpréter des
   * chiffres bruts, il le fait mal (un solde de 3 n'évoque rien pour lui).
   */
  signaux: string[];
  /**
   * Sans leur nom : il est généré par défaut (`suggest_name`), l'utilisateur
   * ne l'a pas choisi et ne le reconnaîtrait pas dans un courriel. Les
   * doublons n'apparaissent qu'une fois, le signal les compte.
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

/** Les données brutes d'un compte, telles que lues en base. */
export interface ActiviteBrute {
  prenom: string | null;
  locale: string | null;
  email: string | null;
  inscritLe: Date;
  derniereActivite: Date | null;
  solde: number;
  projets: { id: string; description: string; creeLe: Date; proposes: number; ecartes: number }[];
  aimes: { projectId: string; nom: string }[];
  rapports: { nom: string; cout: number | null }[];
  retours: { message: string; le: Date }[];
  envois: { body: string; createdAt: Date; delivered: boolean }[];
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
 * L'objet est FIXE, décidé et non généré : ce qu'écrirait une personne, et
 * un effort qui paraît léger.
 * Le modèle ne rédige plus que le corps.
 */
export const OBJET: Record<string, string> = {
  fr: 'Une question rapide sur Namorama', en: 'A quick question about Namorama', de: 'Eine kurze Frage zu Namorama',
  es: 'Una pregunta rápida sobre Namorama', pt: 'Uma pergunta rápida sobre o Namorama',
  it: 'Una domanda veloce su Namorama', nl: 'Een korte vraag over Namorama',
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

/** `fr-FR` → `fr` ; absente ou qu'on ne sait pas écrire → `null`, à déduire ailleurs. */
export function langueDe(locale: string | null | undefined): string | null {
  const l = (locale ?? '').split('-')[0].toLowerCase();
  return LANGUES[l] ? l : null;
}

/** La langue que le modèle dit avoir employée, si c'en est une qu'on signe. */
export function langueRendue(l: unknown): string {
  const code = typeof l === 'string' ? l.trim().toLowerCase().slice(0, 2) : '';
  return LANGUES[code] ? code : 'fr';
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
 * Lit la réponse du modèle : la langue employée et la phrase de contexte.
 * Sans phrase, rien à personnaliser : on le refuse plutôt que d'envoyer le
 * gabarit nu, qui partirait à l'identique à tout le monde.
 */
export function lireBrouillon(contenu: string | null | undefined): { langue: string; contexte: string } | null {
  try {
    const brut = JSON.parse(contenu ?? '') as { langue?: unknown; contexte?: unknown };
    // Une phrase : un saut de ligne n'y a pas sa place.
    const contexte = typeof brut.contexte === 'string' ? brut.contexte.replace(/\s+/g, ' ').trim() : '';
    return contexte ? { langue: langueRendue(brut.langue), contexte } : null;
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

interface Gabarit {
  bonjour: (prenom: string | null) => string;
  presentation: (prenom: string, site: string) => string;
  question: string;
  reponse: (formulaire: string) => string;
  avis: (url: string) => string;
  merci: string;
}

/**
 * Le message, écrit par Nicolas et traduit. Le modèle n'en rédige qu'UNE
 * phrase, celle qui rappelle à la personne ce qu'elle a fait : le reste dit
 * exactement ce qu'on demande, et ne doit pas varier d'un tirage à l'autre.
 */
export const GABARITS: Record<string, Gabarit> = {
  fr: {
    bonjour: (p) => (p ? `Bonjour ${p},` : 'Bonjour,'),
    presentation: (p, site) =>
      `Je suis ${p}, le créateur de [namorama.com](${site}), et j'apprécierais beaucoup votre aide pour améliorer l'outil.`,
    question: "Pourriez-vous me dire ce que vous avez aimé, ce qui vous a bloqué, ou n'importe quel point qui mériterait d'être amélioré dans l'application ?",
    reponse: (f) =>
      `Vous pouvez simplement répondre à ce courriel, ou passer par [ce court formulaire](${f}). Vos commentaires m'aideront ` +
      "à améliorer l'outil, et comme mentionné sur le site, je serai ravi de vous offrir 500 crédits gratuits pour que " +
      'vous puissiez prolonger votre expérience.',
    avis: (u) => `Si vous le souhaitez, vous pouvez aussi partager votre expérience, quelle qu'elle soit, dans [un avis sur Trustpilot](${u}).`,
    merci: "Merci d'avance,",
  },
  en: {
    bonjour: (p) => (p ? `Hello ${p},` : 'Hello,'),
    presentation: (p, site) =>
      `I'm ${p}, the creator of [namorama.com](${site}), and I would really appreciate your help to improve the tool.`,
    question: 'Could you tell me what you liked, what got in your way, or anything else that should be improved in the app?',
    reponse: (f) =>
      `You can simply reply to this email, or use [this short form](${f}). Your comments will help me improve the tool, ` +
      "and as mentioned on the site, I'll be happy to give you 500 free credits so you can keep exploring.",
    avis: (u) => `If you'd like, you can also share your experience, whatever it was, in [a Trustpilot review](${u}).`,
    merci: 'Thanks in advance,',
  },
  de: {
    bonjour: (p) => (p ? `Hallo ${p},` : 'Guten Tag,'),
    presentation: (p, site) =>
      `ich bin ${p}, der Gründer von [namorama.com](${site}), und ich würde mich sehr über Ihre Hilfe freuen, um das Tool zu verbessern.`,
    question: 'Könnten Sie mir sagen, was Ihnen gefallen hat, was Sie gebremst hat oder was an der Anwendung verbessert werden sollte?',
    reponse: (f) =>
      `Sie können einfach auf diese E-Mail antworten oder [dieses kurze Formular](${f}) nutzen. Ihre Rückmeldung hilft mir, ` +
      'das Tool zu verbessern, und wie auf der Website angekündigt, schenke ich Ihnen gerne 500 kostenlose Credits, damit Sie weiter ausprobieren können.',
    avis: (u) => `Wenn Sie möchten, können Sie Ihre Erfahrung, wie auch immer sie war, auch in [einer Bewertung auf Trustpilot](${u}) teilen.`,
    merci: 'Vielen Dank im Voraus,',
  },
  es: {
    bonjour: (p) => (p ? `Hola, ${p}:` : 'Hola:'),
    presentation: (p, site) =>
      `Soy ${p}, el creador de [namorama.com](${site}), y le agradecería mucho su ayuda para mejorar la herramienta.`,
    question: '¿Podría decirme qué le gustó, qué le frenó o cualquier aspecto de la aplicación que debería mejorarse?',
    reponse: (f) =>
      `Puede simplemente responder a este correo o usar [este breve formulario](${f}). Sus comentarios me ayudarán a mejorar ` +
      'la herramienta y, como se indica en el sitio, estaré encantado de regalarle 500 créditos gratuitos para que pueda seguir explorando.',
    avis: (u) => `Si lo desea, también puede compartir su experiencia, sea cual sea, en [una reseña en Trustpilot](${u}).`,
    merci: 'Gracias de antemano,',
  },
  pt: {
    bonjour: (p) => (p ? `Olá ${p},` : 'Olá,'),
    presentation: (p, site) =>
      `Sou o ${p}, criador do [namorama.com](${site}), e agradeceria muito a sua ajuda para melhorar a ferramenta.`,
    question: 'Poderia dizer-me o que gostou, o que o impediu de avançar ou qualquer ponto da aplicação que deveria ser melhorado?',
    reponse: (f) =>
      `Pode simplesmente responder a este e-mail ou usar [este breve formulário](${f}). Os seus comentários vão ajudar-me a ` +
      'melhorar a ferramenta e, como indicado no site, terei todo o gosto em oferecer-lhe 500 créditos gratuitos para continuar a explorar.',
    avis: (u) => `Se quiser, também pode partilhar a sua experiência, seja ela qual for, numa [avaliação no Trustpilot](${u}).`,
    merci: 'Obrigado desde já,',
  },
  it: {
    bonjour: (p) => (p ? `Buongiorno ${p},` : 'Buongiorno,'),
    presentation: (p, site) =>
      `sono ${p}, il creatore di [namorama.com](${site}), e apprezzerei molto il suo aiuto per migliorare lo strumento.`,
    question: "Potrebbe dirmi cosa le è piaciuto, cosa non ha funzionato per lei o qualsiasi aspetto dell'applicazione che andrebbe migliorato?",
    reponse: (f) =>
      `Può semplicemente rispondere a questa email o usare [questo breve modulo](${f}). I suoi commenti mi aiuteranno a ` +
      'migliorare lo strumento e, come indicato sul sito, sarò felice di offrirle 500 crediti gratuiti per continuare a esplorare.',
    avis: (u) => `Se lo desidera, può anche condividere la sua esperienza, qualunque sia stata, in [una recensione su Trustpilot](${u}).`,
    merci: 'Grazie in anticipo,',
  },
  nl: {
    bonjour: (p) => (p ? `Hallo ${p},` : 'Hallo,'),
    presentation: (p, site) =>
      `Ik ben ${p}, de maker van [namorama.com](${site}), en ik zou uw hulp om de tool te verbeteren erg waarderen.`,
    question: 'Zou u mij willen vertellen wat u goed vond, waar u op vastliep, of wat er in de applicatie beter kan?',
    reponse: (f) =>
      `U kunt gewoon op deze e-mail antwoorden of [dit korte formulier](${f}) gebruiken. Uw opmerkingen helpen mij de tool ` +
      'te verbeteren, en zoals op de site vermeld, geef ik u graag 500 gratis credits om verder te ontdekken.',
    avis: (u) => `Als u wilt, kunt u uw ervaring, hoe die ook was, ook delen in [een review op Trustpilot](${u}).`,
    merci: 'Alvast bedankt,',
  },
};

/** Le message complet : le gabarit de la langue, la phrase du modèle, la signature. */
export function composer(
  langue: string,
  prenom: string | null,
  contexte: string,
  qui: Signataire,
  liens: Liens,
): string {
  const g = GABARITS[langue] ?? GABARITS.fr;
  return [
    g.bonjour(prenom),
    g.presentation(qui.prenom, liens.site),
    `${contexte} ${g.question}`,
    g.reponse(liens.formulaire),
    ...(liens.avis ? [g.avis(liens.avis)] : []),
    `${g.merci}\n\n${signature(qui, langue)}`,
  ].join('\n\n');
}

/**
 * Les consignes : une seule phrase, celle qui rappelle à la personne ce
 * qu'elle a fait. C'est ce qui personnalise le message — sans elle, il
 * pourrait partir tel quel à n'importe qui.
 */
export function consignes(langue: string | null): string {
  return [
    "Tu écris UNE phrase qui sera insérée dans un courriel du créateur de Namorama à l'un de ses utilisateurs, " +
      'juste avant la question « ce que vous avez aimé, ce qui vous a bloqué, ce qui mériterait d’être amélioré ». ' +
      "Namorama aide à trouver un nom de marque et un domaine disponibles à partir de la description d'un produit ; " +
      'un rapport de marque payant vérifie domaines, réseaux sociaux et dépôts INPI.',
    '',
    'LA PHRASE rappelle à la personne ce qu’elle a fait, pour qu’elle s’en souvienne — elle y a passé peu de temps :',
    '- Elle commence par l’équivalent de « J’ai vu que vous… ».',
    "- Le sujet de sa recherche, dit en quelques mots d'après la description de son projet (« une boulangerie bio à " +
      "Nantes »). JAMAIS le nom du projet : il est généré, elle ne l'a pas choisi.",
    "- Au plus un détail de plus, le plus parlant : un nom pour lequel elle a acheté un rapport, sinon un nom mis en " +
      'favori.',
    "- Sans projet : elle s'est inscrite sans aller jusqu'à décrire son produit.",
    '- Des faits uniquement : aucune hypothèse sur ce qui l’a gênée, aucun chiffre, aucun crédit, aucune question.',
    '- 30 mots au plus, vouvoiement, sans lien ni mise en forme.',
    '',
    langue
      ? `LANGUE : ${LANGUES[langue]}.`
      : 'LANGUE : à déduire. Une description en anglais NE SUFFIT PAS : beaucoup de francophones décrivent en ' +
        'anglais un produit destiné à l’international. Croise la langue des descriptions, le prénom et ' +
        '`extensionEmail` ; en cas de doute, le français. Uniquement l’une de : ' +
        `${Object.keys(LANGUES).join(', ')}.`,
    '',
    'Réponds uniquement en JSON : {"langue": "<code à deux lettres>", "contexte": "<la phrase>"}.',
  ].join('\n');
}

/**
 * « ADEM » → « Adem », « stéphane » → « Stéphane », « JEAN-LUC » → « Jean-Luc ».
 * Seulement quand le prénom est tout en capitales ou tout en minuscules : une
 * casse choisie (« McKay ») est laissée telle quelle. « Bonjour ADEM » sonne
 * comme un fichier client, « Bonjour stéphane » comme un publipostage.
 */
const PRENOMS_GENERIQUES = /^(support|contact|admin|administrat\w*|info|test\w*|hello|bonjour|team|equipe|équipe|user|utilisateur|null|undefined)$/i;

export function prenomLisible(prenom: string | null | undefined): string | null {
  const p = prenom?.trim();
  // « Bonjour Support » : un compte de service n'a pas de prénom à saluer.
  if (!p || PRENOMS_GENERIQUES.test(p)) return null;
  const casse = p === p.toUpperCase() || p === p.toLowerCase();
  if (!casse) return p;
  return p.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, l: string) => sep + l.toUpperCase());
}

const raccourcir = (s: string | null | undefined, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const normaliser = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Ce que les chiffres d'un compte laissent deviner de son parcours.
 *
 * Calculé ici plutôt que laissé au modèle : il lit mal un solde ou un
 * compteur, et un signal faux donnerait une question à côté. Chaque phrase
 * dit le fait ET ce qu'il suggère, pour qu'il en tire une question.
 */
export function signaux(a: ActiviteBrute, parDescription: Map<string, number>): string[] {
  const out: string[] = [];
  const proposes = a.projets.reduce((n, p) => n + p.proposes, 0);
  const favoris = a.aimes.length;

  if (!a.projets.length) {
    out.push("Inscrit sans avoir créé de projet : il s'est arrêté avant même de décrire son produit.");
  } else if (!proposes) {
    out.push("A décrit son produit mais n'a lancé aucune recherche de noms.");
  }
  const doublons = [...parDescription.values()].filter((n) => n > 1);
  if (doublons.length) {
    out.push(
      `A créé ${Math.max(...doublons)} projets à la description identique : il n'a peut-être pas su retrouver ` +
        'le projet déjà créé, ou a cru devoir recommencer pour relancer une recherche.',
    );
  }
  if (a.solde < 10 && proposes) {
    out.push(
      `Est reparti avec ${a.solde} crédit(s) : il a probablement été bloqué faute de crédits au moment de continuer. ` +
        `Le quota de ${FREE_MONTHLY_QUOTA} crédits se renouvelle chaque mois.`,
    );
  } else if (favoris && !a.rapports.length && a.solde < BRAND_REPORT_COST) {
    out.push(
      `A des noms en favori, mais ${a.solde} crédits : pas assez pour un rapport de marque (${BRAND_REPORT_COST} crédits).`,
    );
  }
  if (proposes && !favoris) {
    out.push(
      `${proposes} noms proposés, aucun mis en favori : les propositions ne lui convenaient pas, ` +
        "ou il n'a pas vu qu'on pouvait garder ceux qui plaisent.",
    );
  } else if (favoris && !a.rapports.length) {
    out.push("A mis des noms en favori sans aller jusqu'au rapport de marque.");
  }
  if (a.rapports.length) out.push(`A acheté un rapport de marque (${a.rapports.map((r) => r.nom).join(', ')}).`);
  const consommes = proposes + a.rapports.reduce((n, r) => n + (r.cout ?? 0), 0);
  if (consommes >= FREE_MONTHLY_QUOTA) out.push(`Utilisateur engagé : ${consommes} crédits consommés.`);
  if (a.derniereActivite && jourISO(a.derniereActivite) === jourISO(a.inscritLe)) {
    out.push("N'est venu qu'une fois, le jour de son inscription.");
  }
  return out;
}

/** Séparée de la lecture en base, pour se tester sans elle. */
export function construireContexte(a: ActiviteBrute): ContexteDestinataire {
  const jour = (d: Date | null) => (d ? jourISO(new Date(d)) : null);
  const parDescription = new Map<string, number>();
  for (const p of a.projets) {
    const k = normaliser(p.description);
    parDescription.set(k, (parDescription.get(k) ?? 0) + 1);
  }
  const vus = new Set<string>();
  const projets = a.projets
    .filter((p) => {
      const k = normaliser(p.description);
      return vus.has(k) ? false : (vus.add(k), true);
    })
    .slice(0, 5)
    .map((p) => ({
      description: raccourcir(p.description, 400),
      creeLe: jour(p.creeLe)!,
      nomsProposes: p.proposes,
      nomsAimes: a.aimes.filter((x) => x.projectId === p.id).slice(0, 8).map((x) => x.nom),
      nomsEcartes: p.ecartes,
    }));
  return {
    prenom: prenomLisible(a.prenom),
    langue: langueDe(a.locale),
    extensionEmail: a.email?.split('@')[1]?.split('.').pop()?.toLowerCase() || null,
    inscritLe: jour(a.inscritLe)!,
    derniereActivite: jour(a.derniereActivite),
    creditsConsommes: a.projets.reduce((n, p) => n + p.proposes, 0) + a.rapports.reduce((n, r) => n + (r.cout ?? 0), 0),
    soldeADerniereVisite: a.solde,
    signaux: signaux(a, parDescription),
    projets,
    rapportsAchetes: a.rapports.map((r) => r.nom),
    retoursDonnes: a.retours.map((r) => ({ le: jour(r.le)!, extrait: raccourcir(r.message, 300) })),
    dejaEcrit: a.envois.filter((e) => e.delivered).slice(0, 5).map((e) => ({ le: jour(e.createdAt)!, extrait: raccourcir(e.body, 300) })),
  };
}

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

    // Tous les projets, pas les cinq derniers : un doublon peut être ancien.
    const [projets, aimes, rapports, retours, envois] = await Promise.all([
      this.dataSource.query(
        `SELECT p.id, p.description, p.createdAt,
                COUNT(ds.id) AS proposes, COALESCE(SUM(ds.rating = 'disliked'), 0) AS ecartes
           FROM project p LEFT JOIN domain_suggestion ds ON ds.projectId = p.id
          WHERE p.userId = ?
          GROUP BY p.id ORDER BY p.createdAt DESC`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT ds.projectId, ds.domainName FROM domain_suggestion ds INNER JOIN project p ON p.id = ds.projectId
          WHERE p.userId = ? AND ds.rating = 'liked' ORDER BY ds.createdAt DESC LIMIT 40`,
        [userId],
      ),
      this.dataSource.query(
        'SELECT name, costCredits FROM brand_report_record WHERE keycloakId = ? ORDER BY createdAt DESC LIMIT 5',
        [user.keycloakId],
      ),
      this.dataSource.query(
        'SELECT message, createdAt FROM feedback WHERE keycloakId = ? ORDER BY createdAt DESC LIMIT 3',
        [user.keycloakId],
      ),
      this.historique(userId),
    ]);

    return construireContexte({
      prenom: user.firstName,
      locale: user.locale,
      email: user.email,
      inscritLe: user.createdAt,
      derniereActivite: user.lastLogin,
      solde: user.credits + user.extraCredits,
      projets: projets.map((p: any) => ({
        id: String(p.id),
        description: String(p.description ?? ''),
        creeLe: p.createdAt,
        proposes: Number(p.proposes),
        ecartes: Number(p.ecartes),
      })),
      aimes: aimes.map((x: any) => ({ projectId: String(x.projectId), nom: String(x.domainName) })),
      rapports: rapports.map((x: any) => ({ nom: String(x.name), cout: x.costCredits === null ? null : Number(x.costCredits) })),
      retours: retours.map((x: any) => ({ message: String(x.message), le: x.createdAt })),
      envois,
    });
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
        { role: 'system', content: consignes(ctx.langue) },
        { role: 'user', content: demande },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 200,
      reasoning_effort: 'none',
    });
    const res = await this.usage.mesurer('admin_mail_draft', appel);
    const lu = lireBrouillon(res.choices[0]?.message?.content);
    if (!lu) throw new ServiceUnavailableException('Le modèle a rendu un brouillon inutilisable');
    // Langue du compte si on la connaît, sinon celle que le modèle a employée :
    // le gabarit, l'objet et la signature la suivent.
    const langue = ctx.langue ?? lu.langue;
    // Le message entier revient dans le formulaire : il se relit et se retouche comme un texte écrit à la main.
    const body = composer(langue, ctx.prenom, lu.contexte, qui, liens);
    return { subject: OBJET[langue] ?? OBJET.fr, body, promptVersion: CONSIGNES_VERSION, avertissements: verifierBrouillon(body, liens) };
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
      // « Namorama » : un nom de personne sur une adresse générique ressemble à
      // une usurpation (relevé sur un test Gmail le 25/09/2026). La personne,
      // c'est la signature. Réponses à support@, l'adresse d'envoi.
      fromName: 'Namorama',
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
