import { DomainService } from '../../domain/domain.service';
import { NameVariantsService } from '../../brand-report/trademark/name-variants.service';
import { AdminMailService } from '../../admin/admin-mail.service';
import { modeleOpenAiFactice } from './modele-ia.testing';

/**
 * Avec `AI_PROVIDER=openai`, le chantier promet des requêtes IDENTIQUES à
 * celles d'avant, paramètre pour paramètre. Chaque attente ci-dessous est
 * recopiée de l'appel tel qu'il était écrit dans le service avant d'en être
 * extrait. `toEqual` refuse tout paramètre en plus : un `response_format`
 * ajouté à une opération en texte, par exemple, changerait sa réponse.
 */

const S = 'gpt-simple';
const C = 'gpt-creatif';
const A = 'gpt-analyse';
const JSON_OBJECT = { response_format: { type: 'json_object' } };
const systemeEtUser = (user: string) => [
  { role: 'system', content: expect.any(String) },
  { role: 'user', content: user },
];
const user = [{ role: 'user', content: expect.any(String) }];

function service(contenu = '{}', web = '{"competitors": []}') {
  const chat: any[] = [];
  const responses: any[] = [];
  const modele = modeleOpenAiFactice(
    async (p) => { chat.push(p); return { choices: [{ message: { content: contenu } }] }; },
    async (p) => { responses.push(p); return { output_text: web, output: [] }; },
  );
  return { svc: new DomainService({} as any, {} as any, modele), modele, chat, responses };
}

describe('Requêtes OpenAI, inchangées par le passage au port', () => {
  it('refine', async () => {
    const { svc, chat } = service('Une description');
    await svc.refineDescription('desc');
    expect(chat).toEqual([{ model: S, messages: systemeEtUser('desc'), max_completion_tokens: 500, reasoning_effort: 'none' }]);
  });

  it('suggest_name', async () => {
    const { svc, chat } = service('Velora');
    await svc.suggestProjectName('desc');
    expect(chat).toEqual([{ model: S, messages: systemeEtUser('desc'), max_completion_tokens: 200, reasoning_effort: 'none' }]);
  });

  // Seul écart voulu depuis le port (chantier respecter-le-cahier-des-charges,
  // 31/10/2026) : les mots-clés passent en JSON, pour séparer l'activité du
  // cahier des charges du nom (`namingBusiness`).
  it('keywords : JSON depuis le chantier « respecter le cahier des charges »', async () => {
    const { svc, chat } = service('{"keywords": ["a", "b"], "namingBusiness": false}');
    await svc.generateKeywords('desc', 'fr');
    expect(chat).toEqual([{ model: S, messages: systemeEtUser('desc'), max_completion_tokens: 600, reasoning_effort: 'none', ...JSON_OBJECT }]);
  });

  it('constraints', async () => {
    const { svc, chat } = service('{"minLength": null, "maxLength": null, "avoidWords": [], "referenceBrands": []}');
    await svc.extractNamingConstraints('desc');
    expect(chat).toEqual([{ model: S, messages: user, max_completion_tokens: 300, reasoning_effort: 'none', ...JSON_OBJECT }]);
  });

  it('competitors : recherche web, puis repli sans outil', async () => {
    const { svc, chat, responses } = service('{"competitors": []}');
    await svc.findSimilarProductDomains('une description jamais vue', 'fr');
    expect(responses).toEqual([{
      model: C,
      tools: [{ type: 'web_search' }],
      input: expect.any(String),
      max_output_tokens: 1500,
      reasoning: { effort: 'low' },
    }]);
    expect(chat).toEqual([{ model: C, messages: user, max_completion_tokens: 800, reasoning_effort: 'none', ...JSON_OBJECT }]);
  });

  it('generate_names', async () => {
    const { svc, chat } = service('{"names": []}');
    await svc.generateDomainIdeas('desc', ['mot']);
    expect(chat).toEqual([{ model: C, messages: user, max_completion_tokens: 4000, reasoning_effort: 'none', ...JSON_OBJECT }]);
  });

  it('analyze : budget proportionnel au lot', async () => {
    const { svc, chat } = service('{"analyses": []}');
    await svc.analyzeNames(['velora', 'zuvo'], 'fr');
    expect(chat).toEqual([{ model: A, messages: user, max_completion_tokens: 200 + 320 * 2, reasoning_effort: 'none', ...JSON_OBJECT }]);
  });

  it('pick_best', async () => {
    const { svc, chat } = service('{"recommended": "velora", "reason": "r"}');
    await svc.pickBestDomain([{ name: 'velora', analysis: null, extensions: {} }], 'fr');
    expect(chat).toEqual([{ model: C, messages: user, max_completion_tokens: 600, reasoning_effort: 'low', ...JSON_OBJECT }]);
  });

  it('name_variants', async () => {
    const { modele, chat } = service('{"decoupages": []}');
    await new NameVariantsService(modele).variants('neolegal');
    expect(chat).toEqual([{ model: S, messages: systemeEtUser('neolegal'), max_completion_tokens: 120, reasoning_effort: 'none', ...JSON_OBJECT }]);
  });

  /*
   * Seul écart voulu : le brouillon était écrit pour le modèle créatif, mais
   * se rabattait sur OPENAI_MODEL quand OPENAI_MODEL_CREATIVE manquait — donc
   * sur luna en production, qui ne définit ni l'un ni l'autre. Il suit
   * désormais le rôle créatif comme tous les autres appels de ce rôle.
   */
  it('admin_mail_draft', async () => {
    const { modele, chat } = service('{"langue": "fr", "contexte": "Une phrase."}');
    const svc = Object.create(AdminMailService.prototype) as any;
    Object.assign(svc, {
      modele,
      config: { get: (_k: string, d?: string) => d },
      contexte: async () => ({ langue: 'fr', prenom: 'Ada' }),
    });
    await svc.rediger(1, { prenom: 'Nicolas', nomComplet: 'Nicolas' });
    expect(chat).toEqual([{ model: C, messages: systemeEtUser(expect.any(String)), max_completion_tokens: 200, reasoning_effort: 'none', ...JSON_OBJECT }]);
  });
});
