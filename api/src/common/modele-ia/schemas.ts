/**
 * La forme JSON que lit le parseur de chaque opération.
 *
 * OpenAI s'en passe (`json_object` garantit du JSON, pas sa forme). Anthropic
 * n'a pas de mode JSON sans schéma : la sortie structurée garantit à la fois
 * qu'on reçoit du JSON et qu'il a cette forme. Un schéma qui s'écarte de ce
 * que lit le parseur rendrait un résultat vide — d'où les tests qui font
 * passer un exemple de chaque schéma par son parseur.
 */

const objet = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const chaine = { type: 'string' };
const listeDe = (items: unknown) => ({ type: 'array', items });
const entierOuNul = { anyOf: [{ type: 'integer' }, { type: 'null' }] };

const CRITERES = ['memorability', 'pronunciation', 'international', 'seo', 'distinctiveness'];
const parCritere = (valeur: unknown) => objet(Object.fromEntries(CRITERES.map((c) => [c, valeur])));

export const SCHEMA_CONTRAINTES = objet({
  minLength: entierOuNul,
  maxLength: entierOuNul,
  avoidWords: listeDe(chaine),
  referenceBrands: listeDe(chaine),
  avoidEndings: listeDe(chaine),
  requiredWords: listeDe(chaine),
  nameType: { anyOf: [{ type: 'string', enum: ['invented', 'descriptive', 'any'] }, { type: 'null' }] },
});

export const SCHEMA_CONCURRENTS = objet({
  competitors: listeDe(objet({ name: chaine, domain: chaine, note: chaine })),
});

export const SCHEMA_NOMS = objet({
  names: listeDe(objet({ name: chaine, style: chaine })),
});

export const SCHEMA_ANALYSES = objet({
  analyses: listeDe(objet({
    name: chaine,
    scores: parCritere({ type: 'integer' }),
    comments: parCritere(chaine),
    origin: chaine,
    strengths: chaine,
    watchout: chaine,
  })),
});

export const SCHEMA_CHOIX = objet({ recommended: chaine, reason: chaine });

export const SCHEMA_DECOUPAGES = objet({ decoupages: listeDe(chaine) });

export const SCHEMA_BROUILLON = objet({ langue: chaine, contexte: chaine });

export const SCHEMA_MOTS_CLES = objet({ keywords: listeDe(chaine), namingBusiness: { type: 'boolean' } });
