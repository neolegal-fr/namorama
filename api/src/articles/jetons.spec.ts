import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { META_ROLES, META_UNPROTECTED } from 'nest-keycloak-connect';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminArticlesController } from './admin-articles.controller';
import { ArticlesController } from './articles.controller';
import { EN_TETE_JETON, JetonDeRedactionGuard } from './jeton-de-redaction.guard';
import { empreinteDe, JetonsService } from './jetons.service';
import { AdminJetonsController, RedactionController } from './redaction.controller';

/** Dépôt en mémoire, juste ce que `JetonsService` emploie. */
function depot() {
  const lignes: any[] = [];
  const correspond = (l: any, where: any) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === 'object' && (v as any)._type === 'isNull' ? l[k] == null : l[k] === v));
  return {
    lignes,
    create: (x: any) => ({ ...x }),
    save: async (x: any) => {
      if (!x.id) {
        x.id = lignes.length + 1;
        x.creeLe = new Date();
        lignes.push(x);
      }
      return x;
    },
    find: async () => [...lignes],
    findOne: async ({ where }: any) => lignes.find((l) => correspond(l, where)) ?? null,
    update: async (id: number, patch: any) => Object.assign(lignes.find((l) => l.id === id), patch),
  };
}

function monter() {
  const repo = depot();
  const events = { event: jest.fn() };
  return { svc: new JetonsService(repo as any, events as any), repo, events };
}

describe('JetonsService', () => {
  it('création : la valeur est rendue une fois, seule son empreinte est stockée', async () => {
    const { svc, repo, events } = monter();
    const j = await svc.creer('Claude Code — poste', 'sub-admin');
    expect(j.valeur).toMatch(/^nmr_[A-Za-z0-9_-]{43}$/);
    expect(j.prefixe).toBe(j.valeur.slice(0, 12));
    const stocke = JSON.stringify(repo.lignes);
    expect(stocke).not.toContain(j.valeur);
    expect(repo.lignes[0].empreinte).toBe(empreinteDe(j.valeur));
    expect((await svc.lister())[0]).not.toHaveProperty('valeur');
    expect((await svc.lister())[0]).not.toHaveProperty('empreinte');
    expect(events.event).toHaveBeenCalledWith('api_token_created', { id: 1, nom: 'Claude Code — poste', sub: 'sub-admin' });
    expect(JSON.stringify(events.event.mock.calls)).not.toContain(j.valeur);
  });

  it('authentifie un jeton actif, et plus après révocation', async () => {
    const { svc, events } = monter();
    const j = await svc.creer('Claude', 'sub-admin');
    expect((await svc.authentifier(j.valeur))?.id).toBe(j.id);
    expect((await svc.lister())[0].derniereUtilisation).toBeInstanceOf(Date);
    await svc.revoquer(j.id, 'sub-admin');
    expect(events.event).toHaveBeenCalledWith('api_token_revoked', { id: 1, nom: 'Claude', sub: 'sub-admin' });
    // La recherche exige `revoqueLe IS NULL` : le faux dépôt l'évalue comme la base.
    expect(await svc.authentifier(j.valeur)).toBeNull();
  });

  it('refuse ce qui n’a pas la forme d’un jeton, sans interroger la base', async () => {
    const { svc } = monter();
    for (const v of [undefined, '', 'Bearer x', 'nmr_' + 'x'.repeat(300), 42]) expect(await svc.authentifier(v)).toBeNull();
  });

  it('refuse un jeton d’une autre portée', async () => {
    const { svc, repo } = monter();
    const j = await svc.creer('Autre', 'sub');
    repo.lignes[0].portee = 'autre';
    expect(await svc.authentifier(j.valeur, 'articles')).toBeNull();
  });
});

describe('JetonDeRedactionGuard', () => {
  const contexte = (headers: Record<string, string>) => {
    const req: any = { headers };
    return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }) } as any };
  };

  it('pose l’auteur (le nom du jeton) quand le jeton est valide', async () => {
    const { svc } = monter();
    const j = await svc.creer('Claude Code — poste', 'sub');
    const { req, ctx } = contexte({ [EN_TETE_JETON]: j.valeur });
    expect(await new JetonDeRedactionGuard(svc).canActivate(ctx)).toBe(true);
    expect(req.auteurRedaction).toEqual({ type: 'jeton', id: String(j.id), nom: 'Claude Code — poste' });
  });

  it('401 sans jeton, avec un jeton inconnu ou révoqué', async () => {
    const { svc } = monter();
    const j = await svc.creer('Claude', 'sub');
    await svc.revoquer(j.id, 'sub');
    const garde = new JetonDeRedactionGuard(svc);
    for (const h of [{}, { [EN_TETE_JETON]: 'nmr_inconnu' }, { [EN_TETE_JETON]: j.valeur }, { authorization: `Bearer ${j.valeur}` }]) {
      await expect(garde.canActivate(contexte(h).ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });
});

describe('Accès aux routes', () => {
  const reflector = new Reflector();
  const roles = (c: any) => reflector.get(META_ROLES, c);
  const publique = (c: any) => reflector.get(META_UNPROTECTED, c);

  it('la rédaction par l’écran et les jetons exigent le rôle admin, sans être publiques', () => {
    for (const c of [AdminArticlesController, AdminJetonsController]) {
      expect(roles(c)).toEqual({ roles: ['realm:admin'] });
      expect(publique(c)).toBeFalsy();
    }
  });

  it('la rédaction par jeton est hors Keycloak mais gardée par le jeton', () => {
    expect(publique(RedactionController)).toBe(true);
    expect(Reflect.getMetadata(GUARDS_METADATA, RedactionController)).toEqual([JetonDeRedactionGuard]);
  });

  it('la lecture publique ne demande rien', () => {
    expect(publique(ArticlesController)).toBe(true);
    expect(Reflect.getMetadata(GUARDS_METADATA, ArticlesController)).toBeUndefined();
  });
});
