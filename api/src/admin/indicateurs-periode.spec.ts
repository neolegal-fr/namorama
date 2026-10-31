import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { bornesDuMois, engagement, estUnMois, moisPrecedent, taux } from './indicateurs';

/**
 * Les cas viennent du relevé de production du 31/10/2026 (comptes admin et
 * internes exclus) : 52 actifs sur 30 jours dont 51 inscrits dans la fenêtre,
 * 63 jours d'activité, 8 projets sur 52 avec un favori.
 */
describe('indicateurs de période', () => {
  const debut = new Date(2026, 9, 1, 0, 0, 0);
  const avant = new Date(2026, 5, 10);
  const pendant = new Date(2026, 9, 12);

  /** 52 comptes, 63 jours : 45 venus un jour, 5 deux jours, 1 trois jours, 1 cinq jours. */
  const octobre = [
    ...Array.from({ length: 45 }, () => ({ jours: 1, createdAt: pendant })),
    ...Array.from({ length: 5 }, () => ({ jours: 2, createdAt: pendant })),
    { jours: 3, createdAt: pendant },
    { jours: 5, createdAt: avant },
  ];

  it('DAU moyen 2,1 et DAU/MAU 4 % sur trente jours', () => {
    const e = engagement(octobre, debut, 30);
    expect(e.joursActifs).toBe(63);
    expect(e.dauMoyen).toBe(2.1);
    expect(e.dauSurMau).toBe(4);
  });

  it('sépare nouveaux et récurrents', () => {
    const e = engagement(octobre, debut, 30);
    expect([e.nouveaux, e.recurrents]).toEqual([51, 1]);
  });

  it('répartit les actifs en trois tranches dont la somme est le MAU', () => {
    const { tranches } = engagement(octobre, debut, 30);
    expect(tranches).toEqual({ unJour: 45, deuxATrois: 6, quatreEtPlus: 1 });
    expect(tranches.unJour + tranches.deuxATrois + tranches.quatreEtPlus).toBe(52);
  });

  it("n'a ni DAU moyen ni DAU/MAU sur sept jours", () => {
    const e = engagement(octobre, debut, 7);
    expect(e.dauMoyen).toBeNull();
    expect(e.dauSurMau).toBeNull();
  });

  it('taux de succès : 8 projets sur 52 → 15,4 %', () => {
    expect(taux(8, 52)).toBe(15.4);
  });

  it('pas de taux sous le socle de 5', () => {
    expect(taux(1, 3)).toBeNull();
    expect(taux(0, 0)).toBeNull();
  });

  it('septembre 2026 : du 1er à minuit au 30 à 23:59:59, comparé à août entier', () => {
    const { debut: d, fin: f } = bornesDuMois('2026-09');
    expect([d.getDate(), d.getMonth(), d.getHours()]).toEqual([1, 8, 0]);
    expect([f.getDate(), f.getMonth(), f.getHours(), f.getMinutes(), f.getSeconds()]).toEqual([30, 8, 23, 59, 59]);
    expect(moisPrecedent('2026-09')).toBe('2026-08');
    const aout = bornesDuMois('2026-08');
    expect(aout.fin.getDate()).toBe(31);
    expect(aout.fin.getTime() + 1).toBe(d.getTime());
  });

  it('janvier se compare à décembre de l\'année précédente', () => {
    expect(moisPrecedent('2027-01')).toBe('2026-12');
  });

  describe('fenêtres comparées', () => {
    it('un mois civil se compare au mois civil précédent', () => {
      const f = AdminService.fenetres(undefined, undefined, '2026-09');
      expect(f.debutPrecedent.getMonth()).toBe(7);
      expect(f.debutPrecedent.getDate()).toBe(1);
      expect(f.finPrecedente.getTime() + 1).toBe(f.debut.getTime());
    });

    it('une fenêtre glissante se compare à la même durée, sans chevauchement', () => {
      const fin = new Date(2026, 9, 31, 12);
      const debut = new Date(2026, 9, 1, 12);
      const f = AdminService.fenetres(debut, fin);
      expect(f.fin.getTime() - f.debut.getTime()).toBe(f.debut.getTime() - f.debutPrecedent.getTime());
      expect(f.finPrecedente.getTime()).toBe(debut.getTime() - 1);
    });

    it('trente jours par défaut', () => {
      const f = AdminService.fenetres();
      expect(Math.round((f.fin.getTime() - f.debut.getTime()) / 86_400_000)).toBe(30);
    });

    it('refuse une fenêtre de moins d\'un jour, et un mois mal formé', () => {
      const fin = new Date(2026, 9, 31, 12);
      expect(() => AdminService.fenetres(new Date(fin.getTime() - 3_600_000), fin)).toThrow(BadRequestException);
      expect(() => AdminService.fenetres(undefined, undefined, '2026-13')).toThrow(BadRequestException);
    });
  });

  it('refuse un mois mal formé', () => {
    expect(estUnMois('2026-13')).toBe(false);
    expect(estUnMois('2026-9')).toBe(false);
    expect(() => bornesDuMois('septembre')).toThrow();
  });
});
