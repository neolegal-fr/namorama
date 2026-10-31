import {
  dedupeKeywords, estVocabulaireDeNommage, KEYWORD_LIMIT, lireMotsCles, lireNomDeProjet, lireReponseMotsCles, MOT_CLE_MAX_CARACTERES,
} from './domain.service';

describe('mots-clés proposés', () => {
  it('dédoublonne sans tenir compte de la casse ni des espaces', () => {
    expect(dedupeKeywords([' vélo ', 'Vélo', 'VÉLO', 'roue'])).toEqual(['vélo', 'roue']);
  });

  it("garde l'ordre du modèle — c'est l'ordre de pertinence", () => {
    expect(dedupeKeywords(['b', 'a', 'c'])).toEqual(['b', 'a', 'c']);
  });

  it('ignore les entrées vides laissées par une virgule finale', () => {
    expect(dedupeKeywords(['a', '', '  ', 'b'])).toEqual(['a', 'b']);
  });

  it('le plafond laisse de quoi couvrir plusieurs angles sans lasser', () => {
    expect(KEYWORD_LIMIT).toBe(15);
  });
});

/**
 * Réponses réelles de claude-haiku-5-5, relevées le 31/10/2026 avec la
 * consigne de production. Chacune, découpée sur les virgules, donnait un
 * mot-clé que l'API refusait — et avec lui toutes les recherches du projet.
 */
describe('lecture de la réponse du modèle', () => {
  it('une liste propre passe telle quelle', () => {
    expect(lireMotsCles('Cybersécurité, PME, audit, pentest, tests d\'intrusion')).toEqual([
      'Cybersécurité', 'PME', 'audit', 'pentest', 'tests d\'intrusion',
    ]);
  });

  it('retire le préambule', () => {
    const texte =
      'Les 15 mots-clés les plus pertinents pour cette description, par ordre de pertinence :\n\n' +
      'audit de sécurité, test d\'intrusion, cybersécurité PME';
    expect(lireMotsCles(texte)).toEqual(['audit de sécurité', 'test d\'intrusion', 'cybersécurité PME']);
  });

  it('retire le préambule même collé à la liste', () => {
    const texte =
      'Voici une liste de 15 mots-clés pertinents pour une agence immobilière, classés du plus au moins pertinent :\n' +
      'agence immobilière, immobilier';
    expect(lireMotsCles(texte)).toEqual(['agence immobilière', 'immobilier']);
  });

  it('une question du modèle ne rend aucun mot-clé', () => {
    const texte =
      'Pour trouver le bon nom, j\'ai besoin d\'un peu plus de contexte. Pourriez-vous me dire :\n\n' +
      '- **Votre activité** : que fait votre entreprise, quels produits ou services proposez-vous ?\n' +
      '- **Votre cible** : qui sont vos clients ?';
    expect(lireMotsCles(texte)).toEqual([]);
  });

  it('une phrase sans question ne devient pas un mot-clé', () => {
    const texte = 'You sent "test" with no description, so I don\'t have a topic to generate keywords for. Once I have it, I will help.';
    expect(lireMotsCles(texte)).toEqual([]);
  });

  it('lit une liste à puces ou numérotée, une entrée par ligne', () => {
    expect(lireMotsCles('1. **vélo**\n2. mobilité douce\n- roue libre')).toEqual(['vélo', 'mobilité douce', 'roue libre']);
  });

  it('aucun mot-clé rendu ne dépasse ce que l\'API accepte', () => {
    const long = 'x'.repeat(120);
    const rendus = lireMotsCles(`vélo, ${long}, ${'mot '.repeat(30)}`);
    expect(rendus).toEqual(['vélo']);
    expect(MOT_CLE_MAX_CARACTERES).toBeLessThanOrEqual(100);
  });
});

describe('nom de projet suggéré', () => {
  it('un mot passe, débarrassé de sa ponctuation', () => {
    expect(lireNomDeProjet('Nexova')).toBe('Nexova');
    expect(lireNomDeProjet('**Expensio**.')).toBe('Expensio');
  });

  it('une phrase ne devient pas un nom', () => {
    expect(lireNomDeProjet('Pour te proposer le bon nom, j\'ai besoin de savoir un peu plus.')).toBe('');
    expect(lireNomDeProjet('')).toBe('');
  });
});

/**
 * Les mots-clés décrivent l'activité, pas le cahier des charges du nom.
 * Cas paraphrasés du relevé du 31/10/2026.
 */
describe('mots-clés limités à l’activité', () => {
  it('lit la réponse JSON du schéma', () => {
    expect(lireReponseMotsCles('{"keywords": ["référencement", "SEA"], "namingBusiness": false}')).toEqual(['référencement', 'SEA']);
  });

  it('retombe sur le texte libre si le modèle ignore la forme demandée', () => {
    expect(lireReponseMotsCles('référencement, SEA')).toEqual(['référencement', 'SEA']);
  });

  it('écarte le vocabulaire du nommage pour une boutique de vêtements', () => {
    const r = lireReponseMotsCles(JSON.stringify({
      keywords: ['vêtements urbains', 'nom de marque', 'Brand Name', 'identité de marque', 'court', 'streetwear'],
      namingBusiness: false,
    }));
    expect(r).toEqual(['vêtements urbains', 'streetwear']);
  });

  it('garde « création de marque » pour une agence de nommage', () => {
    const r = lireReponseMotsCles(JSON.stringify({ keywords: ['création de marque', 'naming', 'agence'], namingBusiness: true }));
    expect(r).toEqual(['création de marque', 'naming', 'agence']);
  });

  it('compare le mot-clé entier, jamais une sous-chaîne', () => {
    expect(estVocabulaireDeNommage('namecheap')).toBe(false);
    expect(estVocabulaireDeNommage('marque de vêtements')).toBe(false);
    expect(estVocabulaireDeNommage('Mémorable')).toBe(true);
    expect(estVocabulaireDeNommage('nom d’entreprise')).toBe(true);
  });

  it('le texte libre est filtré de la même façon', () => {
    expect(lireMotsCles('boulangerie, nom de marque, levain')).toEqual(['boulangerie', 'levain']);
  });
});
