// node --test scripts/articles.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilerArticle, compilerArticles, planDuSite, typographie, cheminsDesRoutes } from './articles.mjs';

const CHEMINS = new Set(['/', '/app', '/blog', '/guides/trouver-nom-de-marque']);
const entete = (extra = {}) => {
  const e = {
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
  return '---\n' + Object.entries(e).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n---\n';
};
const article = (corps, extra) => entete(extra) + '# Le titre\n\n' + corps;
const compiler = (src) => compilerArticle('essai.md', src, CHEMINS);
const echoue = (src, motif) => assert.throws(() => compiler(src), (e) => e.message.startsWith('essai.md') && motif.test(e.message));

test('en-tête, titre et HTML', () => {
  const a = compiler(article('Un paragraphe.\n\n## Section {#section}\n\nTexte.'));
  assert.equal(a.path, '/blog/essai');
  assert.equal(a.titre, "Titre d'index");
  assert.equal(a.h1, 'Le titre');
  assert.equal(a.segments.length, 1);
  assert.match(a.segments[0].html, /<h2 id="section">Section<\/h2>/);
});

test('valeurs YAML entre guillemets', () => {
  const src = article('x', { title: '"Prix : 190 € \\"tout compris\\""', titre: "'L''INPI'" });
  const a = compiler(src);
  assert.equal(a.title, 'Prix : 190 € "tout compris"');
  assert.equal(a.titre, "L'INPI");
});

test('champ manquant', () => echoue(article('x', { extrait: undefined }), /champ d'en-tête manquant : extrait/));
test('champ inconnu', () => echoue(entete() .replace('---\n', '---\nauteur: X\n') + '# T\n', /champ d'en-tête inconnu « auteur »/));
test('sans en-tête', () => echoue('# Titre\n\nTexte', /en-tête manquant/));
test('catégorie inconnue', () => echoue(article('x', { categorie: 'Secteur' }), /catégorie inconnue « Secteur ».*Secteurs/));
test('date non ISO', () => echoue(article('x', { publie: '01/12/2026' }), /publie doit être une date/));
test('date impossible', () => echoue(article('x', { publie: '2026-02-30', misAJour: '2026-03-01' }), /publie doit être une date/));
test('mise à jour antérieure', () => echoue(article('x', { misAJour: '2026-11-30' }), /antérieure à publie/));
test('sans titre #', () => echoue(entete() + 'Texte', /commencer par le titre/));
test('deux titres #', () => echoue(article('# Autre'), /un seul titre/));
test('HTML brut', () => echoue(article('Texte <span style="color:red">rouge</span>'), /HTML brut interdit/));
test('HTML brut en bloc', () => echoue(article('<div>x</div>'), /HTML brut interdit/));
test('bloc inconnu', () => echoue(article('::: encart\nx\n:::'), /bloc inconnu « ::: encart »/));
test('bloc non fermé', () => echoue(article('::: cta\nx'), /jamais fermé/));
test('attribut de bloc inconnu', () => echoue(article('::: cta couleur="rouge"\nx\n:::'), /attribut « couleur » inconnu/));
test('attribut non autorisé', () => echoue(article('Texte {.rouge}'), /attribut non autorisé « \.rouge »/));

test('lien interne inconnu', () =>
  echoue(article('[le guide](/guides/trouver-un-nom-de-marque)'), /adresse que le site ne sert pas : \/guides\/trouver-un-nom-de-marque/));

test('liens interne, ancre, externe', () => {
  const html = compiler(article('[a](/guides/trouver-nom-de-marque#methode) et [b](https://www.inpi.fr/x)')).segments[0].html;
  assert.match(html, /<a href="\/guides\/trouver-nom-de-marque#methode">a<\/a>/);
  assert.match(html, /<a href="https:\/\/www.inpi.fr\/x" target="_blank" rel="noopener">b<\/a>/);
});

test('chemin déjà déclaré par un autre fichier', () => {
  const src = article('x');
  assert.throws(
    () => compilerArticles([{ nom: 'a.md', source: src }, { nom: 'b.md', source: src }], CHEMINS),
    /b.md : path \/blog\/essai déjà déclaré par a.md/,
  );
});

test('chemin déjà servi par une page du site', () =>
  assert.throws(() => compilerArticles([{ nom: 'a.md', source: article('x', { path: '/app' }) }], CHEMINS), /déjà servi/));

test('un article peut lier un autre article', () => {
  const a = article('[voir](/blog/autre)');
  const b = article('x', { path: '/blog/autre' });
  assert.equal(compilerArticles([{ nom: 'a.md', source: a }, { nom: 'b.md', source: b }], CHEMINS).length, 2);
});

test('blocs découpés en segments, dans l’ordre', () => {
  const a = compiler(
    article(
      'Avant.\n\n::: cta heading="Vérifiez votre nom" label="Tester un nom"\nDomaines et marques :\nen une saisie.\n:::\n\nAprès.\n\n::: trois-risques\nUne intro.\n:::\n',
    ),
  );
  assert.deepEqual(a.segments.map((s) => s.type), ['html', 'cta', 'html', 'trois-risques']);
  assert.equal(a.segments[1].heading, 'Vérifiez votre nom');
  assert.equal(a.segments[1].label, 'Tester un nom');
  assert.equal(a.segments[1].subheading, 'Domaines et marques : en une saisie.');
  assert.equal(a.segments[3].intro, 'Une intro.');
});

test('classes et tableaux', () => {
  const html = compiler(article('Chapeau. {.lead}\n\n| Outil | Domaine |\n|---|---|\n| Namorama | Oui {.yes} |\n')).segments[0].html;
  assert.match(html, /<p class="lead">Chapeau.<\/p>/);
  assert.match(html, /<table class="compare">/);
  assert.match(html, /<td class="yes">Oui<\/td>/);
});

test('typographie française, hors code et hors URL', () => {
  const html = compiler(article('Combien coûte un dépôt de marque ? « Oui » : 190 € et 3 %. `a : b` [x](https://a.fr/b?c=d)')).segments[0].html;
  assert.match(html, /marque \?/);
  assert.match(html, /« Oui » :/);
  assert.match(html, /190 € et 3 %/);
  assert.match(html, /<code>a : b<\/code>/);
  assert.match(html, /href="https:\/\/a.fr\/b\?c=d"/);
  assert.equal(typographie('Pourquoi ?'), 'Pourquoi ?');
});

test('1 100 mots → 5 min de lecture', () => {
  const corps = Array.from({ length: 1098 }, () => 'mot').join(' ');
  assert.equal(compiler(article(corps)).lecture, 5); // + « Le titre » = 1 100 mots
});

test('plan du site : lignes entre les marqueurs, plus récent d’abord', () => {
  const xml = '<urlset>\n  <!-- articles:debut (généré par scripts/articles.mjs) -->\n  vieux\n  <!-- articles:fin -->\n</urlset>';
  const sortie = planDuSite(xml, [
    { path: '/a', publie: '2026-01-01', misAJour: '2026-02-01' },
    { path: '/b', publie: '2026-03-01', misAJour: '2026-03-01' },
  ]);
  assert.ok(!sortie.includes('vieux'));
  assert.ok(sortie.indexOf('/b</loc>') < sortie.indexOf('/a</loc>'));
  assert.match(sortie, /<loc>https:\/\/namorama.com\/a<\/loc>\n    <lastmod>2026-02-01<\/lastmod>/);
  assert.equal(planDuSite(sortie, [{ path: '/a', publie: '2026-01-01', misAJour: '2026-02-01' }, { path: '/b', publie: '2026-03-01', misAJour: '2026-03-01' }]), sortie);
});

test('routes lues dans app.routes.ts', () => {
  const c = cheminsDesRoutes("{ path: '' }, { path: 'blog' }, { path: 'projects/:id' }, { path: '**' }");
  assert.deepEqual([...c].sort(), ['/', '/blog']);
});
