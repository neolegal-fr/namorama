/**
 * Plan du site : le gabarit `public/sitemap.xml` complété des articles parus.
 *
 * Servi par le service du blog à chaque demande (`server.ts`) : un article publié ou
 * programmé y paraît le jour dit, sans déploiement (chantier `articles-en-base`).
 */
export const DEBUT = '<!-- articles:debut (rendu à chaque demande par le service du blog, src/server.ts) -->';
export const FIN = '<!-- articles:fin -->';

export interface LigneDuPlan {
  path: string;
  publie: string;
  misAJour: string;
}

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function planDuSite(gabarit: string, articles: readonly LigneDuPlan[], origine = 'https://namorama.com'): string {
  const a = gabarit.indexOf(DEBUT);
  const b = gabarit.indexOf(FIN);
  if (a < 0 || b < a) throw new Error(`sitemap.xml : marqueurs « ${DEBUT} » et « ${FIN} » introuvables`);
  const lignes = [...articles]
    .sort((x, y) => y.publie.localeCompare(x.publie) || x.path.localeCompare(y.path))
    .map(
      (art) =>
        `  <url>\n    <loc>${origine}${echapper(art.path)}</loc>\n    <lastmod>${echapper(art.misAJour)}</lastmod>\n` +
        `    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`,
    )
    .join('');
  return `${gabarit.slice(0, a + DEBUT.length)}\n${lignes}  ${gabarit.slice(b)}`;
}
