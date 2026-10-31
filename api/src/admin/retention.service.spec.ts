import { PresenceMensuelle, RetentionService } from './retention.service';

/**
 * Cas tiré du relevé de production du 31/10/2026 : 40 actifs en septembre,
 * 52 en octobre dont 51 inscrits en octobre et 1 seul déjà actif en septembre.
 */
describe('RetentionService.decomposer', () => {
  const presences: PresenceMensuelle[] = [];
  // Septembre : 39 inscrits de septembre, et 1 compte d'août.
  for (let i = 0; i < 39; i++) presences.push({ userId: 100 + i, mois: '2026-09', cree: '2026-09' });
  presences.push({ userId: 1, mois: '2026-08', cree: '2026-08' });
  presences.push({ userId: 1, mois: '2026-09', cree: '2026-08' });
  // Octobre : 51 inscrits d'octobre, et le compte d'août, revenu.
  for (let i = 0; i < 51; i++) presences.push({ userId: 200 + i, mois: '2026-10', cree: '2026-10' });
  presences.push({ userId: 1, mois: '2026-10', cree: '2026-08' });

  const inscrits = new Map([['2026-08', 10], ['2026-09', 39], ['2026-10', 51]]);
  const { mensuel, cohortes } = RetentionService.decomposer(presences, inscrits, '2026-08-23', '2026-10');

  it('octobre : 51 nouveaux, 1 retenu, 0 réactivé, 39 perdus', () => {
    const oct = mensuel.find((m) => m.mois === '2026-10')!;
    expect(oct).toMatchObject({ actifs: 52, nouveaux: 51, retenus: 1, reactives: 0, perdus: 39, enCours: true });
  });

  it('août, début du journal le 23 : ni retenus, ni réactivés, ni perdus, mois incomplet', () => {
    const aout = mensuel[0];
    expect(aout).toMatchObject({ mois: '2026-08', retenus: null, reactives: null, perdus: null, debutDuJournal: true });
  });

  it('un compte revenu après un mois d\'absence est réactivé', () => {
    const p: PresenceMensuelle[] = [
      { userId: 7, mois: '2026-08', cree: '2026-08' },
      { userId: 7, mois: '2026-10', cree: '2026-08' },
    ];
    const r = RetentionService.decomposer(p, new Map(), '2026-08-01', '2026-10');
    expect(r.mensuel.map((m) => [m.mois, m.reactives, m.perdus])).toEqual([
      ['2026-08', null, null], ['2026-09', 0, 1], ['2026-10', 1, 0],
    ]);
    expect(r.mensuel[0].debutDuJournal).toBe(false);
  });

  it('cohorte de septembre au 31/10 : M+1 en cours, mois à venir absents', () => {
    const sept = cohortes.find((c) => c.mois === '2026-09')!;
    expect(sept.inscrits).toBe(39);
    expect(sept.suivants).toEqual([{ decalage: 1, mois: '2026-10', actifs: 0, enCours: true }]);
  });

  it('cohorte d\'août : M+1 complet, M+2 en cours', () => {
    const aout = cohortes.find((c) => c.mois === '2026-08')!;
    expect(aout.suivants.map((s) => [s.mois, s.actifs, s.enCours])).toEqual([
      ['2026-09', 1, false], ['2026-10', 1, true],
    ]);
  });

  it('borne le triangle à cinq mois après l\'inscription', () => {
    const r = RetentionService.decomposer([], new Map([['2026-01', 3]]), '2026-01-01', '2026-10');
    expect(r.cohortes[0].suivants.map((s) => s.decalage)).toEqual([1, 2, 3, 4, 5]);
  });

  it('sans journal, rien', () => {
    expect(RetentionService.decomposer(presences, inscrits, null, '2026-10')).toEqual({ mensuel: [], cohortes: [] });
  });
});
