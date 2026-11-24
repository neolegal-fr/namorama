import {
  avecRevision,
  compilerArticle,
  ContexteDeCompilation,
  dateDeParis,
  lireEnTete,
  sansRevision,
  typographie,
  ArticleCompile,
} from './compilateur';

// Cas portés de `web/scripts/articles.test.mjs` (compilateur de build), puis ceux du
// chantier `articles-en-base` : causes accumulées, chemins, liens selon la date.

const SITE = new Set(['/', '/app', '/blog']);
const contexte = (articles: Record<string, string | null> = {}, verifierParution = false): ContexteDeCompilation => ({
  cheminsDuSite: SITE,
  articles: new Map(Object.entries({ '/guides/trouver-nom-de-marque': '2026-06-10', ...articles })),
  verifierParution,
  aujourdhui: '2026-11-23',
});

const entete = (extra: Record<string, string | undefined> = {}) => {
  const e: Record<string, string | undefined> = {
    path: '/blog/essai',
    title: 'Titre de page',
    description: 'Description',
    titre: "Titre d'index",
    extrait: 'Extrait',
    categorie: 'Secteurs',
    publie: '2026-12-01',
    misAJour: '2026-12-01',
    ...extra,
  };
  return (
    '---\n' +
    Object.entries(e)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n') +
    '\n---\n'
  );
};
const article = (corps: string, extra?: Record<string, string | undefined>) => entete(extra) + '# Le titre\n\n' + corps;

function compiler(src: string, ctx = contexte()): ArticleCompile {
  const r = compilerArticle(src, ctx);
  if (!r.ok) throw new Error(`refusé : ${r.causes.join(' | ')}`);
  return r.article;
}
function causes(src: string, ctx = contexte()): string[] {
  const r = compilerArticle(src, ctx);
  if (r.ok) throw new Error('accepté à tort');
  return r.causes;
}
const echoue = (src: string, motif: RegExp, ctx = contexte()) => expect(causes(src, ctx).join('\n')).toMatch(motif);

describe('compilateur — cas portés', () => {
  it('en-tête, titre et HTML', () => {
    const a = compiler(article('Un paragraphe.\n\n## Section {#section}\n\nTexte.'));
    expect(a.path).toBe('/blog/essai');
    expect(a.titre).toBe("Titre d'index");
    expect(a.h1).toBe('Le titre');
    expect(a.segments).toHaveLength(1);
    expect((a.segments[0] as { html: string }).html).toMatch(/<h2 id="section">Section<\/h2>/);
  });

  it('valeurs YAML entre guillemets', () => {
    const a = compiler(article('x', { title: '"Prix : 190 € \\"tout compris\\""', titre: "'L''INPI'" }));
    expect(a.title).toBe('Prix : 190 € "tout compris"');
    expect(a.titre).toBe("L'INPI");
  });

  it('champ manquant', () => echoue(article('x', { extrait: undefined }), /champ d'en-tête manquant : extrait/));
  it('champ inconnu', () => echoue(entete().replace('---\n', '---\nauteur: X\n') + '# T\n', /champ d'en-tête inconnu « auteur »/));
  it('sans en-tête', () => echoue('# Titre\n\nTexte', /en-tête manquant/));
  it('catégorie inconnue', () => echoue(article('x', { categorie: 'Secteur' }), /catégorie inconnue « Secteur ».*Secteurs/));
  it('date non ISO', () => echoue(article('x', { publie: '01/12/2026' }), /publie doit être une date/));
  it('date impossible', () => echoue(article('x', { publie: '2026-02-30', misAJour: '2026-03-01' }), /publie doit être une date/));
  it('mise à jour antérieure', () => echoue(article('x', { misAJour: '2026-11-30' }), /antérieure à publie/));
  it('sans titre #', () => echoue(entete() + 'Texte', /commencer par le titre/));
  it('deux titres #', () => echoue(article('# Autre'), /un seul titre/));
  it('HTML brut', () => echoue(article('Texte <span style="color:red">rouge</span>'), /HTML brut interdit/));
  it('HTML brut en bloc', () => echoue(article('<div>x</div>'), /HTML brut interdit/));
  it('bloc inconnu', () => echoue(article('::: encart\nx\n:::'), /bloc inconnu « ::: encart »/));
  it('bloc non fermé', () => echoue(article('::: cta\nx'), /jamais fermé/));
  it('attribut de bloc inconnu', () => echoue(article('::: cta couleur="rouge"\nx\n:::'), /attribut « couleur » inconnu/));
  it('attribut non autorisé', () => echoue(article('Texte {.rouge}'), /attribut non autorisé « \.rouge »/));

  it('lien interne inconnu', () =>
    echoue(article('[le guide](/guides/trouver-un-nom-de-marque)'), /adresse que le site ne sert pas : \/guides\/trouver-un-nom-de-marque/));

  it('liens interne, ancre, externe', () => {
    const a = compiler(article('[a](/guides/trouver-nom-de-marque#methode) et [b](https://www.inpi.fr/x)'));
    const html = (a.segments[0] as { html: string }).html;
    expect(html).toMatch(/<a href="\/guides\/trouver-nom-de-marque#methode">a<\/a>/);
    expect(html).toMatch(/<a href="https:\/\/www.inpi.fr\/x" target="_blank" rel="noopener">b<\/a>/);
    expect(a.liens).toEqual(['/guides/trouver-nom-de-marque']);
  });

  it('chemin déjà servi par une page du site', () => echoue(article('x', { path: '/blog' }), /déjà servi/));

  it('blocs découpés en segments, dans l’ordre', () => {
    const a = compiler(
      article(
        'Avant.\n\n::: cta heading="Vérifiez votre nom" label="Tester un nom"\nDomaines et marques :\nen une saisie.\n:::\n\nAprès.\n\n::: trois-risques\nUne intro.\n:::\n',
      ),
    );
    expect(a.segments.map((s) => s.type)).toEqual(['html', 'cta', 'html', 'trois-risques']);
    expect(a.segments[1]).toMatchObject({ heading: 'Vérifiez votre nom', label: 'Tester un nom', subheading: 'Domaines et marques : en une saisie.' });
    expect(a.segments[3]).toMatchObject({ intro: 'Une intro.' });
  });

  it('classes et tableaux', () => {
    const html = (compiler(article('Chapeau. {.lead}\n\n| Outil | Domaine |\n|---|---|\n| Namorama | Oui {.yes} |\n')).segments[0] as { html: string }).html;
    expect(html).toMatch(/<p class="lead">Chapeau.<\/p>/);
    expect(html).toMatch(/<table class="compare">/);
    expect(html).toMatch(/<td class="yes">Oui<\/td>/);
  });

  it('typographie française, hors code et hors URL', () => {
    const html = (compiler(article('Combien coûte un dépôt de marque ? « Oui » : 190 € et 3 %. `a : b` [x](https://a.fr/b?c=d)')).segments[0] as { html: string }).html;
    expect(html).toContain('marque ?');
    expect(html).toContain('« Oui » :');
    expect(html).toContain('190 € et 3 %');
    expect(html).toContain('<code>a : b</code>');
    expect(html).toMatch(/href="https:\/\/a.fr\/b\?c=d"/);
    expect(typographie('Pourquoi ?')).toBe('Pourquoi ?');
  });

  it('« 1er » en exposant dans le corps, pas dans le code ni les blocs', () => {
    const a = compiler(article('Mesuré le 1er août, pas le 11er. `1er`\n\n::: cta\nLe 1er mois.\n:::'));
    expect((a.segments[0] as { html: string }).html).toMatch(/le 1<sup>er<\/sup> août, pas le 11er\. <code>1er<\/code>/);
    expect(a.segments[1]).toMatchObject({ subheading: 'Le 1er mois.' });
  });

  it('1 100 mots → 5 min de lecture', () => {
    const corps = Array.from({ length: 1098 }, () => 'mot').join(' ');
    expect(compiler(article(corps)).lecture).toBe(5); // + « Le titre » = 1 100 mots
  });

  it('date du jour à Paris, pas celle du processus', () => {
    expect(dateDeParis(new Date('2026-11-29T23:30:00Z'))).toBe('2026-11-30');
    expect(dateDeParis(new Date('2027-06-07T05:00:00Z'))).toBe('2027-06-07');
  });
});

describe('compilateur — articles-en-base', () => {
  it('accumule les causes au lieu de s’arrêter à la première', () => {
    const c = causes(article('[x](/nulle-part) et <b>gras</b>', { categorie: 'Secteurs' }));
    expect(c.length).toBeGreaterThanOrEqual(2);
    expect(c.join('\n')).toMatch(/nulle-part/);
    expect(c.join('\n')).toMatch(/HTML brut/);
  });

  it('plusieurs fautes d’en-tête rendues ensemble', () => {
    expect(causes(article('x', { categorie: 'Secteur', publie: '01/12/2026' }))).toHaveLength(2);
  });

  it('le HTML brut désigne sa ligne', () => {
    const src = article('Un paragraphe.\n\n<div class="encart">x</div>');
    // en-tête de 10 lignes, titre ligne 11, vide, paragraphe ligne 13, vide, div ligne 15
    expect(causes(src)[0]).toMatch(/^ligne 15 : HTML brut interdit : « <div class="encart">/);
  });

  it.each([
    ['/nom-de-restaurant', false],
    ['/blog/nom-de-restaurant', true],
    ['/namorama-vs-looka', true],
    ['/blog/Nom', false],
  ])('chemin %s admis : %s', (path, admis) => {
    const r = compilerArticle(article('x', { path }), contexte());
    expect(r.ok).toBe(admis);
    if (!r.ok) expect(r.causes.join()).toMatch(/\/blog\/<identifiant>|path invalide/);
  });

  it('brouillon : un lien vers un autre brouillon est admis', () => {
    expect(compiler(article('[b](/blog/autre)'), contexte({ '/blog/autre': null })).liens).toEqual(['/blog/autre']);
  });

  it('publication : un lien vers un brouillon est refusé', () =>
    echoue(article('[b](/blog/autre)'), /lien vers \/blog\/autre, article en brouillon/, contexte({ '/blog/autre': null }, true)));

  it('publication : un lien vers un article programmé plus tard nomme le lien et la date', () =>
    echoue(
      article('Voir [la suite](/blog/suivant#x).', { publie: '2026-11-30', misAJour: '2026-11-30' }),
      /lien vers \/blog\/suivant#x, article programmé le 2026-12-07/,
      contexte({ '/blog/suivant': '2026-12-07' }, true),
    ));

  it('publication : un lien vers un article paru le même jour est admis', () => {
    const src = article('Voir [b](/blog/b).', { publie: '2026-11-30', misAJour: '2026-11-30' });
    expect(compilerArticle(src, contexte({ '/blog/b': '2026-11-30' }, true)).ok).toBe(true);
  });

  it('article déjà paru : il cite tout ce qui a paru à ce jour (guide de juin mis à jour en septembre)', () => {
    const src = article('Voir [b](/blog/b).', { publie: '2026-06-10', misAJour: '2026-09-03' });
    expect(compilerArticle(src, contexte({ '/blog/b': '2026-09-03' }, true)).ok).toBe(true);
    echoue(src, /article programmé le 2026-12-07/, contexte({ '/blog/b': '2026-12-07' }, true));
  });

  it('un lien vers soi-même ne dépend pas de la date', () => {
    expect(compilerArticle(article('[ici](/blog/essai#a)'), contexte({ '/blog/essai': null }, true)).ok).toBe(true);
  });

  it('ligne # revision lue, retirée et remise', () => {
    const src = article('x');
    const avec = avecRevision(src, 4);
    expect(avec.startsWith('---\n# revision: 4\npath:')).toBe(true);
    expect(lireEnTete(avec).revision).toBe(4);
    expect(sansRevision(avec)).toBe(src);
    expect(avecRevision(avec, 5)).toBe(avecRevision(src, 5));
    expect(compiler(avec).path).toBe('/blog/essai');
  });
});
