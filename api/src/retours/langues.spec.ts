import { from, lastValueFrom } from 'rxjs';
import { langueDuNavigateur } from './langues';
import { UsersService } from '../users/users.service';
import { ContexteAppelInterceptor } from '../common/model-usage/contexte-appel';

describe('langue du navigateur', () => {
  it('prend la première langue traduite, dans l\'ordre de préférence', () => {
    expect(langueDuNavigateur('de-DE,de;q=0.9,en;q=0.8')).toBe('de');
    expect(langueDuNavigateur('zh-CN,zh;q=0.9,en;q=0.5')).toBe('en');
    expect(langueDuNavigateur('en;q=0.4, fr-FR;q=0.9')).toBe('fr');
  });

  it('rend null quand aucune langue n\'est traduite, ou sans en-tête', () => {
    expect(langueDuNavigateur('zh-CN')).toBeNull();
    expect(langueDuNavigateur('fr;q=0')).toBeNull();
    expect(langueDuNavigateur(undefined)).toBeNull();
    expect(langueDuNavigateur('')).toBeNull();
  });
});

describe('langue captée à la création du compte', () => {
  function service(existant: any = null) {
    const svc = Object.create(UsersService.prototype) as any;
    const enregistres: any[] = [];
    svc.usersRepository = {
      findOne: jest.fn().mockResolvedValue(existant),
      create: jest.fn((d: any) => ({ ...d })),
      save: jest.fn(async (u: any) => { enregistres.push(u); return u; }),
    };
    svc.maybeFreeReset = jest.fn();
    svc.logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };
    svc.activiteVue = new Set();
    svc.activityRepository = { createQueryBuilder: () => ({ insert: () => ({ into: () => ({ values: () => ({ orIgnore: () => ({ execute: async () => undefined }) }) }) }) }) };
    return { svc, enregistres };
  }

  /** Exécute `fn` dans le contexte d'une requête portant cet `Accept-Language`. */
  const dansUneRequete = (acceptLanguage: string | undefined, fn: () => Promise<any>): Promise<any> => {
    const req = { headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {} };
    const ctx = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) } as any;
    return lastValueFrom(new ContexteAppelInterceptor().intercept(ctx, { handle: () => from(fn()) }));
  };

  it('`de-DE,de;q=0.9` → de', async () => {
    const { svc } = service();
    const { user } = await dansUneRequete('de-DE,de;q=0.9', () => svc.findOrCreateDetaille('sub-1', { email: 'a@b.c' }));
    expect(user.langueInscription).toBe('de');
  });

  it('`zh-CN` → null', async () => {
    const { svc } = service();
    const { user } = await dansUneRequete('zh-CN', () => svc.findOrCreateDetaille('sub-2', {}));
    expect(user.langueInscription).toBeNull();
  });

  it('un compte existant ne change pas de langue d\'inscription', async () => {
    const existant = { keycloakId: 'sub-3', langueInscription: 'fr', credits: 100, extraCredits: 0 };
    const { svc } = service(existant);
    const { user } = await dansUneRequete('de-DE', () => svc.findOrCreateDetaille('sub-3', {}));
    expect(user.langueInscription).toBe('fr');
  });
});
