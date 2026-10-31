import { ProjectsService } from './projects.service';

/**
 * « Au plus N caractères » se garde d'une recherche à l'autre (chantier
 * `refondre-l-ecran-de-cadrage`, D5). Une recherche qui n'envoie pas de
 * maximum — l'utilisateur n'y a pas touché cette fois — ne l'efface pas.
 */
describe('ProjectsService — longueur maximale du projet', () => {
  const user = { id: 1, keycloakId: 'sub-1' } as any;
  const base = { description: 'une description', keywords: ['mot'], extensions: ['.com'], matchMode: 'any' };

  function service(existant?: any) {
    const repo = {
      create: jest.fn((v: any) => ({ maxLength: null, ...v })),
      findOne: jest.fn().mockResolvedValue(existant),
      save: jest.fn(async (p: any) => p),
    };
    const svc = new ProjectsService(repo as any, {} as any, {} as any);
    (svc as any).accessFor = jest.fn().mockResolvedValue({ role: 'owner' });
    return { svc, repo };
  }

  it('enregistre « au plus 8 »', async () => {
    const { svc } = service();
    const p = await svc.createOrUpdate(user, { ...base, maxLength: 8 });
    expect(p.maxLength).toBe(8);
  });

  it('un projet créé sans réglage reste à null', async () => {
    const { svc } = service();
    const p = await svc.createOrUpdate(user, base);
    expect(p.maxLength).toBeNull();
  });

  it('une recherche sans maximum garde celui déjà choisi', async () => {
    const { svc } = service({ id: 'p1', maxLength: 8, minLength: 7 });
    const p = await svc.createOrUpdate(user, { ...base, id: 'p1' });
    expect(p.maxLength).toBe(8);
  });

  it('n’écrit plus minLength', async () => {
    const { svc } = service({ id: 'p1', maxLength: null, minLength: 7 });
    const p = await svc.createOrUpdate(user, { ...base, id: 'p1', maxLength: 9 } as any);
    expect(p.minLength).toBe(7);
    expect(p.maxLength).toBe(9);
  });
});
