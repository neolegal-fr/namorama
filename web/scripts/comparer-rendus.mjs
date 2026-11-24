#!/usr/bin/env node
/**
 * Compare le rendu des mêmes pages servies par deux origines (chantier
 * `articles-en-base`, exigence « Rendu inchangé par la migration »).
 *
 *   node scripts/comparer-rendus.mjs <origine-A> <origine-B> [chemin…]
 *   node scripts/comparer-rendus.mjs http://localhost:8091 https://namorama.com
 *
 * Sans chemin, compare `/blog` et chaque article listé par le `sitemap.xml` de B.
 *
 * Pour chaque page : texte visible (balises, scripts et styles retirés, entités
 * décodées, espaces normalisés), adresses des liens, identifiants des titres et
 * données structurées (JSON-LD, comparé en objet). Les attributs propres au rendu
 * Angular (`_ngcontent-…`) n'entrent pas dans la comparaison. Sortie non nulle au
 * premier écart, avec la page et ce qui diffère.
 *
 * Sans dépendance : le HTML est lu par expressions régulières, ce qui suffit pour des
 * pages produites par le même gabarit.
 */

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsaquo: '›', middot: '·' };

export function decoder(t) {
  return t.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tout, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITES[e.toLowerCase()] ?? tout;
  });
}

/** Ce qu'une page montre et déclare, sous une forme comparable. */
export function empreinte(html) {
  const corps = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const texte = decoder(corps.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const liens = [...corps.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)].map((m) => decoder(m[1]));
  const ids = [...corps.matchAll(/<h[1-6]\b[^>]*\sid="([^"]*)"/gi)].map((m) => m[1]);
  const jsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => {
      try {
        return JSON.stringify(JSON.parse(m[1]));
      } catch {
        return m[1].trim();
      }
    })
    .sort();
  return { texte, liens, ids, jsonLd };
}

/** Premier écart entre deux empreintes, ou `null`. */
export function ecart(a, b) {
  if (a.texte !== b.texte) {
    let i = 0;
    while (i < a.texte.length && a.texte[i] === b.texte[i]) i++;
    return `texte visible, à partir de : « ${a.texte.slice(Math.max(0, i - 40), i + 60)} » ≠ « ${b.texte.slice(Math.max(0, i - 40), i + 60)} »`;
  }
  for (const k of ['liens', 'ids', 'jsonLd']) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      const seulsA = a[k].filter((x) => !b[k].includes(x));
      const seulsB = b[k].filter((x) => !a[k].includes(x));
      return `${k} : seulement en A ${JSON.stringify(seulsA).slice(0, 300)} ; seulement en B ${JSON.stringify(seulsB).slice(0, 300)}${!seulsA.length && !seulsB.length ? ' (ordre différent)' : ''}`;
    }
  }
  return null;
}

async function lire(url) {
  const r = await fetch(url, { redirect: 'follow' });
  return { statut: r.status, html: await r.text() };
}

async function principal([origineA, origineB, ...chemins]) {
  if (!origineA || !origineB) {
    console.error('usage : node scripts/comparer-rendus.mjs <origine-A> <origine-B> [chemin…]');
    process.exit(2);
  }
  const A = origineA.replace(/\/$/, '');
  const B = origineB.replace(/\/$/, '');
  if (!chemins.length) {
    const plan = (await lire(`${B}/sitemap.xml`)).html;
    chemins = [...plan.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)<\/loc>/g)]
      .map((m) => m[1])
      .filter((p) => p === '/blog' || p.length > 1);
  }
  let ecarts = 0;
  for (const p of chemins) {
    const [a, b] = await Promise.all([lire(A + p), lire(B + p)]);
    const diff =
      a.statut !== b.statut ? `statut ${a.statut} ≠ ${b.statut}` : ecart(empreinte(a.html), empreinte(b.html));
    if (diff) {
      ecarts++;
      console.log(`✗ ${p} — ${diff}`);
    } else {
      console.log(`✓ ${p}`);
    }
  }
  console.log(`\n${chemins.length - ecarts} page(s) identique(s), ${ecarts} écart(s), sur ${chemins.length}.`);
  process.exit(ecarts ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) principal(process.argv.slice(2));
