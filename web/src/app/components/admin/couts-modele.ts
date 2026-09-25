import { LigneConsommation, TarifCourant } from '../../services/admin.service';

/** Ce que faisait chaque opération, dit comme on en parle. */
export const LIBELLES_OPERATION: Record<string, string> = {
  refine: 'Reformulation',
  suggest_name: 'Nom de projet',
  keywords: 'Mots-clés',
  constraints: 'Contraintes',
  competitors: 'Repérage du marché',
  generate_names: 'Génération de noms',
  analyze: 'Analyse des noms',
  pick_best: 'Meilleur choix',
  name_variants: 'Variantes INPI',
  admin_mail_draft: 'Courriel rédigé (admin)',
};

export function libelleOperation(op: string): string {
  return LIBELLES_OPERATION[op] ?? op;
}

/**
 * Un montant en dollars, au centime.
 *
 * Le coût d'un compte ou d'une période se lit au centime, pas au dix-millième.
 * Un montant non nul qui s'arrondirait à zéro s'affiche « < 0,01 $ » : « 0,00 $ »
 * le ferait passer pour gratuit, comme un appel non chiffré.
 */
export function usd(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n !== 0 && Math.abs(n) < 0.005) return `${n < 0 ? '> −' : '< '}0,01 $`;
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

/**
 * Un coût UNITAIRE — par crédit, par nom analysé.
 *
 * Ce n'est pas un montant qu'on paie mais un ratio qu'on compare : un appel
 * luna coûte moins d'un millième de dollar, et au centime tous les ratios
 * vaudraient « < 0,01 $ ». Quatre décimales, donc, et seulement ici.
 */
export function usdUnitaire(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const decimales = Math.abs(n) < 1 ? 4 : 2;
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: decimales })} $`;
}

/** Tokens en milliers ou millions : « 12,4 k », « 3,1 M ». */
export function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return n.toLocaleString('fr-FR');
}

/**
 * Le tarif courant qui s'applique à un modèle : le préfixe le plus long, comme
 * côté serveur (`gpt-5.6-luna` couvre `gpt-5.6-luna-2026-07-01`).
 */
export function tarifDe(model: string, tarifs: TarifCourant[]): TarifCourant | null {
  let retenu: TarifCourant | null = null;
  for (const t of tarifs) {
    if (model.startsWith(t.model) && (!retenu || t.model.length > retenu.model.length)) retenu = t;
  }
  return retenu;
}

/**
 * Ce qu'auraient coûté ces tokens au tarif `t` : le cœur de la projection.
 *
 * Même formule que le serveur — la part en cache retranchée du plein tarif et
 * facturée au sien, le raisonnement déjà compté dans la sortie — mais au tarif
 * COURANT, pas à celui de la date de chaque appel. C'est ce qui permet de
 * comparer deux modèles à conditions égales.
 */
export function coutAuTarif(l: LigneConsommation, t: TarifCourant | null, webSearchPerCall: number | null): number | null {
  if (!t) return null;
  if (l.webSearchCalls > 0 && webSearchPerCall === null) return null;
  const plein = l.inputTokens - l.cachedInputTokens;
  return (plein * t.inputPerM
    + l.cachedInputTokens * (t.cachedInputPerM ?? t.inputPerM)
    + l.outputTokens * t.outputPerM) / 1_000_000
    + l.webSearchCalls * (webSearchPerCall ?? 0);
}

/** Regroupe les lignes d'une même opération, tous modèles confondus. */
export function parOperation(lignes: LigneConsommation[]): { operation: string; calls: number; items: number; costUsd: number | null; unpricedCalls: number }[] {
  const m = new Map<string, { operation: string; calls: number; items: number; costUsd: number | null; unpricedCalls: number }>();
  for (const l of lignes) {
    const o = m.get(l.operation) ?? { operation: l.operation, calls: 0, items: 0, costUsd: null, unpricedCalls: 0 };
    o.calls += l.calls;
    o.items += l.items;
    o.unpricedCalls += l.unpricedCalls;
    if (l.costUsd !== null) o.costUsd = (o.costUsd ?? 0) + l.costUsd;
    m.set(l.operation, o);
  }
  return [...m.values()].sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0));
}
