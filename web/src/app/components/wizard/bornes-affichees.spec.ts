import { bornesAffichees } from './bornes-affichees';
import cas from './bornes-de-longueur.cas.json';

/**
 * Même table que `api/src/domain/recherche-boucle.spec.ts` : l'écran annonce
 * exactement les bornes que le serveur appliquera.
 */
describe('bornesAffichees', () => {
  for (const c of cas as { cas: string; brief: [number | null, number | null]; reglage: { minLength?: number; maxLength?: number }; attendu: unknown }[]) {
    it(c.cas, () => {
      expect(bornesAffichees({ min: c.brief[0], max: c.brief[1] }, c.reglage)).toEqual(c.attendu);
    });
  }
});
