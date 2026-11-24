/**
 * Rend absolues les URL d'actifs d'une page rendue par le service du blog.
 *
 * Même règle que `scripts/absolutiser-les-assets.mjs`, qui traite les pages prérendues
 * au build (voir CLAUDE.md, « Pages prérendues : les URL d'actifs sont ABSOLUES ») :
 * Angular émet `<script src="main-XXXX.js">` en relatif ; GPTBot le résolvait contre le
 * répertoire de la page (`/guides/main-XXXX.js`, 404). Une page rendue à la demande ne
 * passe pas par ce script : elle est corrigée ici, à la volée.
 *
 * Seule une cible qui existe à la racine de la sortie est réécrite : une URL qu'on ne
 * sait pas résoudre est laissée telle quelle plutôt que transformée en lien mort.
 */
const RELATIF = /\b(src|href)="(?!\/|#|\?|[a-zA-Z][a-zA-Z0-9+.-]*:)([^"]+)"/g;

export function absolutiser(html: string, aLaRacine: ReadonlySet<string>): string {
  return html.replace(RELATIF, (tout, attr: string, cible: string) => (aLaRacine.has(cible) ? `${attr}="/${cible}"` : tout));
}
