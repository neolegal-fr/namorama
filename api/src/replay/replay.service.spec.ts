import { HttpException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { gunzipSync, gzipSync } from 'zlib';
import { bornes, cheminDEntree, contientUneErreur, ReplayService } from './replay.service';

/**
 * `POST /replay` est public, sans limite de débit : ce sont les plafonds de ce
 * service qui bornent ce qu'un tiers peut faire stocker. On les vérifie contre
 * une base simulée, qui répond aux requêtes du service par leur forme.
 */

type Lot = { sessionId: string; segment: number; seq: number; bytes: number; data: Buffer; receivedAt: Date; hasError: number; href: string | null };

function base(visites: string[] = ['visite-0001']) {
  const lots: Lot[] = [];
  let echecEcriture = false;
  const query = jest.fn(async (sql: string, p: any[] = []) => {
    if (sql.includes('FROM visitor_session WHERE sessionId')) return visites.includes(p[0]) ? [{ ok: 1 }] : [];
    if (sql.includes('SUM(bytes)') && sql.includes('WHERE sessionId')) {
      return [{ n: lots.filter(l => l.sessionId === p[0]).reduce((s, l) => s + l.bytes, 0) }];
    }
    if (sql.includes('SUM(bytes)') && sql.includes('CURDATE()')) return [{ n: 0 }];
    if (sql.startsWith('INSERT IGNORE')) {
      if (echecEcriture) throw new Error('Table absente');
      const [sessionId, segment, seq, , , , hasError, href, bytes, data] = p;
      if (lots.some(l => l.sessionId === sessionId && l.segment === segment && l.seq === seq)) return { affectedRows: 0 };
      lots.push({ sessionId, segment, seq, bytes, data, receivedAt: new Date(), hasError, href });
      return { affectedRows: 1 };
    }
    if (sql.startsWith('DELETE FROM session_replay_chunk')) {
      const limite = Date.now() - p[0] * 24 * 3600 * 1000;
      const avant = lots.length;
      for (let i = lots.length - 1; i >= 0; i--) if (lots[i].receivedAt.getTime() < limite) lots.splice(i, 1);
      return { affectedRows: avant - lots.length };
    }
    if (sql.startsWith('SELECT segment, seq, data')) {
      return lots.filter(l => l.sessionId === p[0]).sort((a, b) => a.segment - b.segment || a.seq - b.seq);
    }
    throw new Error(`requête inattendue : ${sql.slice(0, 60)}`);
  });
  return { query, lots, echouer: () => { echecEcriture = true; } };
}

function make(opts: { visites?: string[]; config?: Record<string, string> } = {}) {
  const db = base(opts.visites);
  const event = jest.fn();
  const error = jest.fn();
  const config = { get: (k: string) => opts.config?.[k] };
  const service = new ReplayService({ query: db.query } as any, { event, error, log: jest.fn() } as any, config as any);
  return { service, db, event, error };
}

/** Un lot d'environ `ko` kilo-octets une fois compressé (contenu aléatoire, donc peu compressible). */
function lot(seq: number, ko = 1, segment = 0) {
  const bruit = Array.from({ length: ko * 1024 }, () => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join('');
  return { sessionId: 'visite-0001', segment, seq, events: [{ type: 3, timestamp: 1000 + seq, data: { bruit } }] };
}

describe('ReplayService.recevoir', () => {
  it('refuse une visite inconnue, sans rien écrire', async () => {
    const { service, db } = make();
    await expect(service.recevoir({ ...lot(0), sessionId: 'inconnue-01' })).rejects.toBeInstanceOf(NotFoundException);
    expect(db.lots).toHaveLength(0);
    expect(db.query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT'))).toBe(false);
  });

  it('stocke un lot compressé, avec ses bornes, sa page d’entrée et son drapeau d’erreur', async () => {
    const { service, db } = make();
    await service.recevoir({
      sessionId: 'visite-0001', segment: 0, seq: 0,
      events: [
        { type: 4, timestamp: 100, data: { href: 'https://namorama.com/projects/42?token=secret#x', width: 1280 } },
        { type: 6, timestamp: 180, data: { plugin: 'rrweb/console@1', payload: { level: 'error', payload: ['boum'] } } },
      ],
    });
    expect(db.lots).toHaveLength(1);
    expect(db.lots[0].href).toBe('/projects/42');
    expect(db.lots[0].hasError).toBe(1);
    expect(JSON.parse(gunzipSync(db.lots[0].data).toString())).toHaveLength(2);
  });

  it('ignore un lot renvoyé, sans le compter deux fois', async () => {
    const { service, db } = make({ config: { REPLAY_MAX_SESSION_MB: '1' } });
    await service.recevoir(lot(0, 300));
    await service.recevoir(lot(0, 300));
    expect(db.lots).toHaveLength(1);
    // le doublon n'a pas consommé le plafond : deux lots de plus passent encore
    await service.recevoir(lot(1, 300));
    await service.recevoir(lot(2, 300));
    expect(db.lots).toHaveLength(3);
  });

  it('plafond de visite : 413, et un seul replay_capped', async () => {
    const { service, event } = make({ config: { REPLAY_MAX_SESSION_MB: '1' } });
    // ~330 ko compressés par lot (le bruit se compresse d'environ 18 %) : trois passent sous 1 Mo, pas quatre
    for (let i = 0; i < 3; i++) await service.recevoir(lot(i, 400));
    await expect(service.recevoir(lot(3, 400))).rejects.toBeInstanceOf(PayloadTooLargeException);
    await expect(service.recevoir(lot(4, 400))).rejects.toBeInstanceOf(PayloadTooLargeException);
    const plafonds = event.mock.calls.filter(([nom]) => nom === 'replay_capped');
    expect(plafonds).toHaveLength(1);
    expect(plafonds[0][1]).toMatchObject({ scope: 'session', sessionId: 'visite-0001' });
  });

  it('plafond du jour : 429 pour toutes les visites, signalé une fois', async () => {
    const visites = ['visite-0001', 'visite-0002', 'visite-0003'];
    const { service, event } = make({ visites, config: { REPLAY_MAX_DAY_MB: '1' } });
    // ~490 ko compressés par lot : deux passent sous 1 Mo, le troisième non, quelle que soit la visite
    await service.recevoir({ ...lot(0, 600), sessionId: 'visite-0001' });
    await service.recevoir({ ...lot(0, 600), sessionId: 'visite-0002' });
    const refus = service.recevoir({ ...lot(0, 600), sessionId: 'visite-0003' });
    await expect(refus).rejects.toBeInstanceOf(HttpException);
    await expect(refus).rejects.toMatchObject({ status: 429 });
    await expect(service.recevoir({ ...lot(1, 600), sessionId: 'visite-0001' })).rejects.toMatchObject({ status: 429 });
    expect(event.mock.calls.filter(([nom, d]) => nom === 'replay_capped' && d.scope === 'day')).toHaveLength(1);
  });

  it('un échec d’écriture ne remonte pas, il se journalise', async () => {
    const { service, db, error } = make();
    db.echouer();
    await expect(service.recevoir(lot(0))).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});

describe('ReplayService.purger', () => {
  it('supprime un lot de 31 jours et garde celui de 29', async () => {
    const { service, db } = make();
    const jours = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);
    db.lots.push(
      { sessionId: 'a', segment: 0, seq: 0, bytes: 1, data: gzipSync('[]'), receivedAt: jours(31), hasError: 0, href: null },
      { sessionId: 'b', segment: 0, seq: 0, bytes: 1, data: gzipSync('[]'), receivedAt: jours(29), hasError: 0, href: null },
    );
    expect(await service.purger()).toBe(1);
    expect(db.lots.map(l => l.sessionId)).toEqual(['b']);
  });

  it('suit REPLAY_RETENTION_DAYS', async () => {
    const { service, db } = make({ config: { REPLAY_RETENTION_DAYS: '7' } });
    db.lots.push({ sessionId: 'a', segment: 0, seq: 0, bytes: 1, data: gzipSync('[]'), receivedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000), hasError: 0, href: null });
    expect(await service.purger()).toBe(1);
  });
});

describe('ReplayService.lire', () => {
  it('rend les segments dans l’ordre, lots recollés', async () => {
    const { service } = make();
    await service.recevoir({ ...lot(1), events: [{ type: 3, timestamp: 2 }] });
    await service.recevoir({ ...lot(0, 1, 1), events: [{ type: 2, timestamp: 10 }] });
    await service.recevoir({ ...lot(0), events: [{ type: 2, timestamp: 1 }] });
    const res = await service.lire('visite-0001');
    expect(res.segments).toHaveLength(2);
    expect(res.segments[0]).toEqual([{ type: 2, timestamp: 1 }, { type: 3, timestamp: 2 }]);
    expect(res.segments[1]).toEqual([{ type: 2, timestamp: 10 }]);
  });

  it('404 sur une visite purgée', async () => {
    const { service } = make();
    await expect(service.lire('visite-0001')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('résumés d’un lot', () => {
  it('ignore une erreur console qui n’est pas de niveau error', () => {
    expect(contientUneErreur([{ type: 6, data: { plugin: 'rrweb/console@1', payload: { level: 'warn' } } }])).toBe(false);
  });
  it('une URL illisible ne donne pas de chemin', () => {
    expect(cheminDEntree([{ type: 4, data: { href: 'pas une url' } }])).toBeNull();
  });
  it('des horodatages absents donnent des bornes nulles', () => {
    expect(bornes([{ type: 3 }])).toEqual({ first: 0, last: 0 });
  });
});
