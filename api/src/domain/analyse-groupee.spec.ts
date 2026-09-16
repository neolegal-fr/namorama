import { DomainService } from './domain.service';

/**
 * L'analyse groupée tient sur une promesse : **chaque note revient au nom qui
 * l'a méritée**. Une erreur de rattachement ne se voit pas — le panneau
 * s'affiche, il est simplement faux, et il est facturé. C'est donc là que
 * portent ces tests, pas sur le contenu des notes.
 */

// Une clé factice suffit : le client est remplacé juste après. Construire
// `OpenAI` sans clé LÈVE, et ferait échouer ces tests à l'instanciation.
const config = { get: (k: string) => (k === 'OPENAI_API_KEY' ? 'sk-test' : undefined) } as any;
const rdap = {} as any;

/** Remplace le client OpenAI et retient ce qui lui a été envoyé. */
const withModel = (reply: unknown) => {
  const svc = new DomainService(config, rdap);
  const appels: any[] = [];
  (svc as any).openai = {
    chat: {
      completions: {
        create: async (params: any) => {
          appels.push(params);
          return { choices: [{ message: { content: typeof reply === 'string' ? reply : JSON.stringify(reply) } }] };
        },
      },
    },
  };
  return { svc, appels };
};

const notice = (name: string) => ({
  name,
  scores: { memorability: 4, pronunciation: 3, international: 5, seo: 3, distinctiveness: 4 },
  comments: { memorability: `m-${name}`, pronunciation: 'p', international: 'i', seo: 's', distinctiveness: 'd' },
  origin: `origine de ${name}`,
  strengths: 'f',
  watchout: 'a',
});

describe('DomainService.analyzeNames', () => {
  it('note dix noms en UN SEUL appel au modèle', async () => {
    const noms = ['velora', 'zuvo', 'karos', 'nyxo', 'orva', 'lumiqar', 'treloxy', 'voxifyn', 'namifex', 'aurelix'];
    const { svc, appels } = withModel({ analyses: noms.map(notice) });

    const res = await svc.analyzeNames(noms, 'fr');

    expect(appels).toHaveLength(1);
    expect(res.size).toBe(10);
    expect(appels[0].reasoning_effort).toBe('none');
  });

  /*
   * Le découpage n'est pas une optimisation, c'est un garde-fou : au-delà du
   * budget de sortie le modèle tronque son JSON, et un JSON tronqué ne rend
   * pas un nom de moins — il ne rend rien du tout.
   */
  it('découpe au-delà du lot maximal', async () => {
    const noms = Array.from({ length: 23 }, (_, i) => `nom${i}`);
    const { svc, appels } = withModel({ analyses: noms.map(notice) });

    await svc.analyzeNames(noms, 'fr');

    expect(appels).toHaveLength(3); // 10 + 10 + 3
  });

  it('rend à chaque nom SA note, quel que soit l\'ordre de la réponse', async () => {
    const { svc } = withModel({ analyses: [notice('zuvo'), notice('velora')] });

    const res = await svc.analyzeNames(['velora', 'zuvo'], 'fr');

    expect(JSON.parse(res.get('velora')!).comments.memorability).toBe('m-velora');
    expect(JSON.parse(res.get('zuvo')!).comments.memorability).toBe('m-zuvo');
  });

  /*
   * Le repli par position serait le plus tentant et le pire : il donnerait à
   * un nom les qualités d'un autre, sans que rien ne le signale.
   */
  it('ignore une note dont le nom ne correspond à aucun nom demandé', async () => {
    const { svc } = withModel({ analyses: [notice('autrechose')] });

    const res = await svc.analyzeNames(['velora'], 'fr');

    expect(res.size).toBe(0);
  });

  it('tolère une différence de casse dans le nom recopié', async () => {
    const { svc } = withModel({ analyses: [notice('VELORA')] });

    const res = await svc.analyzeNames(['velora'], 'fr');

    expect(res.get('velora')).toBeDefined();
  });

  /*
   * `lang` pilote la régénération côté front : c'est la seule information
   * dont on connaît la valeur avec certitude, on ne la demande donc pas au
   * modèle.
   */
  it('estampille la langue demandée, sans croire celle du modèle', async () => {
    const { svc } = withModel({ analyses: [{ ...notice('velora'), lang: 'de' }] });

    const res = await svc.analyzeNames(['velora'], 'fr');

    expect(JSON.parse(res.get('velora')!).lang).toBe('fr');
  });

  it('garde le format d\'une note isolée, celui que le front sait lire', async () => {
    const { svc } = withModel({ analyses: [notice('velora')] });

    const parsed = JSON.parse((await svc.analyzeNames(['velora'], 'fr')).get('velora')!);

    expect(Object.keys(parsed).sort()).toEqual(
      ['comments', 'lang', 'origin', 'scores', 'strengths', 'watchout'].sort(),
    );
    expect(parsed.name).toBeUndefined();
  });

  it('rend une Map vide, sans lever, quand la réponse est illisible', async () => {
    const { svc } = withModel('pas du JSON');

    await expect(svc.analyzeNames(['velora'], 'fr')).resolves.toEqual(new Map());
  });

  it('ne demande rien au modèle pour une liste vide', async () => {
    const { svc, appels } = withModel({ analyses: [] });

    await expect(svc.analyzeNames([], 'fr')).resolves.toEqual(new Map());
    expect(appels).toHaveLength(0);
  });

  it('ne facture qu\'une fois un nom présent deux fois dans la demande', async () => {
    const { svc, appels } = withModel({ analyses: [notice('velora')] });

    await svc.analyzeNames(['velora', 'velora'], 'fr');

    expect(appels[0].messages[0].content).toContain('- velora');
    expect(appels[0].messages[0].content.match(/- velora/g)).toHaveLength(1);
  });

  /*
   * Le rapport de marque ne juge qu'un nom et attend une analyse ou une
   * erreur : une chaîne vide s'afficherait en panneau blanc.
   */
  describe('analyzeNameWithAI — enveloppe à un nom', () => {
    it('rend la note du nom demandé', async () => {
      const { svc } = withModel({ analyses: [notice('velora')] });

      await expect(svc.analyzeNameWithAI('velora', 'fr')).resolves.toContain('origine de velora');
    });

    it('lève quand le modèle n\'a rien rendu d\'exploitable', async () => {
      const { svc } = withModel({ analyses: [] });

      await expect(svc.analyzeNameWithAI('velora', 'fr')).rejects.toThrow('velora');
    });
  });
});
