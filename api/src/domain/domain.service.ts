import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Resolver } from 'node:dns/promises';
import { MatchMode } from './dto/search-domains.dto';
import { RdapService } from './rdap.service';
import { ModelUsageService, OperationModele } from '../common/model-usage/model-usage.service';

const execFileAsync = promisify(execFile);

/**
 * Candidats évalués de front. La boucle était séquentielle : 143 noms à ~1,3 s
 * l'un font les 3 minutes qu'attendaient les utilisateurs.
 */
const CANDIDATE_CONCURRENCY = 6;

/**
 * Vérifications simultanées vers un **même** registre.
 *
 * Mesuré depuis le serveur de production, 24 vérifications par palier :
 *
 * - Verisign (.com) : 24/24 concluantes jusqu'à 8 en parallèle, à 37 req/s.
 *   Aucune limite atteinte.
 * - Google (.app, .dev) : 10/24 aussi bien à 1 qu'à 8 en parallèle. Son quota
 *   porte sur le **volume par fenêtre de temps**, pas sur la simultanéité —
 *   le brider ne change donc rien à ce qu'il accepte, et coûte du temps.
 *
 * D'où une limite volontairement lâche : elle sert de garde-fou contre les
 * rafales pathologiques, pas de régulateur. Ce qui protège vraiment les
 * quotas, c'est le court-circuit de checkExtensions, qui supprime des
 * requêtes au lieu de les étaler.
 */
const PER_REGISTRY_CONCURRENCY = 4;

/**
 * Pré-filtre DNS : au-delà, on n'attend plus la résolution.
 *
 * Le pré-filtre n'a d'intérêt que s'il est PLUS RAPIDE que le registre. Un
 * résolveur qui traîne doit donc être abandonné, pas attendu : le registre
 * tranchera, comme avant.
 */
const DNS_TIMEOUT_MS = 1500;

/**
 * Extensions dont le WHOIS est interrogé AVANT le RDAP.
 *
 * `.fr` uniquement, et sur mesure : à volume de recherche réel (60 domaines,
 * quatre requêtes en parallèle, depuis la production), le RDAP de l'AFNIC
 * plafonne à 1 295 ms par domaine quand son WHOIS plafonne à 283 ms — 4,6 fois
 * plus rapide en régime établi, et 4 fois sur le premier bloc de vingt. Les
 * deux limitent le débit ; l'un le fait beaucoup plus durement que l'autre.
 *
 * Ce n'est pas un procès du RDAP : chez Verisign (.com, .net) il tient sans
 * broncher, et il reste la source primaire partout ailleurs — un code HTTP
 * vaut mieux qu'un texte à interpréter registre par registre. C'est le
 * DÉPLOIEMENT de l'AFNIC qui bride RDAP plus que son service historique.
 *
 * Le RDAP reste le repli : si le WHOIS ne conclut pas — quota épuisé,
 * vocabulaire inconnu — on l'interroge, exactement comme avant dans l'autre
 * sens. Une extension ne rejoint cette liste que mesures à l'appui.
 */
const WHOIS_AVANT_RDAP = new Set(['fr']);

/** D'où vient chaque verdict d'une recherche : mesure du pré-filtre DNS. */
export interface SourcesVerdict {
  /** Tranchés par la délégation DNS, sans toucher au registre. */
  dns: number;
  /** Soumis au registre (RDAP, puis WHOIS en repli). */
  registre: number;
}

const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{1,61})+$/;

function validateDomain(domain: string): void {
  if (!DOMAIN_REGEX.test(domain)) {
    throw new BadRequestException(`Invalid domain: ${domain}`);
  }
}

/**
 * Contraintes de naming extraites de la description libre de l'utilisateur.
 * Les utilisateurs écrivent souvent leur brief dans la description
 * (« nom court, 5-8 lettres, façon Qonto, éviter tech/AI ») : on l'exploite.
 */
export interface NamingConstraints {
  /** Longueur mini d'un nom "standard" (défaut 7). Abaissé si l'user veut du court. */
  minLength: number;
  /** Longueur maxi d'un nom "standard" (défaut 12). */
  maxLength: number;
  /** Mots / racines à ne PAS produire (contraintes négatives explicites). */
  avoidWords: string[];
  /** Marques citées comme références de style (ex. Qonto, Stripe). */
  referenceBrands: string[];
}

/** Longueur mini par défaut d'un nom généré — en dessous, presque tout est déposé. */
/**
 * Plafond de mots-clés proposés. Quinze : de quoi couvrir plusieurs angles
 * sans transformer l'étape de cadrage en corvée de tri.
 */
export const KEYWORD_LIMIT = 15;

/**
 * Noms notés par appel au modèle.
 *
 * L'analyse partait par nom : dix noms, dix appels, et donc dix fois le même
 * prompt et dix surcharges de raisonnement pour une consigne identique.
 * Relevé sur les 30 jours au 16/09/2026, c'était **64 % de la facture
 * OpenAI** — 1403 appels pour 142 recherches, dont un seul servi par le cache
 * (les noms sont neufs à chaque recherche, `suggestion.analysis` ne rattrape
 * rien).
 *
 * Grouper divise le coût par ~6 : l'entrée n'est payée qu'une fois, seule la
 * sortie reste proportionnelle au nombre de noms. Le lot reste borné parce
 * que la sortie l'est aussi — au-delà, le modèle tronque son JSON et c'est
 * tout le lot qui est perdu, pas un seul nom.
 */
const ANALYSES_PAR_APPEL = 10;

/** Budget de sortie : une notice complète pèse ~250 tokens, plus l'enveloppe. */
const TOKENS_PAR_ANALYSE = 320;

/** Validité du repérage du marché. Le paysage concurrentiel ne bouge pas en une journée. */
const COMPETITORS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Descriptions distinctes retenues. Au-delà, les plus anciennes sortent. */
const COMPETITORS_CACHE_MAX = 500;

/**
 * Dédoublonne sans tenir compte de la casse ni des espaces, en gardant l'ORDRE
 * du modèle — il les rend du plus au moins pertinent, et c'est le début de
 * liste qu'on conserve.
 */
export function dedupeKeywords(raw: string[]): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  for (const k of raw) {
    const mot = k.trim();
    if (!mot) continue;
    const cle = mot.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push(mot);
  }
  return out;
}

export const DEFAULT_MIN_NAME_LENGTH = 7;
/** Plancher absolu réglable depuis l'UI (avec avertissement « difficile »). */
export const MIN_NAME_LENGTH_FLOOR = 5;
/** Plafond du réglage de longueur mini côté UI. */
export const MAX_NAME_LENGTH_FLOOR = 12;

const DEFAULT_CONSTRAINTS: NamingConstraints = {
  minLength: DEFAULT_MIN_NAME_LENGTH,
  maxLength: 12,
  avoidWords: [],
  referenceBrands: [],
};

/** Un acteur déjà présent sur le marché décrit. */
export interface Competitor {
  name: string;
  domain: string;
  note: string;
}

/** Repérage du marché : les acteurs trouvés, et par quelle voie. */
export interface CompetitorsResult {
  competitors: Competitor[];
  source: 'web' | 'model';
}

/** Paramètres d'une recherche de domaines disponibles. */
export interface FindDomainsOptions {
  targetCount?: number;
  extensions?: string[];
  matchMode?: MatchMode;
  locale?: string;
  excludeNames?: string[];
  onEvent?: (event: Record<string, any>) => void;
  descriptiveNames?: boolean;
  culturalNames?: boolean;
  likedNames?: string[];
  dislikedNames?: string[];
  /** Longueur mini choisie explicitement dans l'UI — prime sur celle extraite du brief. */
  minLength?: number;
  /** Noms/domaines cités par l'utilisateur comme références de style. */
  likedExamples?: string[];
  /** Domaines de produits existants du même secteur (à ne pas imiter de trop près). */
  competitorDomains?: string[];
  /** Domaines dont l'utilisateur a explicitement rejeté le style. */
  dislikedStyleDomains?: string[];
}

@Injectable()
export class DomainService {
  private readonly logger = new Logger(DomainService.name);
  private openai: OpenAI;
  /** Une file d'attente par registre, cf. PER_REGISTRY_CONCURRENCY. */
  private readonly registryGates = new Map<string, { active: number; queue: (() => void)[] }>();

  /**
   * Résolveur dédié, avec un délai court et sans reprise : voir DNS_TIMEOUT_MS.
   * Le résolveur global de Node attend 5 secondes et réessaie quatre fois —
   * de quoi rendre le pré-filtre plus lent que ce qu'il évite.
   */
  private readonly dnsResolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });

  /** Par TLD : le pré-filtre DNS y est-il utilisable ? Voir `prefiltreUtilisable`. */
  private readonly dnsUtilisable = new Map<string, Promise<boolean>>();

  /** Modèle par défaut pour les tâches simples/rapides (reformulation, mots-clés…). */
  private readonly model: string;
  /** Modèle « qualité » pour les étapes créatives / à jugement (génération de noms, pick-best). */
  private readonly creativeModel: string;
  /**
   * Modèle de la notation des noms — le modèle simple par défaut.
   *
   * L'analyse tournait sur le modèle créatif, à raisonnement `low` : 0,0075 $
   * l'appel là où la tâche est une notation sur cinq critères dans un JSON
   * imposé, pas de la création. Le modèle simple la rend au dixième du prix.
   * Variable séparée pour que revenir en arrière sur la seule analyse ne
   * ramène pas aussi la génération de noms — c'est là que la qualité se joue.
   */
  private readonly analysisModel: string;

  /**
   * Repérage du marché déjà payé, par description.
   *
   * Un appel coûte ~0,03 $ — 0,01 $ de frais d'outil `web_search`, le reste
   * en contenu web facturé au tarif du modèle — et met 18 s en médiane. Le
   * même utilisateur qui revient sur l'étape de cadrage, ou deux personnes
   * décrivant le même produit, ne doivent pas le repayer.
   *
   * En mémoire, donc perdu au redéploiement : c'est un cache d'économie, pas
   * une source de vérité, et le marché bouge assez peu pour qu'une journée de
   * validité soit large.
   */
  private readonly competitorsCache = new Map<string, { at: number; value: CompetitorsResult }>();

  constructor(
    private configService: ConfigService,
    private readonly rdap: RdapService,
    // Facultatif pour les tests unitaires, qui construisent le service à la main.
    @Optional() private readonly usage?: ModelUsageService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    // Modèles configurables via env — cf. .env.example.
    // IDs API GPT-5.6 : gpt-5.6-luna (rapide/éco), gpt-5.6-terra (équilibré), gpt-5.6-sol (max).
    this.model = this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-5.6-luna';
    this.creativeModel = this.configService.get<string>('OPENAI_MODEL_CREATIVE') ?? 'gpt-5.6-terra';
    this.analysisModel = this.configService.get<string>('OPENAI_MODEL_ANALYSIS') ?? this.model;
    this.logger.log(`Modèles OpenAI — simple: "${this.model}" | créatif: "${this.creativeModel}" | analyse: "${this.analysisModel}"`);
  }

  /** Note la consommation d'un appel au modèle. Voir `ModelUsageService.mesurer`. */
  private mesurer<T>(operation: OperationModele, appel: Promise<T>, items = 1): Promise<T> {
    return this.usage ? this.usage.mesurer(operation, appel, items) : appel;
  }

  async refineDescription(description: string): Promise<string> {
    try {
      const response = await this.mesurer('refine', this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'Tu es un expert en marketing et branding. Reformule et complète la description suivante pour en extraire l\'essence et la valeur ajoutée du produit. Sois concis mais percutant. ' +
              'Réponds en texte brut uniquement : pas de Markdown, pas de titres (#), pas de gras/italique (*, **, _), pas de listes à puces ni de numérotation. Un ou deux paragraphes simples séparés par un saut de ligne.',
          },
          { role: 'user', content: description },
        ],
        max_completion_tokens: 500,
        reasoning_effort: 'none',
      }));

      return this.stripMarkdown(response.choices[0].message.content?.trim() ?? '');
    } catch (error) {
      this.logger.error('Erreur lors de la reformulation IA:', error);
      throw error;
    }
  }

  /**
   * Filet de sécurité : retire le formatage Markdown éventuellement produit par
   * l'IA (titres, gras/italique, puces...) pour ne renvoyer que du texte brut.
   */
  private stripMarkdown(text: string): string {
    return text
      .replace(/^\s{0,3}#{1,6}\s+/gm, '') // titres ###
      .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '') // listes à puces / numérotées
      .replace(/(\*\*|__)(.*?)\1/g, '$2') // gras
      .replace(/(\*|_)(.*?)\1/g, '$2') // italique
      .replace(/`([^`]+)`/g, '$1') // code inline
      .replace(/^\s*>\s?/gm, '') // citations
      .replace(/\n{3,}/g, '\n\n') // espaces verticaux excessifs
      .trim();
  }

  async suggestProjectName(description: string): Promise<string> {
    try {
      const response = await this.mesurer('suggest_name', this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en branding. Suggère UNIQUEMENT un seul mot (nom propre ou mot inventé) qui soit extrêmement évocateur, moderne et mémorisable pour le projet décrit. Pas de ponctuation, pas de phrase.',
          },
          { role: 'user', content: description },
        ],
        // Budget généreux : sur un modèle à raisonnement, une limite trop basse
        // (ex. 10) serait absorbée par les tokens de raisonnement → réponse vide.
        max_completion_tokens: 200,
        reasoning_effort: 'none',
      }));

      return response.choices[0].message.content?.trim().replace(/[^a-zA-Z0-9]/g, '') ?? '';
    } catch (error) {
      this.logger.error('Erreur lors de la suggestion du nom de projet:', error);
      return '';
    }
  }

  /**
   * Mots-clés proposés à l'étape de cadrage : les 15 plus pertinents.
   *
   * Le modèle en produisait « au moins 20 » et en rendait couramment 40 : une
   * liste qu'on ne lit plus, qu'on ne trie pas, et dont on garde tout par
   * lassitude — or ces mots pilotent la génération. Quinze se parcourent d'un
   * regard, et l'utilisateur en ajoute autant qu'il veut.
   *
   * Le plafond est appliqué APRÈS la réponse, pas seulement demandé dans la
   * consigne : une consigne est une intention, pas une garantie.
   */
  async generateKeywords(description: string, locale?: string): Promise<string[]> {
    const localeInstruction = locale
      ? `Generate keywords primarily in the language with code "${locale}", culturally adapted for that market. Include both native-language terms and commonly used English loanwords in this market.`
      : 'Generate keywords in English, suitable for an international audience.';

    try {
      const response = await this.mesurer('keywords', this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an SEO and semantics expert.
            Identify the ${KEYWORD_LIMIT} MOST RELEVANT keywords for the following description, ordered from most to least relevant.
            Vary the angles: synonyms, technical terms, user benefits, and abstract concepts related to the domain.
            Prefer precision over coverage: a shorter, sharper list is better than an exhaustive one.
            ${localeInstruction}
            Return ONLY a comma-separated list of words, no numbering.`,
          },
          { role: 'user', content: description },
        ],
        max_completion_tokens: 600,
        reasoning_effort: 'none',
      }));

      const content = response.choices[0].message.content;
      if (!content) return [];
      return dedupeKeywords(content.split(',')).slice(0, KEYWORD_LIMIT);
    } catch (error) {
      this.logger.error('Erreur lors de la génération des mots-clés:', error);
      throw error;
    }
  }

  /**
   * Extrait les contraintes de naming embarquées dans la description libre :
   * longueur souhaitée, mots à éviter, marques de référence. Robuste aux échecs
   * (retourne les valeurs par défaut). Un seul appel léger par recherche.
   */
  async extractNamingConstraints(description: string): Promise<NamingConstraints> {
    const prompt = `You extract naming constraints from a product description written by a user of a brand-name generator. The user often embeds naming instructions (desired length, "short", "X letters", brands to imitate like Qonto/Stripe/Figma, words to avoid).

Return ONLY JSON:
{"minLength": <int 3-12 or null>, "maxLength": <int 4-30 or null>, "avoidWords": ["..."], "referenceBrands": ["..."]}

Rules:
- If the user asks for a SHORT / "court" name, "X letters/lettres", or names "like/façon Qonto, Stripe, Figma, Notion", set minLength around 5 and maxLength to match the request (e.g. "5-8 letters" → min 5, max 8).
- If no length instruction, return null for minLength and maxLength.
- avoidWords: explicit words/roots the user says to avoid (e.g. "avoid: bet, sport, tech"). Lowercase. Empty array if none.
- referenceBrands: brand names cited as style references. Empty array if none.

Description: "${description.replace(/"/g, "'").slice(0, 800)}"`;

    try {
      const response = await this.mesurer('constraints', this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 300,
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
      }));
      const content = response.choices[0].message.content;
      if (!content) return { ...DEFAULT_CONSTRAINTS };
      const p = JSON.parse(content);

      const clamp = (v: any, lo: number, hi: number): number | null =>
        typeof v === 'number' && v >= lo && v <= hi ? Math.round(v) : null;
      let minLength = clamp(p.minLength, 3, 12);
      let maxLength = clamp(p.maxLength, 4, 30);
      // Cohérence min/max + garde-fous
      if (minLength && maxLength && minLength > maxLength) [minLength, maxLength] = [maxLength, minLength];
      const avoidWords = Array.isArray(p.avoidWords)
        ? p.avoidWords.map((w: any) => String(w).toLowerCase().trim()).filter((w: string) => w.length > 1).slice(0, 20)
        : [];
      const referenceBrands = Array.isArray(p.referenceBrands)
        ? p.referenceBrands.map((b: any) => String(b).trim()).filter((b: string) => b.length > 0).slice(0, 10)
        : [];

      const constraints: NamingConstraints = {
        minLength: minLength ?? DEFAULT_CONSTRAINTS.minLength,
        maxLength: maxLength ?? DEFAULT_CONSTRAINTS.maxLength,
        avoidWords,
        referenceBrands,
      };
      // Si min abaissé mais max resté au défaut, élargir un peu la fenêtre.
      if (minLength && !maxLength) constraints.maxLength = Math.max(minLength + 5, DEFAULT_CONSTRAINTS.maxLength);
      this.logger.log(`Contraintes naming: ${JSON.stringify(constraints)}`);
      return constraints;
    } catch (error) {
      this.logger.error('Erreur extraction contraintes naming:', error);
      return { ...DEFAULT_CONSTRAINTS };
    }
  }

  /** Construit le prompt « qui existe déjà sur ce marché ? ». */
  private competitorsPrompt(description: string, locale: string | undefined, live: boolean): string {
    const noteLang = locale
      ? `Write "note" in the language with code "${locale}".`
      : 'Write "note" in English.';

    const sourceRule = live
      ? `- Search the web first. Only list products you actually found in the search results, with the domain shown there.
- Prefer recent sources; skip anything you could not confirm.`
      : `- Only include companies you are genuinely confident exist with that exact domain. Skip any you are unsure about — an empty list is better than an invented one.`;

    return `You map the competitive landscape. For the project described below, list up to 8 REAL, EXISTING products or companies operating in the SAME space, with their actual main domain name.

Return ONLY JSON, no prose, no markdown fence: {"competitors": [{"name": "Qonto", "domain": "qonto.com", "note": "business banking for SMEs"}]}

Rules:
${sourceRule}
- Mix international leaders and, when relevant, local players for the described market.
- "note": max 6 words describing what the product does. ${noteLang}
- No duplicates, lowercase domains, no URL path.

Project: "${description.replace(/"/g, "'").slice(0, 800)}"`;
  }

  /** Extrait / normalise la liste de concurrents d'une réponse JSON brute. */
  private parseCompetitors(raw: string): { name: string; domain: string; note: string }[] {
    // Le modèle peut encadrer le JSON d'une fence markdown quand il utilise un outil.
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return [];

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return [];
    }
    const items: any[] = Array.isArray(parsed?.competitors) ? parsed.competitors : [];

    const seen = new Set<string>();
    return items
      .map(item => ({
        name: String(item?.name ?? '').trim().slice(0, 60),
        domain: String(item?.domain ?? '').trim().toLowerCase()
          .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''),
        note: String(item?.note ?? '').trim().slice(0, 80),
      }))
      .filter(c => {
        if (!c.name || !DOMAIN_REGEX.test(c.domain) || seen.has(c.domain)) return false;
        seen.add(c.domain);
        return true;
      })
      .slice(0, 8);
  }

  /**
   * Écarte les domaines qui ne sont enregistrés nulle part : un « concurrent »
   * dont le domaine est libre est forcément une invention du modèle.
   * On ne teste que les domaines à deux labels (whois ne répond pas sur un
   * sous-domaine type produit.exemple.com) — les autres passent tels quels.
   */
  private async dropUnregisteredDomains(
    competitors: Competitor[],
  ): Promise<Competitor[]> {
    const checks = await Promise.all(
      competitors.map(async (c) => {
        if (c.domain.split('.').length !== 2) return true;
        try {
          return !(await this.isDomainAvailable(c.domain));
        } catch {
          return true; // whois indisponible → on ne pénalise pas le résultat
        }
      }),
    );
    return competitors.filter((_, i) => checks[i]);
  }

  /**
   * Liste les produits/solutions existants du même secteur avec leur domaine.
   * Sert de repère avant la recherche : ce qui existe déjà, le ton du marché,
   * et ce qu'il ne faut pas imiter de trop près.
   *
   * Voie principale : recherche web en direct (outil `web_search` de l'API
   * Responses). Repli sur la connaissance du modèle si l'outil est indisponible.
   * Dans les deux cas, un contrôle whois écarte les domaines non enregistrés.
   * Jamais bloquant : renvoie une liste vide en cas d'échec.
   */
  async findSimilarProductDomains(
    description: string,
    locale?: string,
  ): Promise<CompetitorsResult> {
    const cached = this.competitorsFromCache(description, locale);
    if (cached) return cached;

    // 1) Recherche web en direct
    const startedAt = Date.now();
    try {
      const response = await this.mesurer('competitors', this.openai.responses.create({
        model: this.creativeModel,
        tools: [{ type: 'web_search' }],
        input: this.competitorsPrompt(description, locale, true),
        max_output_tokens: 1500,
        // L'appel le plus cher du produit était le seul à tourner à l'effort
        // de raisonnement par défaut du modèle. `low` le borne sans le
        // museler. Pas `none` : c'est le modèle qui décide d'appeler
        // `web_search`, et sans raisonnement il s'en dispense — on paierait
        // alors un appel outillé qui ne cherche rien, pour retomber sur le
        // repli. Le cas s'observe dans les logs : `source: 'model'` là où la
        // voie web a pourtant été tentée.
        reasoning: { effort: 'low' },
      }));
      const modelMs = Date.now() - startedAt;
      const usedWeb = response.output?.some((o: any) => o.type === 'web_search_call') ?? false;
      const competitors = this.parseCompetitors(response.output_text ?? '');
      if (competitors.length > 0) {
        const verifyStartedAt = Date.now();
        const verified = await this.dropUnregisteredDomains(competitors);
        // Ce découpage tranche une question précise : faut-il streamer cette
        // étape ? Si le temps est dans la recherche web (avant le moindre
        // token de réponse), un affichage progressif ne montrerait rien
        // pendant l'essentiel de l'attente.
        this.logger.log(`Concurrents : modèle ${modelMs} ms, vérification ${Date.now() - verifyStartedAt} ms, ${verified.length} retenus (web: ${usedWeb})`);
        return this.cacheCompetitors(description, locale, { competitors: verified, source: usedWeb ? 'web' : 'model' });
      }
      this.logger.warn('Recherche web des concurrents sans résultat exploitable — repli sur le modèle');
    } catch (error) {
      this.logger.error('Recherche web des concurrents indisponible, repli sur le modèle:', error);
    }

    // 2) Repli : connaissance du modèle
    try {
      const response = await this.mesurer('competitors', this.openai.chat.completions.create({
        model: this.creativeModel,
        messages: [{ role: 'user', content: this.competitorsPrompt(description, locale, false) }],
        max_completion_tokens: 800,
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
      }));
      const competitors = this.parseCompetitors(response.choices[0].message.content ?? '');
      return this.cacheCompetitors(description, locale, {
        competitors: await this.dropUnregisteredDomains(competitors),
        source: 'model',
      });
    } catch (error) {
      this.logger.error('Erreur recherche des produits similaires:', error);
      // Un échec n'est PAS mis en cache : la prochaine tentative doit pouvoir
      // réussir, sans quoi une panne passagère gèlerait une liste vide pour
      // vingt-quatre heures.
      return { competitors: [], source: 'model' };
    }
  }

  /** Clé du cache marché : même description, même langue, même réponse. */
  private competitorsKey(description: string, locale?: string): string {
    return `${locale ?? '-'} ${description.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  }

  private competitorsFromCache(description: string, locale?: string): CompetitorsResult | null {
    const entry = this.competitorsCache.get(this.competitorsKey(description, locale));
    if (!entry || Date.now() - entry.at > COMPETITORS_CACHE_TTL_MS) return null;
    this.logger.log(`Concurrents : servis depuis le cache (${entry.value.competitors.length} retenus)`);
    return entry.value;
  }

  /**
   * Retient le résultat et rend la main dessus, pour se poser en fin de `return`.
   *
   * Le cache est borné et purgé par ancienneté : une description est une
   * chaîne libre, donc une clé que n'importe quel appelant peut multiplier —
   * et les cinq endpoints de l'étape 1 sont publics.
   */
  private cacheCompetitors(description: string, locale: string | undefined, value: CompetitorsResult): CompetitorsResult {
    const now = Date.now();
    for (const [k, v] of this.competitorsCache) {
      if (now - v.at > COMPETITORS_CACHE_TTL_MS) this.competitorsCache.delete(k);
    }
    while (this.competitorsCache.size >= COMPETITORS_CACHE_MAX) {
      const oldest = this.competitorsCache.keys().next().value;
      if (oldest === undefined) break;
      this.competitorsCache.delete(oldest);
    }
    this.competitorsCache.set(this.competitorsKey(description, locale), { at: now, value });
    return value;
  }

  async generateDomainIdeas(
    description: string,
    keywords: string[],
    locale?: string,
    excludeNames: string[] = [],
    descriptiveNames = false,
    culturalNames = false,
    likedNames: string[] = [],
    dislikedNames: string[] = [],
    constraints: NamingConstraints = DEFAULT_CONSTRAINTS,
    competitorDomains: string[] = [],
    dislikedStyleDomains: string[] = [],
  ): Promise<{ name: string; style: string }[]> {
    const minLen = constraints.minLength;
    const maxLen = Math.max(constraints.maxLength, minLen + 2);
    const wantsShort = minLen < 7;
    // Assainir les keywords avant injection dans le prompt : supprimer les séquences
    // qui pourraient tromper le modèle (sauts de ligne, guillemets triples, etc.)
    const sanitizedKeywords = keywords.map(k =>
      k.replace(/[\r\n]+/g, ' ').replace(/`{3,}/g, '').trim().slice(0, 100)
    );
    const vocabStr = sanitizedKeywords.join(', ');
    const localeInstruction = locale
      ? `Names should resonate with a "${locale}"-language audience. Prefer names that are easy to pronounce in that language, and may incorporate roots, sounds, or cultural references familiar to its speakers. Local or regional words are encouraged alongside invented ones.`
      : 'Names should be internationally friendly — easy to pronounce for a global audience, preferring Anglo-Saxon or Latin roots.';

    // US-015 — cap at 200 to avoid token bloat
    const exclusionSection = excludeNames.length > 0
      ? `\nAlready tested — do NOT reproduce any of these names: ${excludeNames.slice(0, 200).join(', ')}\n`
      : '';

    // US-046 — user preference feedback to guide generation
    const feedbackSection = [
      likedNames.length > 0
        ? `\nThe user LIKED these names (use them as positive style references — generate names with a similar feel): ${likedNames.slice(0, 20).join(', ')}\n`
        : '',
      dislikedNames.length > 0
        ? `\nThe user DISLIKED these names (avoid regenerating them and avoid names that are phonetically or semantically similar): ${dislikedNames.slice(0, 20).join(', ')}\n`
        : '',
    ].join('');

    // #2 — contraintes extraites du brief : mots à éviter + marques de référence
    const constraintSection = [
      constraints.avoidWords.length > 0
        ? `\nHARD NEGATIVE CONSTRAINT — do NOT produce names that CONTAIN, start with, or clearly evoke any of these words/roots: ${constraints.avoidWords.join(', ')}.\n`
        : '',
      constraints.referenceBrands.length > 0
        ? `\nThe user wants names with a similar FEEL to these reference brands: ${constraints.referenceBrands.join(', ')}. Match their length, sound and premium vibe (but never copy them).\n`
        : '',
      // #4 — repères du marché : calibrer le ton sans ressembler aux acteurs en place
      competitorDomains.length > 0
        ? `\nExisting products in this market already use these domains: ${competitorDomains.slice(0, 12).join(', ')}. Use them ONLY to calibrate the tone and level of the sector. Do NOT generate names that are confusingly similar to any of them (same root, same distinctive prefix/suffix, or a near-anagram) — the goal is to stand out from them.\n`
        : '',
      // #4 — styles que l'utilisateur a explicitement écartés en parcourant le marché
      dislikedStyleDomains.length > 0
        ? `\nThe user reviewed the market and explicitly REJECTED the style of these names: ${dislikedStyleDomains.slice(0, 12).join(', ')}. Avoid names sharing their feel, structure, sound or naming pattern. This is a strong signal about the user's taste.\n`
        : '',
    ].join('');

    // US-032 — calculate proportions across active styles
    const activeStyles = ['standard', ...(descriptiveNames ? ['descriptive'] : []), ...(culturalNames ? ['cultural'] : [])];
    const total = 30;
    const perStyle = Math.floor(total / activeStyles.length);
    const counts = Object.fromEntries(activeStyles.map((s, i) => [s, i < total % activeStyles.length ? perStyle + 1 : perStyle]));

    const styleInstructions: string[] = [];

    // US-044 — diversité imposée par sous-groupes pour le style standard
    const stdCount = counts['standard'];
    const subShort   = Math.ceil(stdCount * 0.25); // noms courts inventés 7-9 chars
    const subCompound = Math.ceil(stdCount * 0.25); // mots composés (2 racines fusionnées)
    const subMetaphor = Math.ceil(stdCount * 0.25); // métaphore / concept évocateur
    const subSound    = stdCount - subShort - subCompound - subMetaphor; // sonorité / phonie

    // #1 — longueur adaptative : bornes dérivées des contraintes utilisateur.
    const shortHi = Math.min(minLen + 2, maxLen);
    const compoundLo = Math.min(minLen + 1, maxLen);
    const metaHi = Math.min(minLen + 3, maxLen);
    const lengthRule = wantsShort
      ? `- LENGTH: minimum ${minLen}, maximum ${maxLen} characters. The user EXPLICITLY wants SHORT, invented, premium names (in the spirit of Qonto, Stripe, Figma, Notion). Favor rare / uncommon letter combinations and unusual sounds to maximize the chance the domain is still available at this short length.`
      : `- MINIMUM ${minLen} characters, MAXIMUM ${maxLen} characters. CRITICAL: names under ${minLen} characters are almost always already registered and must NOT be generated.`;
    const shortExamples = wantsShort ? '"orva", "nyxo", "veli", "zuvo", "karos"' : '"treloxy", "voxifyn", "lumiqar", "namifex"';
    const badShort = wantsShort ? '' : ', "trelox", "voxify", "namify" (too short — under ' + minLen + ' chars)';

    styleInstructions.push(`
=== STYLE "standard" (generate exactly ${stdCount} names) ===
Classic startup-style brand names. Rules:
- Lowercase only, NO hyphens, NO numbers.
${lengthRule}
- Must pass the "radio test" (heard once → spelled correctly).
- MUST draw inspiration from the semantic keywords below — at least half the names must incorporate a keyword root, sound, or concept.

Distribute the ${stdCount} names across these 4 sub-groups:
  [short] ${subShort} names — concise invented words, ${minLen}-${shortHi} characters, 2 syllables. Examples: ${shortExamples}
  [compound] ${subCompound} names — two keyword roots fused without separator, ${compoundLo}-${maxLen} characters. Examples: "snapflow", "taskbloom", "brandnest"
  [metaphor] ${subMetaphor} names — abstract concept or vivid image tied to the product's benefit, ${minLen}-${metaHi} characters. Examples: "veloria", "zephyra", "aurelix"
  [sound] ${subSound} names — names chosen primarily for their phonetic appeal and memorability, ${minLen}-${metaHi} characters. Examples: "navioq", "kalivo", "pivoxen"

BAD examples (do NOT generate these kinds): "smartapp", "webtools", "clicksolution", "mybrand" (too generic), "xqtzpr" (unpronounceable)${badShort}.
${localeInstruction}`);

    if (descriptiveNames) {
      styleInstructions.push(`
=== STYLE "descriptive" (generate exactly ${counts['descriptive']} names) ===
Descriptive domain names targeting local/regional markets. Criteria:
- Can be LONGER (up to 28 characters), NO HYPHENS, no numbers, lowercase only.
- Must CLEARLY DESCRIBE the business activity and optionally a geographic reference (infer from description).
- Compound words without hyphens, or a single descriptive word.
- Must sound natural in the target language.
- GOOD examples: boulangerieprovence, plombierlyon, menuiseriebretagne
- BAD examples: service-pro, my-business (hyphens not allowed)`);
    }

    if (culturalNames) {
      styleInstructions.push(`
=== STYLE "cultural" (generate exactly ${counts['cultural']} names) ===
Domain names referencing public domain cultural works, characters, places, or folklore. Criteria:
- May reference fairy tales, mythology, fables, classic literature, historical figures (public domain only).
- NO HYPHENS — merge words into a single compound name. Lowercase only, no numbers.
- Strong, memorable cultural references tied to the project spirit.
- GOOD examples: petitpoucet, herculeplomberie, cendrillonmode
- BAD examples: petit-poucet, hercule-pro (hyphens not allowed)`);
    }

    const prompt = `You are a world-class branding and naming expert.
Generate ORIGINAL domain-name bases for the following project.

Description: "${description}"
Semantic keywords to draw from: ${vocabStr}
${exclusionSection}${feedbackSection}${constraintSection}
${styleInstructions.join('\n')}

IMPORTANT RULES:
- Generate exactly the number of names specified per style (total: ${total}).
- Each object must have a "style" field matching its style key exactly ("standard", "descriptive", or "cultural").
- "standard" names: lowercase letters only, no hyphens, no numbers, no spaces.
- "descriptive" and "cultural" names: lowercase only, NO hyphens, no numbers.

Respond ONLY with a JSON object. Example:
{"names": [{"name": "velora", "style": "standard"}, {"name": "boulangerieprovence", "style": "descriptive"}, {"name": "petitpoucet", "style": "cultural"}]}`;

    try {
      const response = await this.mesurer('generate_names', this.openai.chat.completions.create({
        model: this.creativeModel,
        messages: [{ role: 'user', content: prompt }],
        // Budget élargi : couvre les tokens de raisonnement + le JSON de ~30 noms.
        max_completion_tokens: 4000,
        // 'none' : la génération tourne en boucle (jusqu'à 5×) → on privilégie la
        // latence. terra produit d'excellents noms sans raisonnement.
        reasoning_effort: 'none',
        response_format: { type: 'json_object' }
      }));

      const content = response.choices[0].message.content;
      if (!content) return [];

      const parsed = JSON.parse(content);
      const items: { name: string; style?: string }[] = parsed.names || [];

      const CLEANED_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
      // #1 — borne basse = contrainte utilisateur (défaut 7). Les noms descriptifs/culturels
      // peuvent être plus longs, donc on ne borne le bas que par minLen.
      const lowerBound = Math.min(minLen, 7);
      const avoid = constraints.avoidWords;
      return items
        .map(item => {
          const style = activeStyles.includes(item.style ?? '') ? (item.style ?? 'standard') : 'standard';
          const cleaned = style === 'standard'
            ? item.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
            : item.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
          return { name: cleaned, style };
        })
        .filter(item =>
          item.name.length >= lowerBound &&
          // #1 — le style "standard" respecte la longueur max demandée (+1 de tolérance) ;
          // descriptif/culturel restent bornés par la limite DNS.
          item.name.length <= (item.style === 'standard' ? maxLen + 1 : 63) &&
          CLEANED_NAME_REGEX.test(item.name) &&
          // #2 — filet de sécurité : rejeter les noms contenant un mot à éviter
          !avoid.some(w => w.length > 2 && item.name.includes(w)),
        );
    } catch (error) {
      this.logger.error('Erreur lors de la génération des noms:', error);
      return [];
    }
  }

  /**
   * Note un nom sur cinq critères. Enveloppe d'`analyzeNames` à un seul nom,
   * conservée pour le rapport de marque, qui n'en juge jamais qu'un.
   *
   * Lève si le modèle n'a rien rendu d'exploitable : l'appelant attend une
   * analyse ou une erreur, pas une chaîne vide qui s'afficherait en panneau
   * blanc.
   */
  async analyzeNameWithAI(name: string, lang = 'en'): Promise<string> {
    const analysis = (await this.analyzeNames([name], lang)).get(name);
    if (!analysis) throw new Error(`Analyse indisponible pour « ${name} »`);
    return analysis;
  }

  /**
   * Note plusieurs noms **en un seul appel**, et rend une analyse par nom.
   *
   * La consigne, le barème et le gabarit JSON pèsent ~165 tokens d'entrée et
   * ne dépendent pas du nom : les payer une fois par nom, c'était acheter dix
   * fois la même chose. Seule la sortie est vraiment proportionnelle.
   *
   * Les noms absents de la réponse sont absents de la Map : aucun repli
   * fabriqué localement, parce qu'une note inventée se lirait exactement
   * comme une note du modèle. L'appelant retombe sur son bouton « Analyser ».
   *
   * La valeur rendue garde **le format d'un nom seul** (`{lang, scores,
   * comments, origin, strengths, watchout}`) : c'est ce que le front a en
   * base sur des milliers de suggestions et ce que `parseAnalysisHtml` sait
   * lire. Le regroupement est une affaire de transport, pas de stockage.
   */
  async analyzeNames(names: string[], lang = 'en'): Promise<Map<string, string>> {
    const uniques = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    if (uniques.length === 0) return new Map();

    // Découpé parce que la SORTIE est bornée, pas l'entrée : un lot trop
    // grand fait tronquer le JSON, et un JSON tronqué ne rend pas un nom de
    // moins — il ne rend rien du tout.
    const lots: string[][] = [];
    for (let i = 0; i < uniques.length; i += ANALYSES_PAR_APPEL) {
      lots.push(uniques.slice(i, i + ANALYSES_PAR_APPEL));
    }

    const resultats = new Map<string, string>();
    const parLot = await Promise.all(lots.map((lot) => this.analyzeLot(lot, lang)));
    for (const lot of parLot) for (const [nom, analyse] of lot) resultats.set(nom, analyse);
    return resultats;
  }

  /** Un appel au modèle, pour un lot déjà borné. Best-effort : rend une Map vide en cas d'échec. */
  private async analyzeLot(names: string[], lang: string): Promise<Map<string, string>> {
    const prompt = `Analyze each brand/domain name below across these 5 criteria. Respond in the language with code "${lang}". Return ONLY valid JSON, no text outside it:

{
  "analyses": [
    {
      "name": "<the name, copied verbatim from the list>",
      "scores": { "memorability": 4, "pronunciation": 3, "international": 5, "seo": 3, "distinctiveness": 4 },
      "comments": { "memorability": "...", "pronunciation": "...", "international": "...", "seo": "...", "distinctiveness": "..." },
      "origin": "max 18 words",
      "strengths": "max 15 words",
      "watchout": "max 15 words"
    }
  ]
}

Scores are integers 1-5. Be honest and concise.
Judge each name ON ITS OWN MERITS, never relative to the others in the list — the list is a batch, not a ranking.
Return exactly one object per name, in the same order, with "name" copied character for character.
"origin": how the name is built and what it evokes — the roots or words it combines, and the impression it leaves. One sentence, no marketing adjectives.

Names:
${names.map((n) => `- ${n}`).join('\n')}`;

    try {
      const response = await this.mesurer('analyze', this.openai.chat.completions.create({
        model: this.analysisModel,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 200 + TOKENS_PAR_ANALYSE * names.length,
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
      }), names.length);
      return this.parseAnalyses(response.choices[0].message.content ?? '', names, lang);
    } catch (error) {
      this.logger.error(`Erreur analyse IA pour ${names.length} nom(s) :`, error);
      return new Map();
    }
  }

  /**
   * Rattache chaque analyse à son nom, et n'invente jamais le rattachement.
   *
   * Le modèle recopie le nom, mais peut changer la casse ou ajouter une
   * extension. On tolère donc la comparaison sans casse, et RIEN d'autre :
   * pas de repli sur la position dans la liste, qui donnerait à un nom les
   * qualités d'un autre — l'erreur la plus coûteuse ici, parce qu'elle est
   * invisible.
   */
  private parseAnalyses(raw: string, names: string[], lang: string): Map<string, string> {
    const resultats = new Map<string, string>();
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(`Analyse groupée : réponse illisible (${raw.length} caractères)`);
      return resultats;
    }

    const attendus = new Map(names.map((n) => [n.toLowerCase(), n]));
    const items: any[] = Array.isArray(parsed?.analyses) ? parsed.analyses : [];
    for (const item of items) {
      const nom = attendus.get(String(item?.name ?? '').trim().toLowerCase());
      if (!nom || resultats.has(nom)) continue;
      if (!item?.scores || typeof item.scores !== 'object') continue;
      // `lang` est posé ici, pas demandé au modèle : le front s'en sert pour
      // décider s'il régénère l'analyse dans une autre langue. Le laisser
      // produire ce champ, c'est accepter qu'il se trompe sur la seule
      // information dont on connaît la valeur avec certitude.
      resultats.set(nom, JSON.stringify({
        lang,
        scores: item.scores,
        comments: item.comments && typeof item.comments === 'object' ? item.comments : undefined,
        origin: typeof item.origin === 'string' ? item.origin : undefined,
        strengths: typeof item.strengths === 'string' ? item.strengths : undefined,
        watchout: typeof item.watchout === 'string' ? item.watchout : undefined,
      }));
    }

    if (resultats.size < names.length) {
      this.logger.warn(`Analyse groupée : ${resultats.size}/${names.length} noms rendus par le modèle`);
    }
    return resultats;
  }

  async pickBestDomain(
    candidates: { name: string; analysis: string | null; extensions: Record<string, boolean | null> }[],
    lang?: string,
  ): Promise<{ recommended: string; reason: string }> {
    const list = candidates.map((c, i) => {
      const available = Object.entries(c.extensions)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
        .join(', ') || 'none';
      const analysis = c.analysis ? c.analysis.slice(0, 400) : 'No analysis yet.';
      return `${i + 1}. "${c.name}" — available on: ${available}\n   ${analysis}`;
    }).join('\n\n');

    const LANG_NAMES: Record<string, string> = {
      fr: 'French', en: 'English', de: 'German', es: 'Spanish',
      it: 'Italian', nl: 'Dutch', pt: 'Portuguese', pl: 'Polish',
    };
    const langInstruction = `Write the reason in ${LANG_NAMES[lang ?? ''] ?? 'English'}.`;

    const prompt = `You are a branding expert helping a user choose the best domain name from their shortlist.

Candidates:
${list}

Pick the single best name. Consider: memorability, pronounceability, brand strength, and extension availability.
Respond ONLY in JSON: {"recommended": "thename", "reason": "2-3 sentences explaining why this name stands out over the others."}
${langInstruction}`;

    try {
      const response = await this.mesurer('pick_best', this.openai.chat.completions.create({
        model: this.creativeModel,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 600,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
      }));
      const content = response.choices[0].message.content;
      if (!content) throw new Error('Empty response');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Erreur pick-best:', error);
      throw error;
    }
  }

  /**
   * `true` libre, `false` pris, **`null` : impossible à déterminer**.
   *
   * Le troisième état n'est pas un raffinement : sans lui, une panne de WHOIS
   * se présente comme un domaine pris. C'est ce qui est arrivé à `.app`, dont
   * le serveur port 43 a été retiré au profit de RDAP — `whois.nic.app` est en
   * NXDOMAIN, la commande échoue sans rien écrire sur stdout, et l'ancien code
   * répondait « pris ». En mode « toutes les extensions », plus aucun candidat
   * ne pouvait alors matcher : recherche à zéro résultat, en silence.
   *
   * Un doute doit rester visible plutôt que de se déguiser en réponse.
   */
  async isDomainAvailable(domain: string, compteur?: SourcesVerdict): Promise<boolean | null> {
    validateDomain(domain);
    const tld = domain.slice(domain.lastIndexOf('.') + 1);

    if (await this.deleguéDansLeDns(domain, tld)) {
      if (compteur) compteur.dns++;
      return false;
    }

    if (compteur) compteur.registre++;
    return this.withRegistryGate(tld, () => this.probe(domain));
  }

  /**
   * Pré-filtre : ce domaine a-t-il des serveurs de noms ?
   *
   * Un domaine délégué EST enregistré — la délégation vient de la zone du
   * registre, il n'y a pas d'autre façon d'y figurer. La réciproque est fausse
   * (un domaine déposé sans être configuré n'a pas de NS), donc l'absence de
   * délégation ne conclut rien : on passe au registre, comme avant. Le
   * pré-filtre ne produit donc JAMAIS un « libre » — seulement des « pris »,
   * pour 20 ms au lieu de 300 à 1 300.
   *
   * C'est ce qui rend une recherche longue supportable : le RDAP de l'AFNIC
   * part à 100 ms par domaine et tombe à 1,3 s une fois son limiteur refermé —
   * mesuré depuis la production, 12 domaines à quatre requêtes parallèles :
   * 1,2 s au premier essai, 15,6 s au troisième. Chaque candidat écarté sans
   * l'interroger est autant de marge rendue à ceux qu'il faut vraiment lui
   * soumettre.
   *
   * Toute erreur (résolveur injoignable, délai dépassé, NXDOMAIN) vaut « je ne
   * sais pas » et renvoie au registre : le pré-filtre accélère, il ne décide
   * pas.
   */
  private async deleguéDansLeDns(domain: string, tld: string): Promise<boolean> {
    try {
      if (!(await this.prefiltreUtilisable(tld))) return false;
      const ns = await this.dnsResolver.resolveNs(domain);
      return ns.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Le pré-filtre est-il fiable pour ce TLD ?
   *
   * Certains registres répondent à N'IMPORTE QUEL nom (joker de zone) : tout y
   * paraîtrait pris, et la recherche ne rendrait plus rien. On interroge donc
   * une fois par TLD un nom témoin aléatoire, qui ne peut pas être enregistré.
   * S'il répond, le pré-filtre est désactivé pour ce TLD — définitivement, le
   * temps du processus.
   */
  private prefiltreUtilisable(tld: string): Promise<boolean> {
    let verdict = this.dnsUtilisable.get(tld);
    if (!verdict) {
      const temoin = `nm-temoin-${Math.random().toString(36).slice(2, 12)}.${tld}`;
      verdict = this.dnsResolver
        .resolveNs(temoin)
        .then((ns) => {
          if (ns.length > 0) {
            this.logger.warn(`Pré-filtre DNS désactivé pour .${tld} : le registre répond à un nom inexistant (joker de zone)`);
            return false;
          }
          return true;
        })
        .catch(() => true); // Pas de réponse pour un nom inexistant : c'est le comportement attendu.
      this.dnsUtilisable.set(tld, verdict);
    }
    return verdict;
  }

  /**
   * Limite le nombre de vérifications simultanées vers un même registre.
   *
   * Les extensions différentes ne se gênent pas entre elles : chacune a sa
   * file, et une recherche sur cinq extensions garde donc cinq flux parallèles.
   */
  private async withRegistryGate<T>(tld: string, task: () => Promise<T>): Promise<T> {
    let gate = this.registryGates.get(tld);
    if (!gate) {
      gate = { active: 0, queue: [] };
      this.registryGates.set(tld, gate);
    }

    if (gate.active >= PER_REGISTRY_CONCURRENCY) {
      // La place est *transmise* par le sortant, qui ne décrémente pas : entre
      // un décrément et la reprise effective de l'attendant, un nouvel appelant
      // se glisserait sinon dans l'intervalle et la limite serait dépassée.
      await new Promise<void>(resolve => gate!.queue.push(resolve));
    } else {
      gate.active++;
    }

    try {
      return await task();
    } finally {
      const next = gate.queue.shift();
      if (next) next();
      else gate.active--;
    }
  }

  /**
   * Disponibilité d'un nom sur les extensions demandées.
   *
   * En mode « toutes les extensions », une seule extension prise suffit à
   * écarter le candidat : on interroge alors les registres l'un après l'autre
   * et on s'arrête au premier refus, au lieu des cinq requêtes systématiques
   * d'avant. Le candidat écarté n'étant jamais affiché, les extensions non
   * interrogées ne manquent à personne — et ces requêtes économisées sont
   * autant de marge sur les quotas des registres.
   *
   * En mode « au moins une », le tableau de résultats montre chaque extension :
   * il faut donc toutes les vérifier, et autant le faire en parallèle.
   */
  private async checkExtensions(
    name: string,
    extensions: string[],
    matchMode: MatchMode,
    compteur?: SourcesVerdict,
  ): Promise<Record<string, boolean | null>> {
    const extStatus: Record<string, boolean | null> = {};

    if (matchMode === MatchMode.ALL) {
      for (const ext of extensions) {
        const status = await this.isDomainAvailable(`${name}${ext}`, compteur);
        extStatus[ext] = status;
        if (status === false) break;
      }
      return extStatus;
    }

    await Promise.all(extensions.map(async (ext) => {
      extStatus[ext] = await this.isDomainAvailable(`${name}${ext}`, compteur);
    }));
    return extStatus;
  }

  private async probe(domain: string): Promise<boolean | null> {
    const tld = domain.slice(domain.lastIndexOf('.') + 1);
    if (WHOIS_AVANT_RDAP.has(tld)) {
      const viaWhois = await this.probeWhois(domain);
      if (viaWhois !== null) return viaWhois;
      return this.rdap.lookup(domain);
    }
    return this.probeRdapPuisWhois(domain);
  }

  private async probeRdapPuisWhois(domain: string): Promise<boolean | null> {
    // RDAP d'abord : verdict par code HTTP, pas de motif à deviner, pas de
    // quota atteint dès la deuxième requête. Il ne couvre pas tous les TLD
    // (les ccTLD n'y sont pas obligés), d'où le repli WHOIS juste en dessous.
    const viaRdap = await this.rdap.lookup(domain);
    if (viaRdap !== null) return viaRdap;
    return this.probeWhois(domain);
  }

  private async probeWhois(domain: string): Promise<boolean | null> {
    try {
      const { stdout } = await execFileAsync('whois', [domain], { timeout: 10000 });
      return this.readWhois(stdout);
    } catch (error: any) {
      // Un code de sortie non nul n'est pas l'absence de réponse : `whois`
      // sort en erreur sur un .com libre tout en écrivant « No match for
      // domain » sur stdout. On relit donc stdout avant de conclure.
      return this.readWhois(error.stdout ?? '');
    }
  }

  /**
   * Interprète une réponse WHOIS brute. Chaque registre a son vocabulaire ;
   * l'ordre compte, car une réponse « libre » de .de ou .it contient elle aussi
   * une ligne `Domain:`, qui ne devient un indice de domaine pris qu'une fois
   * les marqueurs de disponibilité écartés.
   */
  private readWhois(raw: string): boolean | null {
    // Chaque registre aligne ses champs à sa façon : espaces et tabulations
    // (« Status:        AVAILABLE » chez .it et .be), points de conduite
    // (« domain.........: » chez .fi et .no). Sans normalisation, aucun motif
    // ne matche et un domaine pris ressort comme indéterminé.
    const output = raw.toLowerCase()
      .replace(/\.{2,}/g, '')
      .replace(/[^\S\n]+/g, ' ');
    if (!output.trim()) return null;

    // Disponibilité d'abord — certains TLD (.io, .co) décrivent le registre
    // lui-même avant d'annoncer que le domaine, lui, est libre.
    const availablePatterns = [
      'no match',
      'not found',
      'no entries found',
      'no data found',
      'no object found',
      'nothing found',
      'no information available',
      'no information was found',
      'status: available',
      'status: free',
      'domain not found',
      'is available',
      'is free',
    ];
    if (availablePatterns.some(p => output.includes(p))) return true;

    // .africa répond par le seul mot « Available ». Comparaison ligne à ligne :
    // le mot isolé se retrouve aussi dans les mentions légales des réponses
    // « pris », où il ne signifie rien.
    if (output.split('\n').some(line => line.trim() === 'available')) return true;

    const takenPatterns = [
      'domain name:',
      'domain:',
      'registrar:',
      'creation date:',
      'registry domain id:',
      'status: connect',
      'status: registered',
      // .jp présente ses champs entre crochets plutôt qu'en « clé: valeur ».
      '[domain name]',
      'domain information:',
      'reserved',
    ];
    if (takenPatterns.some(p => output.includes(p))) return false;

    // Rien de reconnaissable. Les causes sont réelles et croissantes : serveur
    // port 43 retiré au profit de RDAP (.app, .dev, .shop depuis mai 2026),
    // registre qui refuse nos requêtes (.ch), TLD sans WHOIS du tout (.es),
    // quota dépassé. Aucune des deux réponses binaires n'est acceptable ici :
    // « pris » masquerait des noms libres, « libre » ferait payer un crédit
    // pour un domaine déjà enregistré.
    return null;
  }

  async recheckAvailability(
    names: string[],
    extensions: string[],
  ): Promise<{ name: string; allExtensions: Record<string, boolean | null> }[]> {
    return Promise.all(
      names.map(async (name) => {
        const extStatus: Record<string, boolean | null> = {};
        await Promise.all(
          extensions.map(async (ext) => {
            extStatus[ext] = await this.isDomainAvailable(`${name}${ext}`);
          }),
        );
        return { name, allExtensions: extStatus };
      }),
    );
  }

  async findAvailableDomains(
    description: string,
    keywords: string[],
    options: FindDomainsOptions = {},
  ): Promise<{ results: any[], totalChecked: number, minLengthUsed: number, unresolved: Record<string, number>, sources: SourcesVerdict }> {
    const {
      targetCount = 10,
      extensions = ['.com'],
      matchMode = MatchMode.ANY,
      locale,
      excludeNames = [],
      onEvent,
      descriptiveNames = false,
      culturalNames = false,
      likedNames = [],
      dislikedNames = [],
      minLength,
      likedExamples = [],
      competitorDomains = [],
      dislikedStyleDomains = [],
    } = options;

    const finalResults: any[] = [];
    // US-015 — pre-seed with already-evaluated names so the LLM never re-proposes them
    const checkedNames = new Set<string>(excludeNames);
    /** Vérifications non concluantes, par extension : remontées dans les logs. */
    const unresolved = new Map<string, number>();
    let attempts = 0;
    const maxAttempts = 5;

    // #1/#2 — extraire une seule fois les contraintes de naming du brief libre
    const constraints = await this.extractNamingConstraints(description);

    // #1 — le réglage explicite de l'UI prime sur la longueur devinée depuis le brief.
    if (typeof minLength === 'number') {
      constraints.minLength = Math.min(Math.max(Math.round(minLength), MIN_NAME_LENGTH_FLOOR), MAX_NAME_LENGTH_FLOOR);
      constraints.maxLength = Math.max(constraints.maxLength, constraints.minLength + 3);
    }
    // #3 — les exemples de noms aimés rejoignent les références de style
    if (likedExamples.length > 0) {
      constraints.referenceBrands = [...new Set([...constraints.referenceBrands, ...likedExamples])].slice(0, 15);
    }

    // Combien de verdicts le pré-filtre DNS a évité au registre : sans ce
    // décompte, on ne saurait pas si le raccourci sert vraiment, ni quand un
    // registre commence à répondre à tout.
    const sources: SourcesVerdict = { dns: 0, registre: 0 };

    while (finalResults.length < targetCount && attempts < maxAttempts) {
      onEvent?.({ type: 'generating' });
      const items = await this.generateDomainIdeas(description, keywords, locale, [...checkedNames], descriptiveNames, culturalNames, likedNames, dislikedNames, constraints, competitorDomains, dislikedStyleDomains);

      const newItems = items.filter(item => !checkedNames.has(item.name));
      newItems.forEach(item => checkedNames.add(item.name));

      if (newItems.length === 0) {
        attempts++;
        continue;
      }

      // Les candidats sont évalués par un petit groupe de travailleurs qui
      // puisent dans la même file : dès qu'un nom est tranché, le suivant part,
      // sans attendre les autres. Le compte des résultats est relu après chaque
      // `await`, si bien qu'on ne dépasse jamais targetCount — et donc jamais
      // le nombre de crédits que l'utilisateur a acceptés de dépenser.
      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(CANDIDATE_CONCURRENCY, newItems.length) },
        async () => {
          while (finalResults.length < targetCount) {
            const item = newItems[cursor++];
            if (!item) return;

            onEvent?.({ type: 'candidate', name: item.name, checkedSoFar: checkedNames.size });

            const extStatus = await this.checkExtensions(item.name, extensions, matchMode, sources);

            const availableExts = Object.keys(extStatus).filter(ext => extStatus[ext] === true);
            // Extensions dont la disponibilité n'a pas pu être établie : elles
            // ne doivent ni valider ni invalider un candidat, seulement se
            // signaler.
            const unknownExts = Object.keys(extStatus).filter(ext => extStatus[ext] === null);
            unknownExts.forEach(ext => unresolved.set(ext, (unresolved.get(ext) ?? 0) + 1));

            let isMatch: boolean;
            if (matchMode === MatchMode.ALL) {
              // « Toutes les extensions » porte sur celles qu'on a su vérifier :
              // un registre en panne ne doit pas rendre la recherche infructueuse.
              // Un candidat abandonné en cours de route a forcément une
              // extension prise, donc moins d'entrées que d'extensions.
              const checked = Object.keys(extStatus).length;
              isMatch = checked === extensions.length
                && availableExts.length > 0
                && availableExts.length === checked - unknownExts.length;
            } else {
              isMatch = availableExts.length > 0;
            }

            if (isMatch && finalResults.length < targetCount) {
              const domain = { name: item.name, style: item.style, availableExtensions: availableExts, allExtensions: extStatus };
              finalResults.push(domain);
              onEvent?.({ type: 'result', domain });
            }
          }
        },
      );
      await Promise.all(workers);
      attempts++;
    }

    return {
      results: finalResults,
      totalChecked: checkedNames.size,
      // Longueur mini réellement appliquée (réglage UI ou déduite du brief) —
      // le front s'en sert pour proposer de l'assouplir quand rien n'est trouvé.
      minLengthUsed: constraints.minLength,
      // Sans ce décompte, une panne de WHOIS se lit comme un marché saturé.
      unresolved: Object.fromEntries(unresolved),
      sources,
    };
  }
}