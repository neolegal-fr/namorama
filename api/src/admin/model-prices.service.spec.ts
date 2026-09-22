import { BadRequestException, ConflictException } from '@nestjs/common';
import { ModelPricesService } from './model-prices.service';

/**
 * Un tarif mal saisi fausse tous les coûts qu'il couvre, sans que rien ne le
 * signale : le chiffre reste plausible. Ces tests portent sur ce qui ne doit
 * jamais passer — un doublon, une date impossible, un outil tarifé au token.
 */
describe('ModelPricesService', () => {
  const fabrique = (lignes: any[] = []) => {
    const repo = {
      find: jest.fn(async () => lignes),
      findOne: jest.fn(async ({ where }: any) =>
        lignes.find((l) => l.model === where.model && l.effectiveFrom.getTime() === where.effectiveFrom.getTime()) ?? null),
      insert: jest.fn(async (x: any) => { lignes.push({ id: lignes.length + 1, ...x }); }),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    return { svc: new ModelPricesService(repo as any), repo, lignes };
  };
  const tarif = { model: 'gpt-5.6-luna', effectiveFrom: '2026-10-01', inputPerM: 0.15, cachedInputPerM: 0.015, outputPerM: 1 };

  it('ajoute un tarif daté du jour civil demandé, à minuit local', async () => {
    const { svc, repo } = fabrique();
    const cree = await svc.ajouter(tarif);
    const inseree = repo.insert.mock.calls[0][0];
    expect(inseree.effectiveFrom.getHours()).toBe(0);
    expect(inseree.effectiveFrom.getDate()).toBe(1);
    expect(cree.effectiveFrom).toBe('2026-10-01');
  });

  it('refuse un second tarif du même modèle au même jour', async () => {
    const { svc } = fabrique();
    await svc.ajouter(tarif);
    await expect(svc.ajouter({ ...tarif, inputPerM: 0.1 })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuse une date qui n\'existe pas au calendrier', async () => {
    const { svc } = fabrique();
    await expect(svc.ajouter({ ...tarif, effectiveFrom: '2026-02-30' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tarife web_search à l\'appel, et neutralise les champs au token', async () => {
    const { svc, repo } = fabrique();
    await svc.ajouter({ model: 'web_search', effectiveFrom: '2026-10-01', inputPerM: 5, outputPerM: 5, perCall: 0.012 });
    expect(repo.insert.mock.calls[0][0]).toMatchObject({ inputPerM: '0', outputPerM: '0', cachedInputPerM: null, perCall: '0.012' });
  });

  it('désigne comme courant le dernier tarif déjà en vigueur, pas un tarif futur', async () => {
    const { svc } = fabrique([
      { id: 3, model: 'gpt-5.6-luna', effectiveFrom: new Date('2099-01-01T00:00:00'), inputPerM: '0.1', cachedInputPerM: null, outputPerM: '1', perCall: null, note: null },
      { id: 2, model: 'gpt-5.6-luna', effectiveFrom: new Date('2026-09-01T00:00:00'), inputPerM: '0.2', cachedInputPerM: '0.02', outputPerM: '1.2', perCall: null, note: null },
      { id: 1, model: 'gpt-5.6-luna', effectiveFrom: new Date('2026-01-01T00:00:00'), inputPerM: '0.3', cachedInputPerM: null, outputPerM: '1.5', perCall: null, note: null },
    ]);
    const l = await svc.lister();
    expect(l.filter((t) => t.current).map((t) => t.id)).toEqual([2]);
  });
});
