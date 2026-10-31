import { DUREE_DE_VIE_MS, signerLien, verifierLien } from './liens-de-retour';

const SECRET = 'secret-de-test-assez-long-pour-hmac';
const SUB = '6f1c9a2e-1111-4222-8333-944455556666';

describe('liens signés des demandes de retour', () => {
  it('aller-retour : le compte et l\'action reviennent intacts', () => {
    for (const action of ['oui', 'non', 'desinscription'] as const) {
      expect(verifierLien(SECRET, signerLien(SECRET, SUB, action))).toEqual({ keycloakId: SUB, action });
    }
  });

  it('refuse une signature altérée', () => {
    const jeton = signerLien(SECRET, SUB, 'oui');
    const altere = jeton.slice(0, -2) + (jeton.endsWith('AA') ? 'BB' : 'AA');
    expect(verifierLien(SECRET, altere)).toBeNull();
  });

  it('refuse un compte ou une action changés sans re-signer', () => {
    const [, signature] = signerLien(SECRET, SUB, 'non').split('.');
    const exp = Date.now() + DUREE_DE_VIE_MS;
    const autreCompte = Buffer.from(`autre-sub.non.${exp}`).toString('base64url');
    const autreAction = Buffer.from(`${SUB}.oui.${exp}`).toString('base64url');
    expect(verifierLien(SECRET, `${autreCompte}.${signature}`)).toBeNull();
    expect(verifierLien(SECRET, `${autreAction}.${signature}`)).toBeNull();
  });

  it('refuse un lien signé avec un autre secret', () => {
    expect(verifierLien(SECRET, signerLien('un-autre-secret', SUB, 'oui'))).toBeNull();
  });

  it('refuse un lien expiré', () => {
    const emis = Date.now() - DUREE_DE_VIE_MS - 1000;
    expect(verifierLien(SECRET, signerLien(SECRET, SUB, 'oui', emis))).toBeNull();
  });

  it('sans secret : ni signature ni vérification', () => {
    expect(() => signerLien('', SUB, 'oui')).toThrow(/FEEDBACK_LINK_SECRET/);
    expect(verifierLien('', signerLien(SECRET, SUB, 'oui'))).toBeNull();
  });

  it('refuse les entrées qui n\'ont pas la forme d\'un jeton', () => {
    for (const j of [undefined, null, 42, '', 'abc', 'a.b.c', 'x'.repeat(600)]) {
      expect(verifierLien(SECRET, j)).toBeNull();
    }
  });
});
