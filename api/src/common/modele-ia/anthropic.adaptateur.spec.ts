import { AnthropicAdaptateur, MAJORATION_SORTIE, RECHERCHES_WEB_MAX, outilRechercheWeb, parametresDeRaisonnement } from './anthropic.adaptateur';
import { MODELES_ANTHROPIC_TEST, reponseAnthropic } from './modele-ia.testing';
import { Demande } from './modele-ia.types';
import { DomainService } from '../../domain/domain.service';
import { ModeleIA } from './modele-ia.service';

const demande = (d: Partial<Demande> = {}): Demande => ({
  role: 'simple',
  message: 'desc',
  format: { type: 'texte' },
  maxSortie: 500,
  raisonnement: 'none',
  ...d,
});

function adaptateur(...reponses: any[]) {
  const appels: any[] = [];
  const create = jest.fn(async (p: any) => {
    appels.push(structuredClone(p));
    return reponses.length > 1 ? reponses.shift() : reponses[0];
  });
  return { a: new AnthropicAdaptateur({ messages: { create } } as any, MODELES_ANTHROPIC_TEST), appels };
}

describe('parametresDeRaisonnement', () => {
  /*
   * Une valeur que le modèle refuse rend un 400, pas un appel moins cher :
   * la traduction se fait donc par famille, d'après ce que chacune accepte.
   */
  it.each([
    ['claude-haiku-5-5', { thinking: { type: 'disabled' } }],
    ['claude-sonnet-5-5', { thinking: { type: 'between_tools' } }],
    ['claude-opus-5-5', { output_config: { effort: 'low' } }],
    ['claude-modele-inconnu', { output_config: { effort: 'low' } }],
  ])('none sur %s', (modele, attendu) => {
    expect(parametresDeRaisonnement(modele, 'none')).toEqual(attendu);
  });

  it('low : réflexion adaptative bornée, sur tous les modèles', () => {
    for (const m of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']) {
      expect(parametresDeRaisonnement(m, 'low')).toEqual({ thinking: { type: 'adaptive' }, output_config: { effort: 'low' } });
    }
  });
});

describe('AnthropicAdaptateur.completer', () => {
  it('consigne en `system`, budget majoré, schéma en sortie structurée', async () => {
    const { a, appels } = adaptateur(reponseAnthropic('{"names": []}'));
    const schema = { type: 'object', properties: {}, required: [], additionalProperties: false };
    const r = await a.completer('generate_names', demande({
      role: 'creatif', systeme: 'Consigne', format: { type: 'json', schema }, maxSortie: 4000,
    }));
    expect(appels).toEqual([{
      model: 'claude-sonnet-5-5',
      max_tokens: Math.ceil(4000 * MAJORATION_SORTIE),
      system: 'Consigne',
      messages: [{ role: 'user', content: 'desc' }],
      thinking: { type: 'between_tools' },
      output_config: { format: { type: 'json_schema', schema } },
    }]);
    expect(r).toEqual({ texte: '{"names": []}', tronque: false, refuse: false, fournisseur: 'anthropic', modele: 'claude-haiku-5-5' });
  });

  it('un texte sans consigne n\'envoie ni `system` ni format', async () => {
    const { a, appels } = adaptateur(reponseAnthropic('Velora'));
    await a.completer('suggest_name', demande({ maxSortie: 200 }));
    expect(appels[0]).toEqual({
      model: 'claude-haiku-5-5',
      max_tokens: 260,
      messages: [{ role: 'user', content: 'desc' }],
      thinking: { type: 'disabled' },
    });
  });

  it('effort et format partagent `output_config`', async () => {
    const { a, appels } = adaptateur(reponseAnthropic('{}'));
    const schema = { type: 'object' };
    await a.completer('pick_best', demande({ role: 'creatif', raisonnement: 'low', format: { type: 'json', schema } }));
    expect(appels[0].thinking).toEqual({ type: 'adaptive' });
    expect(appels[0].output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema } });
  });

  it('une réponse tronquée ne rend rien : un JSON coupé ne s\'interprète pas', async () => {
    const { a } = adaptateur(reponseAnthropic('{"names": [{"name": "vel', { stop_reason: 'max_tokens' }));
    const r = await a.completer('generate_names', demande());
    expect(r).toMatchObject({ texte: '', tronque: true, refuse: false });
  });

  it('un refus ne rend rien, et se signale', async () => {
    const { a } = adaptateur(reponseAnthropic('', { stop_reason: 'refusal', content: [] }));
    const r = await a.completer('refine', demande());
    expect(r).toMatchObject({ texte: '', tronque: false, refuse: true });
  });

  it('concatène les blocs de texte, et ignore les blocs de réflexion', async () => {
    const { a } = adaptateur(reponseAnthropic('', {
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }],
    }));
    expect((await a.completer('constraints', demande())).texte).toBe('{"a":1}');
  });
});

describe('Refus et troncature, vus des opérations', () => {
  const avec = (r: any) => new DomainService({} as any, {} as any, ModeleIA.avec(adaptateur(r).a));

  it('une reformulation refusée garde la description d\'origine', async () => {
    const svc = avec(reponseAnthropic('', { stop_reason: 'refusal', content: [] }));
    await expect(svc.refineDescription('ma description')).resolves.toBe('ma description');
  });

  it('une génération tronquée compte pour une tentative sans nom', async () => {
    const svc = avec(reponseAnthropic('{"names": [{"name": "velora", "style": "standard"}', { stop_reason: 'max_tokens' }));
    await expect(svc.generateDomainIdeas('desc', ['mot'])).resolves.toEqual([]);
  });

  it('une analyse sur Claude rattache chaque note à son nom recopié', async () => {
    const notice = (name: string) => ({
      name, scores: { memorability: 4, pronunciation: 3, international: 5, seo: 3, distinctiveness: 4 },
      comments: { memorability: 'm', pronunciation: 'p', international: 'i', seo: 's', distinctiveness: 'd' },
      origin: 'o', strengths: 'f', watchout: 'a',
    });
    const svc = avec(reponseAnthropic(JSON.stringify({ analyses: [notice('Zuvo'), notice('velora')] })));
    const res = await svc.analyzeNames(['velora', 'zuvo', 'karos'], 'fr');
    expect([...res.keys()].sort()).toEqual(['velora', 'zuvo']);
  });
});

describe('AnthropicAdaptateur.chercherSurLeWeb', () => {
  it('choisit la version de l\'outil selon le modèle, et borne les recherches', () => {
    expect(outilRechercheWeb('claude-sonnet-5-5')).toEqual({ type: 'web_search_20260209', name: 'web_search', max_uses: RECHERCHES_WEB_MAX });
    expect(outilRechercheWeb('claude-opus-5-5')).toMatchObject({ type: 'web_search_20260209' });
    expect(outilRechercheWeb('claude-haiku-5-5')).toMatchObject({ type: 'web_search_20250305' });
  });

  it('compte les recherches faites, et rend le texte final', async () => {
    const { a, appels } = adaptateur(reponseAnthropic('{"competitors": []}', {
      usage: { input_tokens: 9000, output_tokens: 300, server_tool_use: { web_search_requests: 3 } },
    }));
    const r = await a.chercherSurLeWeb('competitors', { role: 'creatif', message: 'p', maxSortie: 1500, raisonnement: 'low' });
    expect(r).toMatchObject({ texte: '{"competitors": []}', recherchesWeb: 3 });
    expect(appels[0]).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 1950,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: RECHERCHES_WEB_MAX }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
    });
    expect(appels[0].output_config.format).toBeUndefined();
  });

  it('une erreur d\'outil ne compte pas comme recherche faite', async () => {
    const { a } = adaptateur(reponseAnthropic('{"competitors": []}', {
      content: [
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'q' } },
        { type: 'web_search_tool_result', tool_use_id: 's1', content: { type: 'web_search_tool_result_error', error_code: 'unavailable' } },
        { type: 'text', text: '{"competitors": []}' },
      ],
      usage: { input_tokens: 100, output_tokens: 20, server_tool_use: { web_search_requests: 0 } },
    }));
    const r = await a.chercherSurLeWeb('competitors', { role: 'creatif', message: 'p', maxSortie: 1500, raisonnement: 'low' });
    expect(r.recherchesWeb).toBe(0);
  });

  it('relance une fois une boucle serveur interrompue, en renvoyant la réponse partielle', async () => {
    const partielle = reponseAnthropic('', {
      stop_reason: 'pause_turn',
      content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'q' } }],
      usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 1 } },
    });
    const finale = reponseAnthropic('{"competitors": []}', {
      usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 2 } },
    });
    const { a, appels } = adaptateur(partielle, finale);
    const r = await a.chercherSurLeWeb('competitors', { role: 'creatif', message: 'p', maxSortie: 1500, raisonnement: 'low' });
    expect(appels).toHaveLength(2);
    expect(appels[1].messages).toEqual([{ role: 'user', content: 'p' }, { role: 'assistant', content: partielle.content }]);
    expect(r).toMatchObject({ texte: '{"competitors": []}', recherchesWeb: 3 });
  });

  it('une seconde interruption rend un texte vide : l\'appelant passe au repli', async () => {
    const pause = reponseAnthropic('', { stop_reason: 'pause_turn', content: [{ type: 'text', text: 'en cours' }] });
    const { a, appels } = adaptateur(pause, pause);
    const r = await a.chercherSurLeWeb('competitors', { role: 'creatif', message: 'p', maxSortie: 1500, raisonnement: 'low' });
    expect(appels).toHaveLength(2);
    expect(r.texte).toBe('');
  });
});

describe('Repérage du marché sur Claude', () => {
  const service = (web: any, repli?: any) => {
    const reponses = repli ? [web, repli] : [web];
    const create = jest.fn(async () => (reponses.length > 1 ? reponses.shift() : reponses[0]));
    const svc = new DomainService({} as any, {} as any, ModeleIA.avec(new AnthropicAdaptateur({ messages: { create } } as any, MODELES_ANTHROPIC_TEST)));
    // Pas de whois en test : tous les domaines passent pour enregistrés.
    (svc as any).isDomainAvailable = async () => false;
    return { svc, create };
  };

  it('porte `source: web` quand au moins une recherche a eu lieu', async () => {
    const { svc } = service(reponseAnthropic('{"competitors": [{"name": "Qonto", "domain": "qonto.com", "note": "banque"}]}', {
      usage: { input_tokens: 1, output_tokens: 1, server_tool_use: { web_search_requests: 2 } },
    }));
    const r = await svc.findSimilarProductDomains('une banque pour indépendants', 'fr');
    expect(r).toEqual({ competitors: [{ name: 'Qonto', domain: 'qonto.com', note: 'banque' }], source: 'web' });
  });

  it('se replie sur la connaissance du modèle quand la recherche web échoue', async () => {
    const create = jest.fn()
      .mockRejectedValueOnce(new Error('outil indisponible'))
      .mockResolvedValueOnce(reponseAnthropic('{"competitors": [{"name": "Shine", "domain": "shine.fr", "note": "néobanque"}]}'));
    const svc = new DomainService({} as any, {} as any, ModeleIA.avec(new AnthropicAdaptateur({ messages: { create } } as any, MODELES_ANTHROPIC_TEST)));
    (svc as any).isDomainAvailable = async () => false;
    (svc as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const r = await svc.findSimilarProductDomains('une banque pour artisans', 'fr');
    expect(r.source).toBe('model');
    expect(r.competitors.map((c) => c.domain)).toEqual(['shine.fr']);
    expect(create.mock.calls[1][0].output_config.format.type).toBe('json_schema');
  });
});
