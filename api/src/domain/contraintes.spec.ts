import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DomainService, nettoyerContraintesDuBrief, retirerContraintes } from './domain.service';
import { SearchDomainsDto } from './dto/search-domains.dto';
import { modeleAnthropicFactice, reponseAnthropic } from '../common/modele-ia/modele-ia.testing';

/**
 * Ce que l'extraction tire du cahier des charges, une fois la sortie du
 * modèle nettoyée. Descriptions paraphrasées des cas relevés le 31/10/2026.
 */
const extraire = async (reponse: unknown, description: string) => {
  const modele = modeleAnthropicFactice(async () => reponseAnthropic(JSON.stringify(reponse)));
  return new DomainService({} as any, {} as any, modele).extractNamingConstraints(description);
};
const vide = { minLength: null, maxLength: null, avoidWords: [], referenceBrands: [], avoidEndings: [], requiredWords: [], nameType: null };

describe('contraintes tirées du brief', () => {
  it('« sans terminaisons ora ou ia »', async () => {
    const c = await extraire({ ...vide, avoidEndings: ['-ora', 'IA'] }, 'Des noms doux, sans terminaisons ora ou ia');
    expect(c.avoidEndings).toEqual(['ora', 'ia']);
  });

  it('« un nom composé avec BLOOM »', async () => {
    const c = await extraire({ ...vide, requiredWords: ['BLOOM'] }, 'Accessoires pour chiens, un nom composé avec BLOOM');
    expect(c.requiredWords).toEqual(['bloom']);
  });

  it('un mot imposé absent de la description est une obligation inventée : écarté', async () => {
    const c = await extraire({ ...vide, requiredWords: ['pet', 'bloom'] }, 'Accessoires pour chiens, un nom avec bloom');
    expect(c.requiredWords).toEqual(['bloom']);
  });

  it('un prénom à inclure, accent compris', async () => {
    const c = await extraire({ ...vide, requiredWords: ['Éléa'] }, 'Studio de beauté, je veux mon prénom Éléa dans le nom');
    expect(c.requiredWords).toEqual(['elea']);
  });

  it('un type de nom hors énumération vaut null', async () => {
    const c = await extraire({ ...vide, nameType: 'short' }, 'desc');
    expect(c.nameType).toBeNull();
  });

  it('« 6 lettres exactement » : bornes du brief gardées telles quelles', async () => {
    const c = await extraire({ ...vide, minLength: 6, maxLength: 6, nameType: 'invented' }, 'Agence SEO, un nom de 6 lettres exactement');
    expect(c).toMatchObject({ minLength: 6, maxLength: 6, briefMinLength: 6, briefMaxLength: 6, nameType: 'invented' });
  });

  it('sans consigne : aucune borne du brief, défauts effectifs', async () => {
    const c = await extraire(vide, 'Une boulangerie artisanale à Lyon');
    expect(c).toMatchObject({ minLength: 6, maxLength: 10, briefMinLength: null, briefMaxLength: null, avoidEndings: [], requiredWords: [] });
  });

  it('réponse illisible : défauts complets', async () => {
    const modele = modeleAnthropicFactice(async () => reponseAnthropic('pas du json'));
    const c = await new DomainService({} as any, {} as any, modele).extractNamingConstraints('desc');
    expect(c).toMatchObject({ avoidEndings: [], requiredWords: [], nameType: null, briefMinLength: null });
  });
});

describe('nettoyage des contraintes', () => {
  it('terminaisons bornées de 2 à 5 caractères, dédoublonnées', () => {
    const c = nettoyerContraintesDuBrief({ avoidEndings: ['a', 'ora', 'ORA', 'ixtrem'] }, '');
    expect(c.avoidEndings).toEqual(['ora']);
  });

  it('au plus trois mots imposés', () => {
    const c = nettoyerContraintesDuBrief({ requiredWords: ['alpha', 'bravo', 'charlie', 'delta'] }, 'alpha bravo charlie delta');
    expect(c.requiredWords).toEqual(['alpha', 'bravo', 'charlie']);
  });
});

describe('contraintes retirées par l’utilisateur', () => {
  const c: any = {
    minLength: 6, maxLength: 6, avoidWords: ['sport'], referenceBrands: [], avoidEndings: ['ora', 'ia'],
    requiredWords: ['bloom'], nameType: 'invented', briefMinLength: 6, briefMaxLength: 6,
  };

  it('retire une contrainte mal comprise, garde les autres', () => {
    const r = retirerContraintes(c, ['eviter:sport', 'fin:ia']);
    expect(r.avoidWords).toEqual([]);
    expect(r.avoidEndings).toEqual(['ora']);
    expect(r.requiredWords).toEqual(['bloom']);
  });

  it('retirer la longueur efface les bornes du brief', () => {
    expect(retirerContraintes(c, ['longueur'])).toMatchObject({ briefMinLength: null, briefMaxLength: null });
  });
});

describe('DTO : contraintes retirées', () => {
  const valide = (contraintesRetirees: string[]) => validateSync(plainToInstance(SearchDomainsDto, {
    description: 'une description assez longue pour passer', keywords: ['mot'], contraintesRetirees,
  })).filter((e: any) => e.property === 'contraintesRetirees');

  it('accepte les clés connues', () => {
    expect(valide(['longueur', 'eviter:sport', 'fin:ora', 'avec:bloom'])).toEqual([]);
  });

  it('refuse le reste', () => {
    expect(valide(['n’importe quoi'])).not.toEqual([]);
  });
});
