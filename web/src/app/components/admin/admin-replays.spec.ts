import { describe, expect, it } from 'vitest';
import { preparer } from './admin-replays.component';

const erreurConsole = (timestamp: number, message: string) => ({
  type: 6,
  timestamp,
  data: { plugin: 'rrweb/console@1', payload: { level: 'error', payload: [`"${message}"`] } },
});

describe('preparer (rejeu admin)', () => {
  it('recolle les segments dans l’ordre des horodatages', () => {
    const { evenements } = preparer([
      [{ type: 4, timestamp: 100 }, { type: 2, timestamp: 101 }, { type: 3, timestamp: 150 }],
      // segment après le retour de Keycloak : nouvel instantané complet
      [{ type: 4, timestamp: 9000 }, { type: 2, timestamp: 9001 }],
    ]);
    expect(evenements.map(e => e['timestamp'])).toEqual([100, 101, 150, 9000, 9001]);
  });

  it('pose un repère de frise à chaque erreur console, et la liste avec son décalage', () => {
    const { evenements, erreurs } = preparer([
      [{ type: 2, timestamp: 1000 }, erreurConsole(4000, 'Cannot read properties of undefined')],
    ]);
    expect(erreurs).toEqual([{ decalageMs: 3000, message: 'Cannot read properties of undefined' }]);
    const repere = evenements.find(e => e['type'] === 5) as any;
    expect(repere.timestamp).toBe(4000);
    expect(repere.data.tag).toBe('erreur');
  });

  it('ignore les avertissements et les événements sans horodatage', () => {
    const { evenements, erreurs } = preparer([
      [
        { type: 2, timestamp: 1 },
        { type: 6, timestamp: 2, data: { plugin: 'rrweb/console@1', payload: { level: 'warn', payload: ['x'] } } },
        { type: 3 },
      ],
    ]);
    expect(erreurs).toEqual([]);
    expect(evenements).toHaveLength(2);
  });
});
