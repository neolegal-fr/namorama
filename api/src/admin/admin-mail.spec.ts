import { consignes, langueDe, lireBrouillon, mettreEnPage, verifierBrouillon } from './admin-mail.service';

const liens = { formulaire: 'https://namorama.com/app?avis=1', avis: 'https://fr.trustpilot.com/review/namorama.com' };

describe('mettreEnPage', () => {
  it('échappe le HTML : le corps est du texte, pas du balisage', () => {
    const html = mettreEnPage('<script>alert(1)</script> & <b>gras</b>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('fait un paragraphe par bloc et un <br> par saut de ligne', () => {
    const html = mettreEnPage('Bonjour Léa,\n\nPremière ligne\nseconde ligne');
    expect(html.match(/<p>/g)).toHaveLength(2);
    expect(html).toContain('Première ligne<br>seconde ligne');
  });

  it('rend les liens https cliquables, sans avaler la ponctuation finale', () => {
    const html = mettreEnPage('Le formulaire : https://namorama.com/app?avis=1.');
    expect(html).toContain('<a href="https://namorama.com/app?avis=1">https://namorama.com/app?avis=1</a>.');
  });

  it("n'a ni logo ni pied de page : un courriel personnel, pas une campagne", () => {
    expect(mettreEnPage('Bonjour')).not.toMatch(/<img|<hr/);
  });
});

describe('lireBrouillon', () => {
  it('lit objet et corps', () => {
    expect(lireBrouillon('{"objet":" Votre projet ","corps":"Bonjour"}')).toEqual({ subject: 'Votre projet', body: 'Bonjour' });
  });

  it('refuse un brouillon incomplet ou illisible plutôt que de pré-remplir un champ vide', () => {
    expect(lireBrouillon('{"objet":"x"}')).toBeNull();
    expect(lireBrouillon('{"objet":"","corps":"y"}')).toBeNull();
    expect(lireBrouillon('{"objet":"x","corps":')).toBeNull();
    expect(lireBrouillon(null)).toBeNull();
  });

  it("ramène l'objet sur une ligne : un saut de ligne n'a rien à faire dans un en-tête", () => {
    expect(lireBrouillon('{"objet":"a\\nb","corps":"c"}')?.subject).toBe('a b');
  });
});

describe('verifierBrouillon', () => {
  const complet = `Répondez ici ou via ${liens.formulaire} — jusqu'à 500 crédits. Avis : ${liens.avis}`;

  it('ne signale rien sur un brouillon complet', () => {
    expect(verifierBrouillon(complet, liens)).toEqual([]);
  });

  it('signale un lien ou une promesse manquants', () => {
    const alertes = verifierBrouillon('Bonjour, dites-nous tout.', liens);
    expect(alertes).toHaveLength(3);
  });

  it("signale un lien que le modèle n'a pas reçu : il partirait sous le nom de l'administrateur", () => {
    const alertes = verifierBrouillon(`${complet} Voir https://exemple.com/offre.`, liens);
    expect(alertes).toEqual(['Lien(s) non fourni(s) au modèle : https://exemple.com/offre']);
  });

  it("n'exige pas de lien d'avis tant qu'aucun profil n'est configuré", () => {
    expect(verifierBrouillon(`${liens.formulaire} 500`, { ...liens, avis: null })).toEqual([]);
  });
});

describe('consignes', () => {
  it("ne parlent de la page d'avis que si elle est configurée, et la séparent des crédits", () => {
    expect(consignes('fr', 'Nicolas', liens)).toContain(liens.avis);
    expect(consignes('fr', 'Nicolas', liens)).toMatch(/sans rapport avec les crédits/);
    expect(consignes('fr', 'Nicolas', { ...liens, avis: null })).not.toMatch(/publiquement/);
  });

  it('reprennent la promesse du site telle quelle : « jusqu’à » 500 crédits', () => {
    expect(consignes('en', 'Nicolas', liens)).toMatch(/jusqu’à 500 crédits/);
    expect(consignes('en', 'Nicolas', liens)).toMatch(/En anglais/);
  });
});

describe('langueDe', () => {
  it('garde la langue du compte quand on sait écrire dedans, le français sinon', () => {
    expect(langueDe('en-GB')).toBe('en');
    expect(langueDe('de')).toBe('de');
    expect(langueDe('ja')).toBe('fr');
    expect(langueDe(null)).toBe('fr');
  });
});
