import { renouvellementDu } from './users.service';

/**
 * Le renouvellement mensuel est paresseux : il s'écrit au premier passage du
 * mois. `renouvellementDu` est la règle partagée entre ce renouvellement et
 * l'affichage de l'administration — si elles divergeaient, l'admin montrerait
 * un solde que l'utilisateur ne verra pas.
 */
describe('renouvellementDu', () => {
  const le22septembre = new Date(2026, 8, 22, 13, 0, 0);

  it('est dû quand la dernière remise à zéro date du mois précédent', () => {
    expect(renouvellementDu(new Date(2026, 7, 31, 23, 59, 0), le22septembre)).toBe(true);
  });

  it('ne l\'est plus dès qu\'elle date du mois courant, même du 1er à minuit', () => {
    expect(renouvellementDu(new Date(2026, 8, 1, 0, 0, 0), le22septembre)).toBe(false);
  });

  it('est dû pour un compte qui n\'a jamais été remis à zéro', () => {
    expect(renouvellementDu(null, le22septembre)).toBe(true);
  });
});
