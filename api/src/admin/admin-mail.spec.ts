import { GABARITS, OBJET, composer, construireContexte, consignes, langueDe, prenomLisible, lireBrouillon, mettreEnPage, signature, verifierBrouillon, versionTexte } from './admin-mail.service';

const qui = { prenom: 'Nicolas', nomComplet: 'Nicolas Riousset' };
const liens = {
  site: 'https://namorama.com',
  formulaire: 'https://namorama.com/app?avis=1',
  avis: 'https://fr.trustpilot.com/review/namorama.com',
  oui: 'https://namorama.com/retour?j=jeton-oui',
  non: 'https://namorama.com/retour?j=jeton-non',
};
const desinscription = 'https://namorama.com/desinscription?j=jeton-desinscription';

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

  describe('réponses en boutons (refondre-le-courriel-de-retour)', () => {
    const corps = composer('fr', 'Léa', null, qui, { ...liens, desinscription });
    const html = mettreEnPage(corps);
    const boutons = [...html.matchAll(/<a href="([^"]+)" style="([^"]+)">([^<]+)<\/a>/g)];

    it('deux liens de réponse donnent deux boutons de styles identiques, dans un seul tableau', () => {
      expect(boutons.map((b) => [b[1], b[3]])).toEqual([[liens.oui, 'Oui, j&#39;en ai un'], [liens.non, 'Pas encore']]);
      expect(boutons[0][2]).toBe(boutons[1][2]);
      expect(boutons[0][2]).toMatch(/background-color:#0d7a4e/);
      expect(boutons[0][2]).toMatch(/padding:14px 22px/);
      expect(html.match(/<table /g)).toHaveLength(1);
      // Deux cellules de même largeur : un bouton plus large paraîtrait le principal.
      expect(html.match(/<td align="center" width="48%" style="width:48%;border-radius:8px;background-color:#0d7a4e;">/g)).toHaveLength(2);
      expect(html).toContain('<td width="4%" style="width:4%;"></td>');
      expect(html).toContain('max-width:340px');
    });

    it('les autres liens restent des liens simples, et rien d’autre ne change', () => {
      expect(html).toContain(`<a href="${liens.formulaire}">ce court formulaire</a>`);
      expect(html).toContain(`<a href="${desinscription}">Se désinscrire</a>`);
      expect(html).toContain('<p>Avez-vous trouvé un nom qui vous plaît ?</p>');
      expect(html).not.toMatch(/<img|<hr/);
    });

    it('un guillemet dans un libellé reste échappé', () => {
      const h = mettreEnPage(`[Oui "vraiment"](${liens.oui})\n[Non](${liens.non})`);
      expect(h).toContain('Oui &quot;vraiment&quot;');
      expect(h).not.toContain('"vraiment"');
    });

    it('la version texte garde chaque réponse lisible, suivie de son adresse', () => {
      expect(versionTexte(corps)).toContain(`Oui, j'en ai un (${liens.oui})\nPas encore (${liens.non})`);
    });

    it('un brouillon retouché qui garde les deux liens garde ses boutons', () => {
      const retouche = corps.replace('Avez-vous trouvé un nom qui vous plaît ?', 'Alors, ce nom, trouvé ?')
        .replace('[Pas encore]', '[Toujours pas]');
      const h = mettreEnPage(retouche);
      expect(h.match(/style="display:inline-block/g)).toHaveLength(2);
      expect(h).toContain('>Toujours pas</a>');
    });

    it('un lien de réponse glissé dans une phrase prend le style de bouton, sans tableau', () => {
      const h = mettreEnPage(`Trouvé ? [Oui](${liens.oui}), merci.`);
      expect(h).toContain(`<p>Trouvé ? <a href="${liens.oui}" style="display:inline-block`);
      expect(h).not.toContain('<table');
    });
  });
});

describe('lireBrouillon', () => {
  it('lit la phrase de contexte et la langue employée', () => {
    expect(lireBrouillon('{"langue":"EN","contexte":" I saw that\\nyou searched "}')).toEqual({ langue: 'en', contexte: 'I saw that you searched' });
  });

  it("retombe sur le français si la langue rendue n'en est pas une qu'on signe", () => {
    expect(lireBrouillon('{"langue":"ja","contexte":"x"}')?.langue).toBe('fr');
    expect(lireBrouillon('{"contexte":"x"}')?.langue).toBe('fr');
  });

  it('refuse une réponse sans phrase : le gabarit nu partirait à l’identique à tout le monde', () => {
    expect(lireBrouillon('{"corps":"x"}')).toBeNull();
    expect(lireBrouillon('{"contexte":"  "}')).toBeNull();
    expect(lireBrouillon('{"contexte":')).toBeNull();
    expect(lireBrouillon(null)).toBeNull();
  });
});

describe('verifierBrouillon', () => {
  const complet = `Utile ? ${liens.oui} ${liens.non} — 100 crédits. Répondez ici ou via ${liens.formulaire} — 500 crédits. Avis : ${liens.avis}`;

  it('ne signale rien sur un brouillon complet', () => {
    expect(verifierBrouillon(complet, liens)).toEqual([]);
  });

  it('signale un lien ou une promesse manquants', () => {
    const alertes = verifierBrouillon('Bonjour, dites-nous tout.', liens);
    // oui, non, 100 crédits, formulaire, 500 crédits, avis
    expect(alertes).toHaveLength(6);
  });

  it('reconnaît les liens nommés et le lien du site', () => {
    const nomme = `[Namorama](${liens.site}) — [Oui](${liens.oui}) · [Non](${liens.non}), 100 crédits — [ce formulaire](${liens.formulaire}), 500 crédits, [avis](${liens.avis}).`;
    expect(verifierBrouillon(nomme, liens)).toEqual([]);
  });

  it("signale un lien que le modèle n'a pas reçu : il partirait sous le nom de l'administrateur", () => {
    const alertes = verifierBrouillon(`${complet} Voir https://exemple.com/offre.`, liens);
    expect(alertes).toEqual(['Lien(s) non fourni(s) au modèle : https://exemple.com/offre']);
  });

  it("n'exige pas de lien d'avis tant qu'aucun profil n'est configuré", () => {
    expect(verifierBrouillon(`${liens.oui} ${liens.non} 100 ${liens.formulaire} 500`, { ...liens, avis: null })).toEqual([]);
  });

  it('signale un brouillon privé du lien « non » : la question d\'utilité serait boiteuse', () => {
    expect(verifierBrouillon(complet.replace(liens.non, ''), liens)).toEqual(['Le lien de réponse « non » manque.']);
  });

  it('signale l\'absence de liens de réponse quand le secret manque', () => {
    const sansSecret = { ...liens, oui: null, non: null };
    expect(verifierBrouillon(complet, sansSecret)[0]).toMatch(/FEEDBACK_LINK_SECRET absent/);
  });
});

describe('consignes', () => {
  it("ne demandent qu'une phrase de faits, sans nom de projet", () => {
    expect(consignes('fr')).toMatch(/UNE phrase/);
    expect(consignes('fr')).toMatch(/JAMAIS le nom du projet/);
    expect(consignes('en')).toMatch(/LANGUE : anglais/);
    expect(consignes(null)).toMatch(/Une description en anglais NE SUFFIT PAS/);
  });
});

describe('composer', () => {
  const ctx = "J'ai vu que vous aviez cherché un nom pour une boulangerie bio à Nantes.";

  it('manuel : la question et ses réponses, puis la présentation et la phrase du modèle, puis le détail et la signature', () => {
    const m = composer('fr', 'Léa', ctx, qui, liens);
    expect(m.startsWith(
      `Bonjour Léa,\n\nAvez-vous trouvé un nom qui vous plaît ?\n\n[Oui, j'en ai un](${liens.oui})\n[Pas encore](${liens.non})` +
      `\n\nUn clic suffit : il vous rapporte 100 crédits.\n\nJe suis Nicolas, le créateur de [namorama.com](https://namorama.com). ${ctx}`,
    )).toBe(true);
    expect(m).toContain(`[ce court formulaire](${liens.formulaire}). Je vous offrirai 500 crédits de plus.`);
    // Ordre : la question, puis la phrase du modèle, puis la demande détaillée.
    expect(m.indexOf(liens.non)).toBeLessThan(m.indexOf(ctx));
    expect(m.indexOf(ctx)).toBeLessThan(m.indexOf(liens.formulaire));
    expect(m.endsWith("Merci d'avance,\n\nNicolas Riousset\nCréateur de Namorama")).toBe(true);
    expect(m).not.toContain('désinscrire');
    expect(verifierBrouillon(m, liens)).toEqual([]);
  });

  it('automatique : la question en tête, la présentation « hier » ensuite, pied de désinscription en dernier', () => {
    const m = composer('fr', 'Léa', null, qui, { ...liens, desinscription });
    expect(m.split('\n\n').slice(0, 2)).toEqual(['Bonjour Léa,', 'Avez-vous trouvé un nom qui vous plaît ?']);
    expect(m).toContain("Je suis Nicolas, le créateur de [namorama.com](https://namorama.com). Vous avez créé votre compte hier, d'où cette question.");
    expect(m.indexOf('100 crédits')).toBeLessThan(m.indexOf('Je suis Nicolas'));
    expect(m).not.toContain("J'ai vu que");
    expect(m).not.toContain('utile ?');
    expect(m.endsWith(`[Se désinscrire](${desinscription})`)).toBe(true);
    expect(m.indexOf('Créateur de Namorama')).toBeLessThan(m.indexOf('Se désinscrire'));
    expect(verifierBrouillon(m, { ...liens, desinscription })).toEqual([]);
  });

  it('en anglais : « Did you find a name you like? », « Yes, I have one », « Not yet »', () => {
    const m = composer('en', 'Kim', null, qui, liens);
    expect(m).toContain(`Did you find a name you like?\n\n[Yes, I have one](${liens.oui})\n[Not yet](${liens.non})`);
  });

  it('sans liens de réponse, la question disparaît avec ses réponses', () => {
    const m = composer('fr', 'Léa', ctx, qui, { ...liens, oui: null, non: null });
    expect(m).not.toContain('un nom qui vous plaît');
    expect(m).not.toContain('100 crédits');
    expect(m).toContain('500 crédits');
  });

  it("n'ajoute la phrase Trustpilot que si une page d'avis est configurée", () => {
    expect(composer('fr', null, ctx, qui, liens)).toContain('Trustpilot');
    expect(composer('fr', null, ctx, qui, { ...liens, avis: null })).not.toContain('Trustpilot');
    expect(composer('fr', null, ctx, qui, liens).startsWith('Bonjour,\n\n')).toBe(true);
  });

  it('existe dans chaque langue qu’on sait signer, liens et promesse compris', () => {
    for (const l of ['fr', 'en', 'de', 'es', 'pt', 'it', 'nl']) {
      expect(verifierBrouillon(composer(l, 'Kim', 'X.', qui, liens), liens)).toEqual([]);
      expect(verifierBrouillon(composer(l, 'Kim', null, qui, { ...liens, desinscription }), { ...liens, desinscription })).toEqual([]);
    }
  });
});

describe('objet et réponses', () => {
  it("l'objet est la question, dans chaque langue, sans emoji", () => {
    expect(OBJET.fr).toBe('Avez-vous trouvé un nom qui vous plaît ?');
    for (const l of Object.keys(GABARITS)) {
      expect(OBJET[l]).toBe(GABARITS[l].nomTrouve);
      expect(OBJET[l]).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('chaque réponse tient en moins de 20 caractères, pour deux boutons par ligne à 390 px', () => {
    for (const g of Object.values(GABARITS)) {
      const libelles = [...g.reponses('https://a', 'https://b').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
      expect(libelles).toHaveLength(2);
      for (const t of libelles) expect(t.length).toBeLessThan(20);
    }
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
  it('remet en casse un prénom saisi tout en capitales ou tout en minuscules, et seulement celui-là', () => {
    expect(prenomLisible('ADEM')).toBe('Adem');
    expect(prenomLisible('JEAN-LUC')).toBe('Jean-Luc');
    expect(prenomLisible('ÉLODIE')).toBe('Élodie');
    expect(prenomLisible('McKay')).toBe('McKay');
    expect(prenomLisible('stéphane')).toBe('Stéphane');
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
