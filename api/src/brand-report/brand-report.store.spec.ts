import { BrandReportStore } from './brand-report.store';

describe('BrandReportStore — synthèses', () => {
  function storeAvec(rows: any[]) {
    const repo = { find: jest.fn().mockResolvedValue(rows) } as any;
    return { store: new BrandReportStore(repo), repo };
  }

  /** La carte copie le lien public sans ouvrir le rapport : il lui faut le jeton. */
  it('rend le jeton de partage de chaque rapport', async () => {
    const { store, repo } = storeAvec([
      { nameKey: 'norvane', shareToken: 'tok-1', costCredits: 50, report: { generatedAt: '2026-11-07T10:00:00Z', trademark: { match: 'none', hits: [] }, socials: [], score: 82 } },
    ]);
    const [s] = await store.listSummaries('kc-1');
    expect(repo.find).toHaveBeenCalledWith({ where: { keycloakId: 'kc-1' } });
    expect(s.nameKey).toBe('norvane');
    expect(s.shareToken).toBe('tok-1');
  });

  it("rend null quand l'enregistrement n'a pas de jeton", async () => {
    const { store } = storeAvec([{ nameKey: 'velvio', shareToken: undefined, report: {} }]);
    const [s] = await store.listSummaries('kc-1');
    expect(s.shareToken).toBeNull();
  });
});
