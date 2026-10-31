/**
 * Langues dans lesquelles la demande de retour est traduite (`GABARITS`).
 * La liste vit ici, sans dépendance, pour que `UsersService` puisse capter la
 * langue d'inscription sans importer le module d'administration.
 */
export const LANGUES_TRADUITES = ['fr', 'en', 'de', 'es', 'pt', 'it', 'nl'] as const;

/**
 * Première langue d'un en-tête `Accept-Language` qui fait partie des langues
 * traduites, par ordre de préférence (`q`). `null` si aucune ne l'est : une
 * langue qu'on ne sait pas écrire ne vaut pas mieux qu'aucune.
 */
export function langueDuNavigateur(entete: unknown): string | null {
  if (typeof entete !== 'string' || !entete.trim()) return null;
  const choix = entete.slice(0, 200).split(',').map((partie, rang) => {
    const [code, ...params] = partie.trim().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const poids = q ? Number(q.slice(2)) : 1;
    return { langue: code.trim().toLowerCase().split('-')[0], poids: Number.isFinite(poids) ? poids : 0, rang };
  });
  choix.sort((a, b) => b.poids - a.poids || a.rang - b.rang);
  const retenue = choix.find((c) => c.poids > 0 && (LANGUES_TRADUITES as readonly string[]).includes(c.langue));
  return retenue?.langue ?? null;
}
