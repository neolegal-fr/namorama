import { EventEmitter } from 'events';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DomainController } from './domain.controller';
import { SearchDomainsDto } from './dto/search-domains.dto';

/**
 * Le flux de recherche porte ce que le service ne peut pas garantir seul : ce
 * qui est **débité**, ce qui est **enregistré**, et ce que le front apprend
 * pour ne plus reproposer un nom déjà vérifié. Une recherche interrompue ne
 * doit rien coûter.
 */

const user = { sub: 'kc-123', email: 'me@example.com' };

/** Une réponse SSE minimale : elle note ce qu'on lui écrit, et peut se fermer. */
function fausseReponse() {
  const res: any = new EventEmitter();
  res.ecrits = [] as any[];
  res.writableEnded = false;
  res.setHeader = jest.fn();
  res.flushHeaders = jest.fn();
  res.status = jest.fn().mockReturnValue({ json: jest.fn() });
  res.write = jest.fn((chunk: string) => { res.ecrits.push(JSON.parse(chunk.replace(/^data: /, ''))); });
  res.end = jest.fn(() => { res.writableEnded = true; });
  return res;
}

function make(findAvailableDomains: jest.Mock) {
  const decrementCredits = jest.fn().mockResolvedValue(90);
  const addSuggestions = jest.fn().mockImplementation(async (_p: any, results: any[]) =>
    results.map((r, i) => ({ domainName: r.name, id: `s${i}` })),
  );
  const createOrUpdate = jest.fn().mockResolvedValue({ id: 'p1' });
  const event = jest.fn();
  const ctrl = new DomainController(
    { findAvailableDomains } as any,
    { findOrCreate: jest.fn().mockResolvedValue({ keycloakId: 'kc-123', totalCredits: 100 }), decrementCredits } as any,
    { createOrUpdate, addSuggestions } as any,
    { transaction: async (cb: any) => cb({}) } as any,
    { event } as any,
    { marquer: jest.fn() } as any,
  );
  return { ctrl, decrementCredits, addSuggestions, createOrUpdate, event };
}

const dto = { description: 'une description assez longue', keywords: ['mot'], extensions: ['.com'] } as any;

/** Simule le service : émet `n` résultats, puis rend la main avec la raison donnée. */
function service(n: number, stopReason: string, avant?: (opts: any) => void) {
  return jest.fn().mockImplementation(async (_d: string, _k: string[], opts: any) => {
    avant?.(opts);
    for (let i = 0; i < n; i++) opts.onEvent({ type: 'result', domain: { name: `nom${i}` } });
    return {
      results: [], totalChecked: 40, verifiedNames: ['pris1', 'pris2', 'nom0'],
      attempts: 7, stopReason, minLengthUsed: 7, maxLengthUsed: 9, origineDesBornes: 'brief',
      constraints: { avoidEndings: ['ora', 'ia'], avoidWords: ['cyber'], requiredWords: [], nameType: 'invented' },
      ecartes: { longueur: 4, terminaison: 2, mot_a_eviter: 0, mot_impose: 0 },
      unresolved: {}, sources: { dns: 0, registre: 0 },
    };
  });
}

describe('DomainController.searchStream — débit et noms vérifiés', () => {
  it('débite le nombre de noms rendus et renvoie les noms vérifiés dans `done`', async () => {
    const { ctrl, decrementCredits, event } = make(service(6, 'time'));
    const res = fausseReponse();

    await ctrl.searchStream(dto, user, res, { headers: {} } as any);

    expect(decrementCredits).toHaveBeenCalledWith('kc-123', 6, expect.anything());
    const done = res.ecrits.find((e: any) => e.type === 'done');
    expect(done.checkedNames).toEqual(['pris1', 'pris2', 'nom0']);
    expect(done.ecartes).toEqual({ longueur: 4, terminaison: 2, mot_a_eviter: 0, mot_impose: 0 });
    expect(done.found).toBe(6);
    const fin = event.mock.calls.find((c: any[]) => c[0] === 'search_completed')[1];
    expect(fin).toMatchObject({ attempts: 7, stopReason: 'time', found: 6 });
    // Le cahier des charges est journalisé en décomptes, jamais en clair.
    expect(fin).toMatchObject({
      minLengthUsed: 7, maxLengthUsed: 9, origineDesBornes: 'brief',
      terminaisonsInterdites: 2, motsAEviter: 1, motsImposes: 0, typeDuBrief: 'invented', styles: 'standard',
      ecartes: { longueur: 4, terminaison: 2, mot_a_eviter: 0, mot_impose: 0 },
    });
    expect(JSON.stringify(fin)).not.toMatch(/ora|cyber|description/);
  });

  it('transmet au service un signal qui se déclenche à la fermeture de la connexion', async () => {
    let signal: AbortSignal | undefined;
    const res = fausseReponse();
    const { ctrl } = make(service(0, 'target', (opts) => { signal = opts.signal; res.emit('close'); }));

    await ctrl.searchStream(dto, user, res, { headers: {} } as any);

    expect(signal?.aborted).toBe(true);
  });

  it('ne débite ni n’enregistre rien quand la recherche est interrompue', async () => {
    const { ctrl, decrementCredits, addSuggestions, createOrUpdate, event } = make(service(3, 'aborted'));
    const res = fausseReponse();

    await ctrl.searchStream(dto, user, res, { headers: {} } as any);

    expect(decrementCredits).not.toHaveBeenCalled();
    expect(addSuggestions).not.toHaveBeenCalled();
    expect(createOrUpdate).not.toHaveBeenCalled();
    expect(res.ecrits.find((e: any) => e.type === 'done')).toBeUndefined();
    expect(event.mock.calls.map((c: any[]) => c[0])).toContain('search_aborted');
    expect(event.mock.calls.map((c: any[]) => c[0])).not.toContain('search_completed');
  });

  it('ne déclenche pas l’annulation quand la réponse s’est terminée normalement', async () => {
    let signal: AbortSignal | undefined;
    const res = fausseReponse();
    const { ctrl } = make(service(1, 'target', (opts) => { signal = opts.signal; }));

    await ctrl.searchStream(dto, user, res, { headers: {} } as any);
    res.emit('close');

    expect(signal?.aborted).toBe(false);
  });
});

describe('SearchDomainsDto — liste d’exclusion', () => {
  const base = { description: 'une description assez longue pour passer', keywords: ['mot'] };

  it('accepte 2 000 exclusions', async () => {
    const d = plainToInstance(SearchDomainsDto, { ...base, excludeNames: Array.from({ length: 2000 }, (_, i) => `n${i}`) });
    const erreurs = await validate(d);
    expect(erreurs.find(e => e.property === 'excludeNames')).toBeUndefined();
  });

  it('refuse 2 001 exclusions', async () => {
    const d = plainToInstance(SearchDomainsDto, { ...base, excludeNames: Array.from({ length: 2001 }, (_, i) => `n${i}`) });
    const erreurs = await validate(d);
    expect(erreurs.find(e => e.property === 'excludeNames')).toBeDefined();
  });
});

describe('SearchDomainsDto — longueur : un maximum, un ancien minimum toléré', () => {
  const base = { description: 'une description assez longue pour passer', keywords: ['mot'] };
  const erreurSur = async (corps: object, champ: string) =>
    (await validate(plainToInstance(SearchDomainsDto, { ...base, ...corps }))).find(e => e.property === champ);

  it('accepte minLength 5, envoyé par un onglet ouvert avant le changement', async () => {
    expect(await erreurSur({ minLength: 5 }, 'minLength')).toBeUndefined();
  });

  it('accepte maxLength 30, « sans limite »', async () => {
    expect(await erreurSur({ maxLength: 30 }, 'maxLength')).toBeUndefined();
  });

  it('refuse maxLength 5, sous le plancher', async () => {
    expect(await erreurSur({ maxLength: 5 }, 'maxLength')).toBeDefined();
  });
});
