import { DomainService } from '../../domain/domain.service';
import { NameVariantsService } from '../../brand-report/trademark/name-variants.service';
import { lireBrouillon } from '../../admin/admin-mail.service';
import { modeleAnthropicFactice, reponseAnthropic } from './modele-ia.testing';
import {
  SCHEMA_ANALYSES, SCHEMA_BROUILLON, SCHEMA_CHOIX, SCHEMA_CONCURRENTS, SCHEMA_CONTRAINTES, SCHEMA_DECOUPAGES, SCHEMA_MOTS_CLES, SCHEMA_NOMS,
} from './schemas';

/**
 * Un schéma qui s'écarte de ce que lit le parseur rend un résultat vide, sans
 * erreur : la sortie structurée garantit la forme du schéma, pas celle que le
 * code attend. Chaque test vérifie donc les deux bouts — l'exemple respecte
 * le schéma, ET le parseur existant en tire un résultat non vide.
 */

/** Le sous-ensemble de JSON Schema qu'emploie `schemas.ts`, et rien de plus. */
function conforme(v: unknown, s: any, chemin = '$'): string[] {
  if (s.anyOf) return s.anyOf.some((x: any) => conforme(v, x, chemin).length === 0) ? [] : [`${chemin} : aucune branche`];
  switch (s.type) {
    case 'null': return v === null ? [] : [`${chemin} : null attendu`];
    case 'string':
      if (typeof v !== 'string') return [`${chemin} : chaîne attendue`];
      return s.enum && !s.enum.includes(v) ? [`${chemin} : hors énumération`] : [];
    case 'boolean': return typeof v === 'boolean' ? [] : [`${chemin} : booléen attendu`];
    case 'integer': return Number.isInteger(v) ? [] : [`${chemin} : entier attendu`];
    case 'array':
      return Array.isArray(v) ? v.flatMap((x, i) => conforme(x, s.items, `${chemin}[${i}]`)) : [`${chemin} : liste attendue`];
    case 'object': {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return [`${chemin} : objet attendu`];
      const o = v as Record<string, unknown>;
      const manquants = (s.required ?? []).filter((k: string) => !(k in o)).map((k: string) => `${chemin}.${k} : manquant`);
      const enTrop = s.additionalProperties === false
        ? Object.keys(o).filter((k) => !(k in s.properties)).map((k) => `${chemin}.${k} : en trop`)
        : [];
      const internes = Object.keys(s.properties).filter((k) => k in o).flatMap((k) => conforme(o[k], s.properties[k], `${chemin}.${k}`));
      return [...manquants, ...enTrop, ...internes];
    }
    default: throw new Error(`type non géré : ${s.type}`);
  }
}

/** Le service, servi par Claude, qui rend l'exemple tel quel. */
const service = (exemple: unknown) => {
  const modele = modeleAnthropicFactice(async () => reponseAnthropic(JSON.stringify(exemple)));
  const svc = new DomainService({} as any, {} as any, modele);
  (svc as any).isDomainAvailable = async () => false;
  return { svc, modele };
};

const notice = {
  name: 'velora',
  scores: { memorability: 4, pronunciation: 3, international: 5, seo: 3, distinctiveness: 4 },
  comments: { memorability: 'm', pronunciation: 'p', international: 'i', seo: 's', distinctiveness: 'd' },
  origin: 'o', strengths: 'f', watchout: 'a',
};

describe('Schémas de sortie structurée', () => {
  it('keywords', async () => {
    const ex = { keywords: ['référencement', 'acquisition', 'nom de marque'], namingBusiness: false };
    expect(conforme(ex, SCHEMA_MOTS_CLES)).toEqual([]);
    const motsCles = await service(ex).svc.generateKeywords('desc', 'fr');
    expect(motsCles).toEqual(['référencement', 'acquisition']);
  });

  it('constraints', async () => {
    const ex = {
      minLength: 5, maxLength: null, avoidWords: ['tech'], referenceBrands: ['Qonto'],
      avoidEndings: ['ora'], requiredWords: ['bloom'], nameType: 'invented',
    };
    expect(conforme(ex, SCHEMA_CONTRAINTES)).toEqual([]);
    expect(conforme({ ...ex, nameType: 'autre' }, SCHEMA_CONTRAINTES)).not.toEqual([]);
    const c = await service(ex).svc.extractNamingConstraints('un nom composé avec Bloom, sans -ora');
    expect(c).toMatchObject({
      minLength: 5, avoidWords: ['tech'], referenceBrands: ['Qonto'],
      avoidEndings: ['ora'], requiredWords: ['bloom'], nameType: 'invented', briefMinLength: 5, briefMaxLength: null,
    });
  });

  it('competitors (repli sans outil)', async () => {
    const ex = { competitors: [{ name: 'Qonto', domain: 'qonto.com', note: 'banque' }] };
    expect(conforme(ex, SCHEMA_CONCURRENTS)).toEqual([]);
    expect((service(ex).svc as any).parseCompetitors(JSON.stringify(ex))).toHaveLength(1);
  });

  it('generate_names', async () => {
    const ex = { names: [{ name: 'velorami', style: 'standard' }] };
    expect(conforme(ex, SCHEMA_NOMS)).toEqual([]);
    await expect(service(ex).svc.generateDomainIdeas('desc', ['mot'])).resolves.toEqual([{ name: 'velorami', style: 'standard' }]);
  });

  it('analyze', async () => {
    const ex = { analyses: [notice] };
    expect(conforme(ex, SCHEMA_ANALYSES)).toEqual([]);
    expect((await service(ex).svc.analyzeNames(['velora'], 'fr')).size).toBe(1);
  });

  it('pick_best', async () => {
    const ex = { recommended: 'velora', reason: 'Courte et mémorable.' };
    expect(conforme(ex, SCHEMA_CHOIX)).toEqual([]);
    await expect(service(ex).svc.pickBestDomain([{ name: 'velora', analysis: null, extensions: {} }], 'fr')).resolves.toEqual(ex);
  });

  it('name_variants', async () => {
    const ex = { decoupages: ['neo legal'] };
    expect(conforme(ex, SCHEMA_DECOUPAGES)).toEqual([]);
    await expect(new NameVariantsService(service(ex).modele).variants('neolegal')).resolves.toEqual(['neo legal']);
  });

  it('admin_mail_draft', () => {
    const ex = { langue: 'fr', contexte: 'Vous avez cherché un nom pour une boulangerie.' };
    expect(conforme(ex, SCHEMA_BROUILLON)).toEqual([]);
    expect(lireBrouillon(JSON.stringify(ex))).toEqual({ langue: 'fr', contexte: ex.contexte });
  });

  it('le vérificateur lui-même repère un écart', () => {
    expect(conforme({ names: [{ name: 'x' }] }, SCHEMA_NOMS)).toEqual(['$.names[0].style : manquant']);
  });
});
