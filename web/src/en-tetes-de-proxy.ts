/**
 * En-têtes de proxy retirés avant le rendu. Angular 21 refuse de rendre une requête
 * qui porte `X-Forwarded-*` sans `trustProxyHeaders`, et sert la coquille vide — en
 * 200, sans erreur. Le nginx de l'hôte les pose sur chaque requête : relayés, toutes les
 * pages du blog partaient vides aux robots (constaté au test des conteneurs, 23/11/2026).
 * nginx les retire déjà ; les retirer ici rend le service sûr derrière n'importe quel
 * proxy. Le rendu n'a pas besoin de l'adresse du client.
 */
export function sansEnTetesDeProxy(entetes: Record<string, unknown>): void {
  for (const nom of Object.keys(entetes)) {
    if (nom.startsWith('x-forwarded-') || nom === 'forwarded') delete entetes[nom];
  }
}
