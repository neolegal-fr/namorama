import { describe, expect, it } from 'vitest';
import { masquerLesAttributs } from './masquage-attributs';

const CLASSE = 'nm-prive';

/** La puce PrimeNG d'un mot-clé, telle que rrweb l'a sérialisée le 31/10/2026. */
const puce = (id: number, motCle: string) => ({
  type: 2,
  tagName: 'p-chip',
  attributes: { class: 'nm-prive p-chip p-component', 'aria-label': motCle, 'data-pc-name': 'chip' },
  childNodes: [{ type: 2, tagName: 'div', id: id + 1, attributes: { title: motCle }, childNodes: [] }],
  id,
});

describe('masquerLesAttributs', () => {
  it('masque l’aria-label d’une puce ajoutée par mutation (fuite relevée le 31/10/2026)', () => {
    const prives = new Set<number>();
    const e = { type: 3, data: { source: 0, texts: [], attributes: [], removes: [], adds: [{ parentId: 530, nextId: null, node: puce(1021, 'zephyrmotcle') }] } };
    masquerLesAttributs(e, prives, CLASSE);
    const n = e.data.adds[0].node;
    expect(n.attributes['aria-label']).toBe('************');
    expect(n.childNodes[0].attributes['title']).toBe('************'); // descendant : hérite
    expect(n.attributes['data-pc-name']).toBe('chip'); // attribut technique : intact
    expect(prives.has(1021)).toBe(true);
    expect(prives.has(1022)).toBe(true);
  });

  it('masque dans l’instantané complet, et suit ensuite les enfants ajoutés sous un nœud privé', () => {
    const prives = new Set<number>();
    const instantane = {
      type: 2,
      data: { node: { type: 0, id: 1, childNodes: [
        { type: 2, tagName: 'span', id: 10, attributes: { class: 'partage__qui nm-prive' }, childNodes: [] },
        { type: 2, tagName: 'a', id: 11, attributes: { title: 'Mentions légales' }, childNodes: [] },
      ] } },
    };
    masquerLesAttributs(instantane, prives, CLASSE);
    expect(instantane.data.node.childNodes[1].attributes['title']).toBe('Mentions légales'); // public

    const ajout = { type: 3, data: { source: 0, adds: [{ parentId: 10, node: { type: 2, tagName: 'b', id: 12, attributes: { title: 'associe@exemple.fr' }, childNodes: [] } }], attributes: [] } };
    masquerLesAttributs(ajout, prives, CLASSE);
    expect(ajout.data.adds[0].node.attributes['title']).toBe('******************');
  });

  it('masque une modification d’attribut sur un nœud privé', () => {
    const prives = new Set<number>([1021]);
    const e = { type: 3, data: { source: 0, adds: [], attributes: [{ id: 1021, attributes: { 'aria-label': 'nouveau', class: 'nm-prive p-chip' } }, { id: 7, attributes: { 'aria-label': 'Fermer' } }] } };
    masquerLesAttributs(e, prives, CLASSE);
    expect(e.data.attributes[0].attributes['aria-label']).toBe('*******');
    expect(e.data.attributes[1].attributes['aria-label']).toBe('Fermer');
  });

  it('ignore les événements qui ne sont pas des mutations', () => {
    const e = { type: 3, data: { source: 2, x: 1 } };
    expect(() => masquerLesAttributs(e, new Set(), CLASSE)).not.toThrow();
    expect(() => masquerLesAttributs(null, new Set(), CLASSE)).not.toThrow();
  });
});
