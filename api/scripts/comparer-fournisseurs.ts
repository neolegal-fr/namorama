/**
 * Compare OpenAI et Claude sur de vraies descriptions, avant toute bascule.
 *
 * Pour chaque description, et sur chacun des deux fournisseurs : reformulation,
 * mots-clés, génération de noms, notation des dix premiers. Le résultat est un
 * Markdown côte à côte — noms, notes, longueur des textes, tokens et coût
 * estimé — à relire avant de choisir les modèles de chaque rôle.
 *
 * DÉPENSE DE VRAIS TOKENS, sur les deux comptes. Ne le lancer qu'avec accord.
 *
 *   cd api
 *   OPENAI_API_KEY=… ANTHROPIC_API_KEY=… \
 *   ANTHROPIC_MODEL=claude-haiku-5-5 ANTHROPIC_MODEL_CREATIVE=claude-sonnet-5-5 \
 *   npx ts-node -T scripts/comparer-fournisseurs.ts descriptions.txt comparaison.md
 *
 * `descriptions.txt` : une description par ligne, anonymisée. Les lignes vides
 * et celles qui commencent par `#` sont ignorées.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DomainService } from '../src/domain/domain.service';
import { lireConfigurationIA } from '../src/common/modele-ia/configuration';
import { ModeleIA } from '../src/common/modele-ia/modele-ia.service';
import { OpenAiAdaptateur } from '../src/common/modele-ia/openai.adaptateur';
import { AnthropicAdaptateur } from '../src/common/modele-ia/anthropic.adaptateur';
import { Adaptateur, Fournisseur } from '../src/common/modele-ia/modele-ia.types';
import { lireConsommation, OperationModele } from '../src/common/model-usage/model-usage.service';

/**
 * Tarifs $/M tokens (entrée, entrée en cache, sortie), relevés le 06/10/2026.
 * Une estimation pour comparer, pas une facture : le tableau de bord, lui,
 * lit `model_price`. Le modèle est un préfixe, comme là-bas.
 */
const TARIFS: [prefixe: string, entree: number, cache: number, sortie: number][] = [
  ['gpt-5.6-luna', 0.2, 0.02, 1.2],
  ['gpt-5.6-terra', 2, 0.2, 12],
  ['claude-haiku-5-5', 0.1, 0.01, 0.5],
  ['claude-sonnet-5-5', 2, 0.2, 10],
  ['claude-opus-5-5', 4, 0.2, 20],
];
const WEB_SEARCH = 0.01;

interface Ligne { operation: OperationModele; model: string; entree: number; sortie: number; raisonnement: number; cout: number | null; ms: number }

/** Un relevé en mémoire, à la place de `ModelUsageService` : rien n'est écrit en base. */
class Releve {
  lignes: Ligne[] = [];
  async mesurer<T>(operation: OperationModele, appel: Promise<T>): Promise<T> {
    const debut = Date.now();
    const r = await appel;
    const c = lireConsommation(r);
    const t = TARIFS.filter(([p]) => c.model.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
    const cout = t
      ? ((c.inputTokens - c.cachedInputTokens) * t[1] + c.cachedInputTokens * t[2] + c.outputTokens * t[3]) / 1e6 + c.webSearchCalls * WEB_SEARCH
      : null;
    this.lignes.push({ operation, model: c.model, entree: c.inputTokens, sortie: c.outputTokens, raisonnement: c.reasoningTokens, cout, ms: Date.now() - debut });
    return r;
  }
}

function adaptateur(f: Fournisseur, releve: Releve): Adaptateur {
  // Même lecture que l'API : mêmes variables, mêmes contrôles.
  const c = lireConfigurationIA((k) => (k === 'AI_PROVIDER' ? f : process.env[k]));
  const usage = releve as any;
  return f === 'anthropic'
    ? AnthropicAdaptateur.depuisCle(c.cles.anthropic!, c.modeles.anthropic!, usage)
    : OpenAiAdaptateur.depuisCle(c.cles.openai!, c.modeles.openai!, usage);
}

interface Essai {
  fournisseur: Fournisseur;
  reformulation: string;
  motsCles: string[];
  noms: { name: string; note: number | null; origine: string }[];
  releve: Ligne[];
  erreur?: string;
}

const moyenne = (scores: Record<string, number>) => {
  const v = Object.values(scores ?? {}).filter((x) => typeof x === 'number');
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

async function essayer(f: Fournisseur, description: string): Promise<Essai> {
  const releve = new Releve();
  const svc = new DomainService({} as any, {} as any, ModeleIA.avec(adaptateur(f, releve)));
  const essai: Essai = { fournisseur: f, reformulation: '', motsCles: [], noms: [], releve: releve.lignes };
  try {
    essai.reformulation = await svc.refineDescription(description);
    essai.motsCles = await svc.generateKeywords(essai.reformulation, 'fr');
    const idees = (await svc.generateDomainIdeas(essai.reformulation, essai.motsCles, 'fr')).slice(0, 10);
    const analyses = await svc.analyzeNames(idees.map((i) => i.name), 'fr');
    essai.noms = idees.map((i) => {
      const a = analyses.get(i.name);
      const lu = a ? JSON.parse(a) : null;
      return { name: i.name, note: lu ? moyenne(lu.scores) : null, origine: lu?.origin ?? '' };
    });
  } catch (e) {
    essai.erreur = e instanceof Error ? e.message : String(e);
  }
  return essai;
}

const total = (lignes: Ligne[]) => {
  const couts = lignes.map((l) => l.cout);
  return {
    entree: lignes.reduce((a, l) => a + l.entree, 0),
    sortie: lignes.reduce((a, l) => a + l.sortie, 0),
    raisonnement: lignes.reduce((a, l) => a + l.raisonnement, 0),
    cout: couts.includes(null) ? null : couts.reduce((a: number, c) => a + (c as number), 0),
    ms: lignes.reduce((a, l) => a + l.ms, 0),
  };
};

function colonne(e: Essai): string {
  const t = total(e.releve);
  const modeles = [...new Set(e.releve.map((l) => l.model))].join(', ');
  return [
    `**${e.fournisseur}** — ${modeles || '—'}`,
    e.erreur ? `⚠ ${e.erreur}` : '',
    `Reformulation (${e.reformulation.length} car.) : ${e.reformulation.replace(/\n+/g, ' ')}`,
    `Mots-clés (${e.motsCles.length}) : ${e.motsCles.join(', ')}`,
    `Noms (${e.noms.length}, note moyenne ${moyenne(Object.fromEntries(e.noms.filter((n) => n.note !== null).map((n, i) => [i, n.note as number]))) ?? '—'}) :`,
    ...e.noms.map((n) => `- ${n.name} — ${n.note ?? 'sans note'} — ${n.origine}`),
    `Tokens : ${t.entree} en entrée, ${t.sortie} en sortie (dont ${t.raisonnement} de raisonnement) · ${(t.ms / 1000).toFixed(1)} s`,
    `Coût estimé : ${t.cout === null ? 'non chiffré' : `${t.cout.toFixed(4)} $`}`,
  ].filter(Boolean).join('\n');
}

async function main() {
  const [entree, sortie = 'comparaison-fournisseurs.md'] = process.argv.slice(2);
  if (!entree) throw new Error('Usage : comparer-fournisseurs.ts <descriptions.txt> [sortie.md]');
  const descriptions = readFileSync(entree, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

  const sections: string[] = [`# Comparaison OpenAI / Claude — ${new Date().toISOString().slice(0, 10)}\n`];
  const cumul: Record<Fournisseur, Ligne[]> = { openai: [], anthropic: [] };
  for (const [i, d] of descriptions.entries()) {
    process.stderr.write(`${i + 1}/${descriptions.length} …\n`);
    // L'un après l'autre : deux fournisseurs en parallèle mesureraient leurs durées l'un contre l'autre.
    const o = await essayer('openai', d);
    const a = await essayer('anthropic', d);
    cumul.openai.push(...o.releve);
    cumul.anthropic.push(...a.releve);
    sections.push(`## ${i + 1}. ${d}\n\n${colonne(o)}\n\n${colonne(a)}\n`);
  }

  const bilan = (['openai', 'anthropic'] as const).map((f) => {
    const t = total(cumul[f]);
    const parOp = Object.entries(
      cumul[f].reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.operation]: (acc[l.operation] ?? 0) + (l.cout ?? 0) }), {}),
    ).map(([op, c]) => `${op} ${c.toFixed(4)} $`).join(' · ');
    return `- **${f}** : ${t.cout === null ? 'non chiffré' : `${t.cout.toFixed(4)} $`} pour ${descriptions.length} description(s) — ${parOp}`;
  });
  sections.splice(1, 0, `## Bilan\n\n${bilan.join('\n')}\n`);
  writeFileSync(sortie, sections.join('\n'));
  process.stderr.write(`Écrit : ${sortie}\n`);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
