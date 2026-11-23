import { readFileSync } from 'node:fs';
import { ARTICLES, CATEGORIES, articleDe, dateLongue } from './articles';
import { RenderMode } from '@angular/ssr';
import { serverRoutes } from '../../app.routes.server';
import { routes } from '../../app.routes';
import { donneesStructurees } from './content-seo';

/** Scénarios de la spécification `blog`. */
describe('registre des articles', () => {
  it('chemins uniques, dates ISO, mise à jour postérieure à la publication', () => {
    const chemins = ARTICLES.map((a) => a.path);
    expect(new Set(chemins).size).toBe(chemins.length);
    for (const a of ARTICLES) {
      expect(a.publie).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.misAJour).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.misAJour >= a.publie).toBe(true);
      expect(CATEGORIES).toContain(a.categorie);
      expect(a.lecture).toBeGreaterThan(0);
    }
  });

  it('chaque article est routé et prérendu', () => {
    const prerendus = serverRoutes.filter((r) => r.renderMode === RenderMode.Prerender).map((r) => r.path);
    const routes_ = routes.map((r) => r.path);
    for (const a of ARTICLES) {
      expect(routes_).toContain(a.path.slice(1));
      expect(prerendus).toContain(a.path.slice(1));
    }
  });

  it('le plus récent en tête', () => {
    for (let i = 1; i < ARTICLES.length; i++) {
      expect(ARTICLES[i - 1].publie >= ARTICLES[i].publie).toBe(true);
    }
  });

  it('retrouve un article malgré query string et slash final', () => {
    expect(articleDe('/guides/trouver-nom-de-marque?x=1')?.publie).toBe('2026-06-10');
    expect(articleDe('/guides/trouver-nom-de-marque/')?.publie).toBe('2026-06-10');
    expect(articleDe('/app')).toBeUndefined();
  });

  it('date longue en français', () => {
    expect(dateLongue('2026-09-03')).toBe('3 septembre 2026');
    expect(dateLongue('2026-06-01')).toBe('1er juin 2026');
  });
});

describe('plan du site', () => {
  const plan = readFileSync('public/sitemap.xml', 'utf-8');

  it('liste /blog et chaque article avec sa date de mise à jour, pas /guides', () => {
    expect(plan).toContain('<loc>https://namorama.com/blog</loc>');
    expect(plan).not.toContain('<loc>https://namorama.com/guides</loc>');
    for (const a of ARTICLES) {
      expect(plan).toContain(`<loc>https://namorama.com${a.path}</loc>\n    <lastmod>${a.misAJour}</lastmod>`);
    }
  });
});

describe('données structurées', () => {
  const article = articleDe('/generateur-nom-de-marque')!;
  const url = 'https://namorama.com/generateur-nom-de-marque';

  it('BlogPosting seul quand la page ne déclare rien', () => {
    const ld = donneesStructurees({ title: 'T', description: 'D' }, article, url) as Record<string, unknown>;
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld['datePublished']).toBe('2026-09-03');
    expect((ld['author'] as { name: string }).name).toBe('Nicolas Riousset');
  });

  it('@graph quand la page déclare déjà un balisage', () => {
    const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] };
    const ld = donneesStructurees({ title: 'T', description: 'D', jsonLd: faq }, article, url) as { '@graph': { '@type': string }[] };
    expect(ld['@graph'].map((n) => n['@type'])).toEqual(['BlogPosting', 'FAQPage']);
  });

  it('hors registre, le balisage de la page passe tel quel', () => {
    const propre = { '@type': 'WebApplication' };
    expect(donneesStructurees({ title: 'T', description: 'D', jsonLd: propre }, undefined, url)).toBe(propre);
  });
});
