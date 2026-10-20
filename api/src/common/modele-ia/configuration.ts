import { FOURNISSEURS, Fournisseur, ModelesParRole } from './modele-ia.types';

/** Ce que la configuration désigne, une fois vérifiée. */
export interface ConfigurationIA {
  principal: Fournisseur;
  /** Absent si non demandé, ou si sa clé manque (voir `avertissements`). */
  secours?: Fournisseur;
  cles: Partial<Record<Fournisseur, string>>;
  modeles: Partial<Record<Fournisseur, ModelesParRole>>;
  /** Ce qui n'empêche pas de démarrer, mais doit se lire au journal. */
  avertissements: string[];
}

type Lire = (cle: string) => string | undefined;

const CLE: Record<Fournisseur, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' };

/** Une variable vide vaut une variable absente : `KEY=` dans un `.env` n'est pas une clé. */
const valeur = (lire: Lire, cle: string): string | undefined => {
  const v = lire(cle)?.trim();
  return v ? v : undefined;
};

function fournisseur(lire: Lire, cle: string): Fournisseur | undefined {
  const v = valeur(lire, cle)?.toLowerCase();
  if (v === undefined) return undefined;
  if (!(FOURNISSEURS as readonly string[]).includes(v)) {
    throw new Error(`${cle}="${v}" : valeur inconnue, attendu ${FOURNISSEURS.join(' ou ')}`);
  }
  return v as Fournisseur;
}

/**
 * Les modèles OpenAI gardent leurs valeurs par défaut d'avant le chantier :
 * sans variable, rien ne change.
 */
function modelesOpenAi(lire: Lire): ModelesParRole {
  const simple = valeur(lire, 'OPENAI_MODEL') ?? 'gpt-5.6-luna';
  return {
    simple,
    creatif: valeur(lire, 'OPENAI_MODEL_CREATIVE') ?? 'gpt-5.6-terra',
    analyse: valeur(lire, 'OPENAI_MODEL_ANALYSIS') ?? simple,
  };
}

/**
 * Aucun modèle Claude n'a de valeur par défaut : le choix par rôle est une
 * décision, prise sur une comparaison, pas un réglage qu'on hérite sans le
 * voir. `null` quand un modèle manque.
 */
function modelesAnthropic(lire: Lire): ModelesParRole | null {
  const simple = valeur(lire, 'ANTHROPIC_MODEL');
  const creatif = valeur(lire, 'ANTHROPIC_MODEL_CREATIVE');
  if (!simple || !creatif) return null;
  return { simple, creatif, analyse: valeur(lire, 'ANTHROPIC_MODEL_ANALYSIS') ?? simple };
}

/**
 * Lit et vérifie la configuration du modèle. LÈVE sur ce qui rendrait le
 * principal inutilisable : mieux vaut un démarrage refusé, message en clair,
 * qu'une API qui démarre et dont chaque recherche échoue.
 */
export function lireConfigurationIA(lire: Lire): ConfigurationIA {
  const principal = fournisseur(lire, 'AI_PROVIDER') ?? 'openai';
  const demande = fournisseur(lire, 'AI_FALLBACK_PROVIDER');
  const avertissements: string[] = [];

  const cles: ConfigurationIA['cles'] = {};
  const modeles: ConfigurationIA['modeles'] = {};
  for (const f of FOURNISSEURS) {
    const cle = valeur(lire, CLE[f]);
    if (cle) cles[f] = cle;
  }
  modeles.openai = modelesOpenAi(lire);
  const anthropic = modelesAnthropic(lire);
  if (anthropic) modeles.anthropic = anthropic;

  if (!cles[principal]) {
    throw new Error(`AI_PROVIDER=${principal} : ${CLE[principal]} est absente`);
  }
  if (principal === 'anthropic' && !anthropic) {
    throw new Error('AI_PROVIDER=anthropic : ANTHROPIC_MODEL et ANTHROPIC_MODEL_CREATIVE sont obligatoires');
  }

  let secours: Fournisseur | undefined;
  if (demande && demande !== principal) {
    if (!cles[demande]) {
      avertissements.push(`AI_FALLBACK_PROVIDER=${demande} ignoré : ${CLE[demande]} est absente`);
    } else if (!modeles[demande]) {
      avertissements.push(`AI_FALLBACK_PROVIDER=${demande} ignoré : ANTHROPIC_MODEL et ANTHROPIC_MODEL_CREATIVE manquent`);
    } else {
      secours = demande;
    }
  }

  return { principal, secours, cles, modeles, avertissements };
}
