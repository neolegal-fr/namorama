import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ModelUsageService } from '../../common/model-usage/model-usage.service';

/**
 * Orthographes d'un même nom que l'index de l'INPI ne rapproche pas tout seul.
 *
 * Le problème, mesuré le 03/09/2026 : `Mark_Exp` indexe des JETONS. « Neo
 * Legal » y vit en deux jetons, `neo` et `legal` ; aucune requête sur
 * `neolegal` ne peut l'atteindre — ni exacte, ni tronquée. `data.inpi.fr`,
 * lui, colle les mots avant de comparer, et le trouve. D'où un rapport qui
 * annonçait « aucun dépôt identique » sur un nom déposé en classe 45.
 *
 * On ne peut pas rattraper ça côté requête : la passerelle ne connaît aucun
 * opérateur booléen (`OR` y est un mot ordinaire, il ramène « CARTE D'OR »).
 * Il faut donc poser la question une fois par orthographe, et chaque question
 * coûte une unité de quota sur un compte partagé par tout le produit. D'où
 * deux étages, du moins cher au plus cher.
 */
@Injectable()
export class NameVariantsService {
  private readonly logger = new Logger(NameVariantsService.name);
  /**
   * Absent si aucune clé n'est configurée — le service rend alors ses seules
   * variantes mécaniques, sans rien dire de plus.
   *
   * Construire le client OpenAI avec une clé vide LÈVE, et lèverait ici à
   * l'instanciation du module : tout le rapport de marque tomberait pour une
   * aide facultative. Un service best-effort ne casse pas le démarrage.
   */
  private readonly openai?: OpenAI;
  private readonly model: string;

  /** Séparateurs qui font, ou défont, un jeton dans l'index. */
  private static readonly SEPARATORS = /[\s\-_.’']+/g;

  /**
   * En dessous, un mot collé ne se découpe pas utilement : « Qonto » n'est pas
   * un mot-valise, et demander au modèle de le couper produirait du bruit.
   */
  private static readonly MIN_LENGTH_FOR_SPLIT = 6;

  constructor(
    config: ConfigService,
    // Facultatif pour les tests unitaires, qui construisent le service à la main.
    @Optional() private readonly usage?: ModelUsageService,
  ) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : undefined;
    this.model = config.get<string>('OPENAI_MODEL') ?? 'gpt-5.6-luna';
  }

  /**
   * Orthographes à chercher EN PLUS du nom lui-même, les plus utiles d'abord.
   *
   * Best-effort de bout en bout : ce service sert à trouver davantage, jamais
   * à faire échouer une vérification. Toute erreur rend une liste vide, et le
   * rapport se comporte alors comme avant.
   */
  async variants(name: string): Promise<string[]> {
    const mechanical = this.mechanicalVariants(name);
    // Le modèle n'est appelé que là où le mécanique ne peut RIEN : un mot
    // collé, dont seul un découpage en mots réels révélerait l'homonyme. Le
    // cas courant — un nom déjà écrit avec un séparateur — ne coûte donc rien.
    if (mechanical.length || !this.needsSplitting(name)) return mechanical;
    return this.splitWithModel(name);
  }

  /**
   * Le gratuit : retourner le séparateur dans les deux sens.
   *
   * « Neo Legal » cherche aussi « neolegal », « neo-legal » cherche aussi
   * « neo legal ». Déterministe, sans appel réseau, et suffisant dès que
   * l'utilisateur a lui-même écrit le séparateur.
   */
  private mechanicalVariants(name: string): string[] {
    const spaced = name.replace(NameVariantsService.SEPARATORS, ' ').trim();
    if (!spaced.includes(' ')) return [];
    return this.dedupe(name, [spaced.replace(/ /g, ''), spaced]);
  }

  private needsSplitting(name: string): boolean {
    const squashed = squash(name);
    return squashed.length >= NameVariantsService.MIN_LENGTH_FOR_SPLIT && !/\s/.test(name.trim());
  }

  /**
   * Le payant : demander au modèle où couper un mot collé.
   *
   * La sortie est VÉRIFIÉE, et c'est ce qui rend l'étape sûre : une variante
   * n'est retenue que si, séparateurs retirés, elle redonne exactement le nom
   * de départ. « neolegal » → « neo legal » passe ; « neo legale » est rejeté.
   * Le modèle peut donc se tromper, il ne peut pas nous faire chercher autre
   * chose que le nom qu'on lui a donné.
   */
  private async splitWithModel(name: string): Promise<string[]> {
    if (!this.openai) return [];
    try {
      const appel = this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              "Tu découpes un nom de marque écrit en un seul mot en mots réels (français ou anglais). " +
              "N'ajoute, ne retire et ne modifie AUCUNE lettre : le découpage doit redonner le mot exact " +
              "une fois les espaces retirés. Si aucun découpage ne fait sens, renvoie une liste vide. " +
              'Réponds uniquement en JSON : {"decoupages": ["mot mot"]}. Deux propositions au maximum.',
          },
          { role: 'user', content: name },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 120,
        reasoning_effort: 'none',
      });
      const res = this.usage ? await this.usage.mesurer('name_variants', appel) : await appel;
      const raw = JSON.parse(res.choices[0]?.message?.content ?? '{}') as { decoupages?: unknown };
      const proposals = Array.isArray(raw.decoupages) ? raw.decoupages : [];
      const kept = proposals
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        // Le garde-fou : mêmes lettres, dans le même ordre. Sinon, on cherchait
        // un autre nom que celui de l'utilisateur — et on le lui présenterait
        // comme le sien.
        .filter((v) => squash(v) === squash(name));
      return this.dedupe(name, kept);
    } catch (err) {
      this.logger.warn(`Découpage IA indisponible pour « ${name} » : ${err instanceof Error ? err.message : 'erreur'}`);
      return [];
    }
  }

  /** Écarte le nom lui-même et les doublons, en comparant sans casse ni bordures. */
  private dedupe(name: string, candidates: string[]): string[] {
    const seen = new Set([name.trim().toLowerCase()]);
    const out: string[] = [];
    for (const c of candidates) {
      const key = c.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(c.trim());
    }
    return out;
  }
}

/** Minuscules, sans accents, sans rien qui ne soit lettre ou chiffre. */
export function squash(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
