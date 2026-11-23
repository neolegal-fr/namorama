import { readFileSync } from 'node:fs';
import { RenderMode } from '@angular/ssr';
import { ARTICLES_ECRITS_A_LA_MAIN, CATEGORIES, type Article, articleEcritALaMainDe, dateLongue, indexDuBlog } from './articles';
import { CHEMINS_HISTORIQUES } from './chemins-historiques';
import { resoudreArticle, resoudreParus } from './articles-api';
import { serverRoutes } from '../../app.routes.server';
import { routes } from '../../app.routes';
import { donneesStructurees } from './content-seo';
import { DEBUT, FIN, planDuSite } from '../../../plan-du-site';
import { absolutiser } from '../../../absolutiser';
import { sansEnTetesDeProxy } from '../../../en-tetes-de-proxy';

/** Scénarios de la spécification `blog` (chantier `articles-en-base`). */
const article = (path: string, publie: string, extra: Partial<Article> = {}): Article => ({
  path,
  titre: path,
  extrait: 'x',
  categorie: 'Méthode',
  publie,
  misAJour: publie,
  lecture: 3,
  ...extra,
});

describe('registre des articles', () => {
  it('entrées écrites à la main : dates ISO, catégorie connue', () => {
    for (const a of ARTICLES_ECRITS_A_LA_MAIN) {
      expect(a.publie).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.misAJour >= a.publie).toBe(true);
      expect(CATEGORIES).toContain(a.categorie);
    }
  });

  it('index : le plus récent en tête, entrées écrites à la main comprises', () => {
    const index = indexDuBlog([article('/blog/b', '2026-11-23'), article('/blog/a', '2026-06-10')]);
    expect(index.map((a) => a.path)).toEqual(['/blog/b', '/verifier-disponibilite-nom-de-marque', '/blog/a']);
  });

  it('entrée écrite à la main retrouvée malgré query string et slash final', () => {
    expect(articleEcritALaMainDe('/verifier-disponibilite-nom-de-marque?x=1')?.publie).toBe('2026-08-05');
    expect(articleEcritALaMainDe('/verifier-disponibilite-nom-de-marque/')?.publie).toBe('2026-08-05');
    expect(articleEcritALaMainDe('/app')).toBeUndefined();
  });

  it('date longue en français', () => {
    expect(dateLongue('2026-09-03')).toBe('3 septembre 2026');
    expect(dateLongue('2026-06-01')).toBe('1er juin 2026');
  });
});

describe('routes du blog', () => {
  const rendu = (p: string) => serverRoutes.find((r) => r.path === p)?.renderMode;
  const route = (p: string) => routes.find((r) => r.path === p);

  it('index, articles du blog et adresses historiques : rendus par le serveur, avec leur résolveur', () => {
    expect(rendu('blog')).toBe(RenderMode.Server);
    expect(route('blog')?.resolve?.['articles']).toBe(resoudreParus);
    expect(rendu('blog/:slug')).toBe(RenderMode.Server);
    expect(route('blog/:slug')?.resolve?.['article']).toBe(resoudreArticle);
    for (const p of CHEMINS_HISTORIQUES) {
      expect(rendu(p.slice(1))).toBe(RenderMode.Server);
      expect(route(p.slice(1))?.resolve?.['article']).toBe(resoudreArticle);
    }
  });

  it('les pages fixes restent prérendues', () => {
    for (const p of ['', 'en', 'legal', 'privacy', 'verifier-disponibilite-nom-de-marque']) {
      expect(rendu(p)).toBe(RenderMode.Prerender);
    }
  });
});

describe('plan du site', () => {
  const gabarit = readFileSync('public/sitemap.xml', 'utf-8');

  it('le gabarit liste /blog, pas /guides, et porte ses marqueurs vides', () => {
    expect(gabarit).toContain('<loc>https://namorama.com/blog</loc>');
    expect(gabarit).not.toContain('<loc>https://namorama.com/guides</loc>');
    const entre = gabarit.slice(gabarit.indexOf(DEBUT) + DEBUT.length, gabarit.indexOf(FIN));
    expect(entre.trim()).toBe('');
  });

  it('articles parus insérés, plus récent d’abord, avec leur date de mise à jour', () => {
    const plan = planDuSite(gabarit, [
      { path: '/a', publie: '2026-01-01', misAJour: '2026-02-01' },
      { path: '/blog/b', publie: '2026-11-30', misAJour: '2026-11-30' },
    ]);
    expect(plan.indexOf('/blog/b</loc>')).toBeLessThan(plan.indexOf('/a</loc>'));
    expect(plan).toContain('<loc>https://namorama.com/a</loc>\n    <lastmod>2026-02-01</lastmod>');
    expect(planDuSite(gabarit, [])).toBe(planDuSite(planDuSite(gabarit, [{ path: '/x', publie: '2026-01-01', misAJour: '2026-01-01' }]), []));
  });
});

describe('en-têtes de proxy retirés avant le rendu', () => {
  it('retire X-Forwarded-* et Forwarded, garde le reste', () => {
    const h: Record<string, unknown> = {
      host: 'namorama.com',
      'x-forwarded-for': '1.2.3.4',
      'x-forwarded-proto': 'https',
      forwarded: 'for=1.2.3.4',
      'user-agent': 'GPTBot',
    };
    sansEnTetesDeProxy(h);
    expect(Object.keys(h).sort()).toEqual(['host', 'user-agent']);
  });
});

describe('URL d’actifs absolues dans une page rendue à la demande', () => {
  it('réécrit les fichiers de la racine, laisse le reste', () => {
    const racine = new Set(['main-ABC.js', 'styles-X.css']);
    const html = '<script src="main-ABC.js"></script><link href="styles-X.css"><a href="blog">x</a><img src="/abs.png"><a href="https://a.fr">y</a>';
    expect(absolutiser(html, racine)).toBe(
      '<script src="/main-ABC.js"></script><link href="/styles-X.css"><a href="blog">x</a><img src="/abs.png"><a href="https://a.fr">y</a>',
    );
  });
});

describe('données structurées', () => {
  const a = article('/generateur-nom-de-marque', '2026-09-03');
  const url = 'https://namorama.com/generateur-nom-de-marque';

  it('BlogPosting seul quand la page ne déclare rien', () => {
    const ld = donneesStructurees({ title: 'T', description: 'D' }, a, url) as Record<string, unknown>;
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld['datePublished']).toBe('2026-09-03');
    expect((ld['author'] as { name: string }).name).toBe('Nicolas Riousset');
  });

  it('@graph quand la page déclare déjà un balisage', () => {
    const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] };
    const ld = donneesStructurees({ title: 'T', description: 'D', jsonLd: faq }, a, url) as { '@graph': { '@type': string }[] };
    expect(ld['@graph'].map((n) => n['@type'])).toEqual(['BlogPosting', 'FAQPage']);
  });

  it('hors registre, le balisage de la page passe tel quel', () => {
    const propre = { '@type': 'WebApplication' };
    expect(donneesStructurees({ title: 'T', description: 'D', jsonLd: propre }, undefined, url)).toBe(propre);
  });
});
