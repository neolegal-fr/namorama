import { RetentionService } from './retention.service';

describe('RetentionService', () => {
  it('range les comptes par jours d\'activité, zéro compris avec « 1 jour »', () => {
    const t = RetentionService.tranchesJours([
      { jours: 0, comptes: 1 }, { jours: 1, comptes: 28 }, { jours: 2, comptes: 3 }, { jours: 4, comptes: 1 }, { jours: 9, comptes: 2 },
    ]);
    expect(t.map((x) => x.comptes)).toEqual([29, 3, 1, 2]);
  });

  it('donne la médiane de la durée de vie en jours, nombre pair de comptes compris', () => {
    const jour = 24 * 60;
    const d = RetentionService.dureeDeVie([10, 30, 2 * jour, 40 * jour]);
    // médiane de (30 min, 2 jours) = 1 455 minutes
    expect(d.medianeMinutes).toBe(1455);
    expect(d.tranches.map((x) => x.comptes)).toEqual([2, 1, 0, 1]);
  });

  it('n\'invente pas de médiane sans compte', () => {
    expect(RetentionService.dureeDeVie([]).medianeMinutes).toBeNull();
  });
});
