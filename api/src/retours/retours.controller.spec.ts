import { RetoursController } from './retours.controller';
import { CREDITS_UTILITE, RetoursService } from './retours.service';
import { signerLien } from './liens-de-retour';

/**
 * Chantier `demande-de-retour-automatique` : un clic « oui » ou « non »
 * enregistre la réponse et accorde 100 crédits, une fois par compte, sans
 * connexion. La base est simulée ; la requête conditionnelle sert de verrou.
 */
const SECRET = 'secret-de-test';
const SUB = 'sub-lea';

function fabrique(compte: { utilite?: string | null; utiliteAt?: Date | null; desinscritRetoursAt?: Date | null; demandeRetourAt?: Date | null } | null) {
  const etat = compte ? { keycloakId: SUB, extraCredits: 0, utilite: null, utiliteAt: null, desinscritRetoursAt: null, demandeRetourAt: null, ...compte } : null;
  // `UPDATE … WHERE <champ> IS NULL` : ne touche la ligne que si le champ est vide.
  const update = (champ: 'utiliteAt' | 'desinscritRetoursAt') => ({
    set: (valeurs: any) => ({
      where: () => ({
        execute: async () => {
          if (!etat || etat[champ]) return { affected: 0 };
          Object.assign(etat, { ...valeurs, [champ]: new Date() });
          if (champ === 'utiliteAt') etat.utilite = valeurs.utilite;
          return { affected: 1 };
        },
      }),
    }),
  });
  const manager = {
    createQueryBuilder: () => ({ update: () => update('utiliteAt') }),
    findOne: async () => etat,
    increment: jest.fn(async (_e: any, _w: any, _c: string, n: number) => { if (etat) etat.extraCredits += n; }),
  };
  const dataSource = {
    transaction: async (fn: any) => fn(manager),
    createQueryBuilder: () => ({ update: () => update('desinscritRetoursAt') }),
  } as any;
  const events = { event: jest.fn() } as any;
  const config = { get: (k: string) => (k === 'FEEDBACK_LINK_SECRET' ? SECRET : undefined) } as any;
  const ctrl = new RetoursController(new RetoursService(dataSource, events, config));
  return { ctrl, etat, events, manager };
}

describe('POST /retours/utilite', () => {
  it('premier clic sur « non » : réponse enregistrée et 100 crédits', async () => {
    const envoi = new Date(Date.now() - 3600_000);
    const { ctrl, etat, events } = fabrique({ demandeRetourAt: envoi });
    await expect(ctrl.repondre({ j: signerLien(SECRET, SUB, 'non') }))
      .resolves.toEqual({ enregistree: true, dejaRepondu: false, reponse: 'non', credits: CREDITS_UTILITE });
    expect(etat!.extraCredits).toBe(100);
    expect(etat!.utilite).toBe('non');
    expect(events.event).toHaveBeenCalledWith('feedback_utility_answered', expect.objectContaining({ userId: SUB, reponse: 'non' }));
  });

  it('second clic, même sur l\'autre réponse : rien ne change, aucun crédit', async () => {
    const { ctrl, etat, events } = fabrique({});
    await ctrl.repondre({ j: signerLien(SECRET, SUB, 'non') });
    await expect(ctrl.repondre({ j: signerLien(SECRET, SUB, 'oui') }))
      .resolves.toEqual({ enregistree: false, dejaRepondu: true, reponse: 'non', credits: 0 });
    expect(etat!.extraCredits).toBe(100);
    expect(events.event).toHaveBeenCalledTimes(1);
  });

  it('jeton falsifié : 400, rien d\'écrit ni de crédité', async () => {
    const { ctrl, etat } = fabrique({});
    const jeton = signerLien('un-autre-secret', SUB, 'oui');
    await expect(ctrl.repondre({ j: jeton })).rejects.toMatchObject({ status: 400 });
    expect(etat!.extraCredits).toBe(0);
    expect(etat!.utilite).toBeNull();
  });

  it('un lien de désinscription ne vaut pas réponse', async () => {
    const { ctrl } = fabrique({});
    await expect(ctrl.repondre({ j: signerLien(SECRET, SUB, 'desinscription') })).rejects.toMatchObject({ status: 400 });
  });

  it('compte supprimé depuis : 400', async () => {
    const { ctrl } = fabrique(null);
    await expect(ctrl.repondre({ j: signerLien(SECRET, SUB, 'oui') })).rejects.toMatchObject({ status: 400 });
  });
});

describe('POST /retours/desinscription', () => {
  it('depuis la page : compte désinscrit, événement journalisé', async () => {
    const { ctrl, etat, events } = fabrique({});
    await expect(ctrl.desinscrire({ j: signerLien(SECRET, SUB, 'desinscription') })).resolves.toEqual({ desinscrit: true });
    expect(etat!.desinscritRetoursAt).toBeInstanceOf(Date);
    expect(events.event).toHaveBeenCalledWith('feedback_unsubscribed', { userId: SUB });
  });

  it('en un clic par la messagerie : jeton dans l\'adresse, corps « List-Unsubscribe=One-Click »', async () => {
    const { ctrl, etat } = fabrique({});
    await ctrl.desinscrire({ 'List-Unsubscribe': 'One-Click' } as any, signerLien(SECRET, SUB, 'desinscription'));
    expect(etat!.desinscritRetoursAt).toBeInstanceOf(Date);
  });

  it('deuxième désinscription : sans effet, sans second événement', async () => {
    const { ctrl, events } = fabrique({});
    const j = signerLien(SECRET, SUB, 'desinscription');
    await ctrl.desinscrire({ j });
    await ctrl.desinscrire({ j });
    expect(events.event).toHaveBeenCalledTimes(1);
  });

  it('un lien « oui » ne désinscrit pas', async () => {
    const { ctrl } = fabrique({});
    await expect(ctrl.desinscrire({ j: signerLien(SECRET, SUB, 'oui') })).rejects.toMatchObject({ status: 400 });
  });
});
