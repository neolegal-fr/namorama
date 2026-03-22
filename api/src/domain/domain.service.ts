import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { MatchMode } from './dto/search-domains.dto';

const execFileAsync = promisify(execFile);

const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9-]{1,61})+$/;

function validateDomain(domain: string): void {
  if (!DOMAIN_REGEX.test(domain)) {
    throw new BadRequestException(`Invalid domain: ${domain}`);
  }
}

@Injectable()
export class DomainService {
  private readonly logger = new Logger(DomainService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async refineDescription(description: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en marketing et branding. Reformule et complète la description suivante pour en extraire l\'essence et la valeur ajoutée du produit. Sois concis mais percutant.',
          },
          { role: 'user', content: description },
        ],
        max_tokens: 200,
      });

      return response.choices[0].message.content?.trim() ?? '';
    } catch (error) {
      this.logger.error('Erreur lors de la reformulation IA:', error);
      throw error;
    }
  }

  async suggestProjectName(description: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en branding. Suggère UNIQUEMENT un seul mot (nom propre ou mot inventé) qui soit extrêmement évocateur, moderne et mémorisable pour le projet décrit. Pas de ponctuation, pas de phrase.',
          },
          { role: 'user', content: description },
        ],
        max_tokens: 10,
      });

      return response.choices[0].message.content?.trim().replace(/[^a-zA-Z0-9]/g, '') ?? '';
    } catch (error) {
      this.logger.error('Erreur lors de la suggestion du nom de projet:', error);
      return '';
    }
  }

  async generateKeywords(description: string, locale?: string): Promise<string[]> {
    const localeInstruction = locale
      ? `Generate keywords primarily in the language with code "${locale}", culturally adapted for that market. Include both native-language terms and commonly used English loanwords in this market.`
      : 'Generate keywords in English, suitable for an international audience.';

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an SEO and semantics expert.
            Identify AT LEAST 20 relevant keywords and associated terms for the following description.
            Vary the angles: synonyms, technical terms, user benefits, and abstract concepts related to the domain.
            ${localeInstruction}
            Return ONLY a comma-separated list of words, no numbering.`,
          },
          { role: 'user', content: description },
        ],
        max_tokens: 300,
        temperature: 0.8,
      });

      const content = response.choices[0].message.content;
      if (!content) return [];
      return content.split(',').map(k => k.trim()).filter(k => k.length > 0);
    } catch (error) {
      this.logger.error('Erreur lors de la génération des mots-clés:', error);
      throw error;
    }
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
  ): Promise<{ name: string; style: string }[]> {
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

    styleInstructions.push(`
=== STYLE "standard" (generate exactly ${stdCount} names) ===
Classic startup-style brand names. Rules:
- Lowercase only, NO hyphens, NO numbers.
- MINIMUM 7 characters, MAXIMUM 12 characters. CRITICAL: names under 7 characters are almost always already registered and must NOT be generated.
- Must pass the "radio test" (heard once → spelled correctly).
- MUST draw inspiration from the semantic keywords below — at least half the names must incorporate a keyword root, sound, or concept.

Distribute the ${stdCount} names across these 4 sub-groups:
  [short] ${subShort} names — concise invented words, 7-9 characters, 2 syllables. Examples: "treloxy", "voxifyn", "lumiqar", "namifex"
  [compound] ${subCompound} names — two keyword roots fused without separator, 7-12 characters. Examples: "snapflow", "taskbloom", "brandnest"
  [metaphor] ${subMetaphor} names — abstract concept or vivid image tied to the product's benefit, 6-10 characters. Examples: "veloria", "zephyra", "aurelix"
  [sound] ${subSound} names — names chosen primarily for their phonetic appeal and memorability, 6-10 characters. Examples: "navioq", "kalivo", "pivoxen"

BAD examples (do NOT generate these kinds): "smartapp", "webtools", "clicksolution", "mybrand" (too generic), "xqtzpr" (unpronounceable), "trelox", "voxify", "namify" (too short — under 7 chars).
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
${exclusionSection}${feedbackSection}
${styleInstructions.join('\n')}

IMPORTANT RULES:
- Generate exactly the number of names specified per style (total: ${total}).
- Each object must have a "style" field matching its style key exactly ("standard", "descriptive", or "cultural").
- "standard" names: lowercase letters only, no hyphens, no numbers, no spaces.
- "descriptive" and "cultural" names: lowercase only, NO hyphens, no numbers.

Respond ONLY with a JSON object. Example:
{"names": [{"name": "velora", "style": "standard"}, {"name": "boulangerieprovence", "style": "descriptive"}, {"name": "petitpoucet", "style": "cultural"}]}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.85,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) return [];

      const parsed = JSON.parse(content);
      const items: { name: string; style?: string }[] = parsed.names || [];

      const CLEANED_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
      return items
        .map(item => {
          const style = activeStyles.includes(item.style ?? '') ? (item.style ?? 'standard') : 'standard';
          const cleaned = style === 'standard'
            ? item.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
            : item.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
          return { name: cleaned, style };
        })
        .filter(item => item.name.length >= 7 && item.name.length <= 63 && CLEANED_NAME_REGEX.test(item.name));
    } catch (error) {
      this.logger.error('Erreur lors de la génération des noms:', error);
      return [];
    }
  }

  async analyzeNameWithAI(name: string, lang = 'en'): Promise<string> {
    const prompt = `Analyze the brand/domain name "${name}" across these 5 criteria. Respond in the language with code "${lang}". Return ONLY valid JSON, no text outside it:

{
  "lang": "${lang}",
  "scores": { "memorability": 4, "pronunciation": 3, "international": 5, "seo": 3, "distinctiveness": 4 },
  "comments": { "memorability": "...", "pronunciation": "...", "international": "...", "seo": "...", "distinctiveness": "..." },
  "strengths": "max 15 words",
  "watchout": "max 15 words"
}

Scores are integers 1-5. Be honest and concise.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.5,
      });
      return response.choices[0].message.content?.trim() ?? '';
    } catch (error) {
      this.logger.error(`Erreur analyse IA pour "${name}":`, error);
      throw error;
    }
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
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });
      const content = response.choices[0].message.content;
      if (!content) throw new Error('Empty response');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Erreur pick-best:', error);
      throw error;
    }
  }

  async isDomainAvailable(domain: string): Promise<boolean> {
    validateDomain(domain);
    try {
      const { stdout } = await execFileAsync('whois', [domain], { timeout: 10000 });
      const output = stdout.toLowerCase();

      // Check "available" patterns first — some TLDs (.io, .co, etc.) include
      // registrar info for the TLD itself before the "no match" message.
      const availablePatterns = [
        'no match for',
        'no match',
        'not found',
        'no entries found',
        'no data found',
        'status: available',
        'domain not found',
        'is available',
      ];
      if (availablePatterns.some(p => output.includes(p))) return true;

      const takenPatterns = [
        'domain name:',
        'registrar:',
        'creation date:',
        'registry domain id:',
        'reserved',
      ];
      return !takenPatterns.some(pattern => output.includes(pattern));
    } catch (error: any) {
      const errorMsg = error.stdout?.toLowerCase() || error.message?.toLowerCase() || '';
      return errorMsg.includes('no match') || errorMsg.includes('not found') || errorMsg.includes('available');
    }
  }

  async recheckAvailability(
    names: string[],
    extensions: string[],
  ): Promise<{ name: string; allExtensions: Record<string, boolean> }[]> {
    return Promise.all(
      names.map(async (name) => {
        const extStatus: Record<string, boolean> = {};
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
    targetCount = 10,
    extensions = ['.com'],
    matchMode = MatchMode.ANY,
    locale?: string,
    excludeNames: string[] = [],
    onEvent?: (event: Record<string, any>) => void,
    descriptiveNames = false,
    culturalNames = false,
    likedNames: string[] = [],
    dislikedNames: string[] = [],
  ): Promise<{ results: any[], totalChecked: number }> {
    const finalResults: any[] = [];
    // US-015 — pre-seed with already-evaluated names so the LLM never re-proposes them
    const checkedNames = new Set<string>(excludeNames);
    let attempts = 0;
    const maxAttempts = 5;

    while (finalResults.length < targetCount && attempts < maxAttempts) {
      onEvent?.({ type: 'generating' });
      const items = await this.generateDomainIdeas(description, keywords, locale, [...checkedNames], descriptiveNames, culturalNames, likedNames, dislikedNames);

      const newItems = items.filter(item => !checkedNames.has(item.name));
      newItems.forEach(item => checkedNames.add(item.name));

      if (newItems.length === 0) {
        attempts++;
        continue;
      }

      for (const item of newItems) {
        if (finalResults.length >= targetCount) break;

        onEvent?.({ type: 'candidate', name: item.name, checkedSoFar: checkedNames.size });

        const extStatus: Record<string, boolean> = {};

        await Promise.all(extensions.map(async (ext) => {
          extStatus[ext] = await this.isDomainAvailable(`${item.name}${ext}`);
        }));

        const availableExts = Object.keys(extStatus).filter(ext => extStatus[ext]);

        let isMatch = false;
        if (matchMode === MatchMode.ALL) {
          isMatch = availableExts.length === extensions.length;
        } else {
          isMatch = availableExts.length > 0;
        }

        if (isMatch) {
          const domain = { name: item.name, style: item.style, availableExtensions: availableExts, allExtensions: extStatus };
          finalResults.push(domain);
          onEvent?.({ type: 'result', domain });
        }
      }
      attempts++;
    }

    return {
      results: finalResults,
      totalChecked: checkedNames.size
    };
  }
}