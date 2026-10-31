import { ProjectsService } from './projects.service';

/**
 * Le partage donne un accès À UN PROJET, pas au compte qui le possède.
 *
 * Ces tests fixent les deux garanties qui comptent : un accès en lecture ne
 * modifie rien, et un accès en écriture ne débite jamais le collaborateur — le
 * propriétaire reste le payeur.
 */
describe('ProjectsService — projets partagés', () => {
  const proprietaire = { id: 1, keycloakId: 'sub-proprio', email: 'proprio@example.com' } as any;
  const invite = { id: 2, keycloakId: 'sub-invite', email: 'Invite@Example.com' } as any;
  const inconnu = { id: 3, keycloakId: 'sub-inconnu', email: 'autre@example.com' } as any;

  function fabrique(partage: any | null) {
    const projet = { id: 'p1', user: proprietaire, suggestions: [] };
    const service = Object.create(ProjectsService.prototype) as any;
    service.projectsRepository = { findOne: jest.fn().mockResolvedValue(projet) };
    service.sharesRepository = {
      findOne: jest.fn().mockResolvedValue(partage),
      save: jest.fn().mockResolvedValue(partage),
      find: jest.fn().mockResolvedValue(partage ? [{ ...partage, project: projet }] : []),
    };
    return { service, projet };
  }

  it('le propriétaire garde tous les droits', async () => {
    const { service } = fabrique(null);
    const acces = await service.accessFor('p1', proprietaire);
    expect(acces.role).toBe('owner');
    expect(acces.owner).toBe(proprietaire);
  });

  it('rapproche le partage sans tenir compte de la casse de l’adresse', async () => {
    const { service } = fabrique({ permission: 'read', email: 'invite@example.com', acceptedAt: new Date() });
    const acces = await service.accessFor('p1', invite);
    expect(acces.role).toBe('read');
    expect(service.sharesRepository.findOne).toHaveBeenCalledWith({
      where: { project: { id: 'p1' }, email: 'invite@example.com' },
    });
  });

  it('un tiers n’a aucun accès', async () => {
    const { service } = fabrique(null);
    expect(await service.accessFor('p1', inconnu)).toBeNull();
  });

  it('un compte sans adresse ne peut recevoir aucun partage', async () => {
    // Sinon la comparaison porterait sur `null` et ouvrirait tous les partages
    // dont l'adresse est vide.
    const { service } = fabrique({ permission: 'write', email: '' });
    expect(await service.accessFor('p1', { id: 9, email: null } as any)).toBeNull();
  });

  it('LE PAYEUR EST TOUJOURS LE PROPRIÉTAIRE, même quand le collaborateur agit', async () => {
    const { service } = fabrique({ permission: 'write', email: 'invite@example.com', acceptedAt: new Date() });
    const acces = await service.accessFor('p1', invite);
    expect(acces.role).toBe('write');
    expect(acces.owner.keycloakId).toBe('sub-proprio');
  });

  it('refuse l’écriture à un partage en lecture seule', async () => {
    const { service } = fabrique({ permission: 'read', email: 'invite@example.com', acceptedAt: new Date() });
    await expect(service.requireWrite('p1', invite)).rejects.toThrow(/lecture seule/);
  });

  it('autorise l’écriture à un partage en écriture', async () => {
    const { service } = fabrique({ permission: 'write', email: 'invite@example.com', acceptedAt: new Date() });
    await expect(service.requireWrite('p1', invite)).resolves.toMatchObject({ role: 'write' });
  });

  describe('retours sur les noms (chantier affiner-par-retour-libre)', () => {
    function avecSauvegarde(partage: any | null) {
      const f = fabrique(partage);
      f.service.projectsRepository.save = jest.fn().mockImplementation(async (p: any) => p);
      f.service.projectsRepository.findOne = jest.fn().mockResolvedValue(f.projet);
      return f;
    }

    it('un collaborateur en écriture enregistre un retour, par la recherche comme par la mise à jour', async () => {
      const { service, projet } = avecSauvegarde({ permission: 'write', email: 'invite@example.com', acceptedAt: new Date() });
      await service.createOrUpdate(invite, { id: 'p1', description: 'd', keywords: [], extensions: ['.com'], matchMode: 'any', retours: ['plus francophone'] });
      expect(projet).toMatchObject({ retours: ['plus francophone'] });
      await service.update('p1', invite, { retours: [] } as any);
      expect(projet).toMatchObject({ retours: [] });
    });

    it('un invité en lecture ne peut pas en enregistrer', async () => {
      const { service, projet } = avecSauvegarde({ permission: 'read', email: 'invite@example.com', acceptedAt: new Date() });
      await expect(service.update('p1', invite, { retours: ['plus court'] } as any)).rejects.toThrow(/lecture seule/);
      await expect(service.createOrUpdate(invite, { id: 'p1', description: 'd', keywords: [], extensions: [], matchMode: 'any', retours: ['plus court'] }))
        .rejects.toThrow(/lecture seule/);
      expect((projet as any).retours).toBeUndefined();
    });

    it('un retour contenant une virgule reste un seul retour', async () => {
      const { service, projet } = avecSauvegarde(null);
      await service.update('p1', proprietaire, { retours: ['plus court, plus doux'] } as any);
      expect((projet as any).retours).toEqual(['plus court, plus doux']);
    });

    it('une recherche sans retours ne les efface pas', async () => {
      const { service, projet } = avecSauvegarde(null);
      (projet as any).retours = ['plus sérieux'];
      await service.createOrUpdate(proprietaire, { id: 'p1', description: 'd', keywords: [], extensions: [], matchMode: 'any' });
      expect((projet as any).retours).toEqual(['plus sérieux']);
    });

    it('refuse un onzième retour, et un retour de plus de 200 caractères, sans rien tronquer', async () => {
      const { service } = avecSauvegarde(null);
      const onze = Array.from({ length: 11 }, (_, i) => `retour ${i}`);
      await expect(service.update('p1', proprietaire, { retours: onze } as any)).rejects.toThrow(/Au plus 10 retours/);
      await expect(service.update('p1', proprietaire, { retours: ['x'.repeat(201)] } as any)).rejects.toThrow(/200 caractères/);
    });
  });

  it('note la première ouverture, sans faire échouer la lecture si l’écriture rate', async () => {
    const { service } = fabrique({ permission: 'read', email: 'invite@example.com', acceptedAt: null });
    service.sharesRepository.save = jest.fn().mockRejectedValue(new Error('base indisponible'));
    await expect(service.accessFor('p1', invite)).resolves.toMatchObject({ role: 'read' });
  });
});
