import { construireContexte, consignes, langueDe, prenomLisible, lireBrouillon, mettreEnPage, signature, verifierBrouillon, versionTexte } from './admin-mail.service';

const qui = { prenom: 'Nicolas', nomComplet: 'Nicolas Riousset' };
const liens = { site: 'https://namorama.com', formulaire: 'https://namorama.com/app?avis=1', avis: 'https://fr.trustpilot.com/review/namorama.com' };

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

  it('porte un lien nommé par ses mots, pas par son URL', () => {
    const html = mettreEnPage('Passez par [ce court formulaire](https://namorama.com/app?avis=1), merci.');
    expect(html).toContain('<a href="https://namorama.com/app?avis=1">ce court formulaire</a>, merci.');
  });

  it("ne laisse pas un lien nommé sortir de son attribut href", () => {
    const html = mettreEnPage('[x](https://a.com/"onmouseover="alert(1))');
    expect(html).not.toContain('"onmouseover');
  });

  it("n'a ni logo ni pied de page : un courriel personnel, pas une campagne", () => {
    expect(mettreEnPage('Bonjour')).not.toMatch(/<img|<hr/);
  });
});

describe('lireBrouillon', () => {
  it('lit le corps et la langue employée', () => {
    expect(lireBrouillon('{"langue":"EN","corps":" Hello "}')).toEqual({ langue: 'en', corps: 'Hello' });
  });

  it("retombe sur le français si la langue rendue n'en est pas une qu'on signe", () => {
    expect(lireBrouillon('{"langue":"ja","corps":"x"}')?.langue).toBe('fr');
    expect(lireBrouillon('{"corps":"x"}')?.langue).toBe('fr');
  });

  it('refuse un brouillon vide ou illisible plutôt que de pré-remplir un champ vide', () => {
    expect(lireBrouillon('{"objet":"x"}')).toBeNull();
    expect(lireBrouillon('{"corps":"  "}')).toBeNull();
    expect(lireBrouillon('{"corps":')).toBeNull();
    expect(lireBrouillon(null)).toBeNull();
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

  it('reconnaît les liens nommés et le lien du site', () => {
    const nomme = `[Namorama](${liens.site}) — [ce formulaire](${liens.formulaire}), 500 crédits, [avis](${liens.avis}).`;
    expect(verifierBrouillon(nomme, liens)).toEqual([]);
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
    expect(consignes('fr', qui, liens)).toContain(liens.avis);
    expect(consignes('fr', qui, liens)).toMatch(/Ne la relie pas aux crédits/);
    expect(consignes('fr', qui, { ...liens, avis: null })).not.toMatch(/publiquement/);
  });

  it("n'exposent aucun nom de projet : il est généré, l'utilisateur ne l'a pas choisi", () => {
    expect(consignes('fr', qui, liens)).toMatch(/Les projets n'ont pas de nom/);
    expect(consignes('fr', qui, liens)).toMatch(/n’écris que le corps/);
    expect(consignes('fr', qui, liens)).toMatch(/NE SIGNE PAS/);
  });

  it('reprennent la promesse du site telle quelle : « jusqu’à » 500 crédits', () => {
    expect(consignes('en', qui, liens)).toMatch(/jusqu’à 500 crédits/);
    expect(consignes('en', qui, liens)).toMatch(/En anglais/);
    expect(consignes(null, qui, liens)).toMatch(/Une description en anglais NE SUFFIT PAS/);
  });
});

describe('versionTexte', () => {
  it('garde l’URL lisible là où un lien ne se clique pas', () => {
    expect(versionTexte('Voir [Namorama](https://namorama.com).')).toBe('Voir Namorama (https://namorama.com).');
  });
});

describe('signature', () => {
  it('nom complet et titre, dans la langue du message', () => {
    expect(signature(qui, 'fr')).toBe('Nicolas Riousset\nCréateur de Namorama');
    expect(signature(qui, 'en')).toBe('Nicolas Riousset\nCreator of Namorama');
  });
});

describe('prenomLisible', () => {
  it('remet en casse un prénom saisi en capitales, et seulement celui-là', () => {
    expect(prenomLisible('ADEM')).toBe('Adem');
    expect(prenomLisible('JEAN-LUC')).toBe('Jean-Luc');
    expect(prenomLisible('ÉLODIE')).toBe('Élodie');
    expect(prenomLisible('McKay')).toBe('McKay');
    expect(prenomLisible('  ')).toBeNull();
    expect(prenomLisible('Support')).toBeNull();
  });
});

describe('langueDe', () => {
  it("garde la langue du compte quand on sait écrire dedans ; sinon, rien — le modèle la déduira", () => {
    expect(langueDe('en-GB')).toBe('en');
    expect(langueDe('de')).toBe('de');
    expect(langueDe('ja')).toBeNull();
    expect(langueDe(null)).toBeNull();
  });
});

describe('construireContexte — signaux', () => {
  const base = {
    prenom: 'Léa', locale: null, email: 'lea@exemple.fr', inscritLe: new Date(2026, 8, 1, 10), derniereActivite: new Date(2026, 8, 1, 11),
    solde: 100, projets: [], aimes: [], rapports: [], retours: [], envois: [],
  };
  const projet = (id: string, description: string, proposes = 10) =>
    ({ id, description, creeLe: new Date(2026, 8, 1), proposes, ecartes: 0 });

  it("repère un inscrit qui n'a rien décrit, venu une seule fois", () => {
    const ctx = construireContexte(base);
    expect(ctx.signaux.join(' ')).toMatch(/sans avoir créé de projet/);
    expect(ctx.signaux.join(' ')).toMatch(/N'est venu qu'une fois/);
    expect(ctx.langue).toBeNull();
    expect(ctx.extensionEmail).toBe('fr');
  });

  it('repère deux projets identiques, et ne les montre qu’une fois au modèle', () => {
    const ctx = construireContexte({
      ...base,
      projets: [projet('a', 'Boulangerie  bio à Nantes'), projet('b', 'boulangerie bio à nantes'), projet('c', 'Autre chose')],
    });
    expect(ctx.signaux.join(' ')).toMatch(/2 projets à la description identique/);
    expect(ctx.projets).toHaveLength(2);
  });

  it('repère un compte bloqué faute de crédits, et compte ce qu’il a consommé', () => {
    const ctx = construireContexte({ ...base, solde: 3, projets: [projet('a', 'x', 97)] });
    expect(ctx.signaux.join(' ')).toMatch(/Est reparti avec 3 crédit/);
    expect(ctx.creditsConsommes).toBe(97);
  });

  it('distingue des favoris sans les crédits d’un rapport', () => {
    const ctx = construireContexte({ ...base, solde: 30, projets: [projet('a', 'x')], aimes: [{ projectId: 'a', nom: 'levainerie' }] });
    expect(ctx.signaux.join(' ')).toMatch(/pas assez pour un rapport de marque \(50 crédits\)/);
    expect(ctx.projets[0].nomsAimes).toEqual(['levainerie']);
  });

  it('repère un utilisateur engagé qui a acheté un rapport', () => {
    const ctx = construireContexte({
      ...base, projets: [projet('a', 'x', 60)], aimes: [{ projectId: 'a', nom: 'kessio' }],
      rapports: [{ nom: 'kessio', cout: 50 }],
    });
    expect(ctx.signaux.join(' ')).toMatch(/A acheté un rapport de marque \(kessio\)/);
    expect(ctx.signaux.join(' ')).toMatch(/110 crédits consommés/);
  });

  it('propose des noms sans favori : les propositions ne convenaient pas', () => {
    const ctx = construireContexte({ ...base, projets: [projet('a', 'x', 25)] });
    expect(ctx.signaux.join(' ')).toMatch(/25 noms proposés, aucun mis en favori/);
  });
});
