import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ArticlesService, Auteur } from './articles.service';
import { Article } from './entities/article.entity';
import { ArticleRevision } from './entities/article-revision.entity';

/**
 * Base en mémoire : juste ce que le service demande à un `EntityManager`. Les objets
 * sont copiés à l'entrée et à la sortie, comme le ferait une vraie base — un test ne
 * doit pas passer parce qu'un objet est partagé.
 */
function fausseBase() {
  const tables = new Map<unknown, any[]>([
    [Article, []],
    [ArticleRevision, []],
  ]);
  let seq = 0;
  const correspond = (ligne: any, where: any = {}) => Object.entries(where).every(([k, v]) => ligne[k] === v);
  const copie = <T>(x: T): T => (x ? JSON.parse(JSON.stringify(x)) : x);
  const manager: any = {
    find: async (e: unknown, opts: any = {}) => {
      let lignes = tables.get(e)!.filter((l) => correspond(l, opts.where));
      if (opts.order?.numero === 'DESC') lignes = [...lignes].sort((a, b) => b.numero - a.numero);
      return lignes.map(copie);
    },
    findOne: async (e: unknown, opts: any) => copie(tables.get(e)!.find((l) => correspond(l, opts.where)) ?? null),
    create: (_e: unknown, x: any) => ({ ...x }),
    save: async (e: unknown, x: any) => {
      const t = tables.get(e)!;
      const i = t.findIndex((l) => l.id === x.id);
      const ligne = copie({ ...x, id: x.id ?? ++seq });
      if (i >= 0) t[i] = ligne;
      else t.push(ligne);
      return copie(ligne);
    },
    insert: async (e: unknown, x: any) => {
      tables.get(e)!.push(copie({ ...x, id: ++seq, creeLe: new Date() }));
    },
    delete: async (e: unknown, where: any) => {
      tables.set(e, tables.get(e)!.filter((l) => !correspond(l, where)));
    },
  };
  const dataSource: any = { manager, transaction: async (cb: (m: any) => unknown) => cb(manager) };
  return { dataSource, tables };
}

const ADMIN: Auteur = { type: 'compte', id: 'sub-admin', nom: 'admin@exemple.fr' };
const CLAUDE: Auteur = { type: 'jeton', id: '7', nom: 'Claude Code — poste' };

function source(path: string, corps = 'Un paragraphe.', extra: Record<string, string> = {}) {
  const e: Record<string, string> = {
    path,
    title: 'Titre de page',
    description: 'Description',
    titre: "Titre d'index",
    extrait: 'Extrait',
    categorie: 'Secteurs',
    publie: '2026-11-23',
    misAJour: '2026-11-23',
    ...extra,
  };
  return `---\n${Object.entries(e).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n# Le titre\n\n${corps}\n`;
}

function monter(jour = '2026-11-23T10:00:00Z') {
  const { dataSource, tables } = fausseBase();
  const events = { event: jest.fn() };
  const svc = new ArticlesService(dataSource, events as any);
  svc.maintenant = () => new Date(jour);
  return { svc, tables, events, avancer: (j: string) => (svc.maintenant = () => new Date(j)) };
}

const causesDe = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('accepté à tort');
};

describe('ArticlesService — vérification et création', () => {
  it('vérifie sans rien écrire', async () => {
    const { svc, tables } = monter();
    const mots = Array.from({ length: 1298 }, () => 'mot').join(' ');
    const v = await svc.verifier(source('/blog/nom-de-restaurant', mots));
    expect(v.ok && v.article.lecture).toBe(6);
    expect(tables.get(Article)).toHaveLength(0);
    expect(tables.get(ArticleRevision)).toHaveLength(0);
  });

  it('renvoie toutes les causes d’un article invalide', async () => {
    const { svc } = monter();
    const v = await svc.verifier(source('/nom-de-restaurant', '[x](/nulle-part)', { categorie: 'Secteur' }));
    expect(v.ok).toBe(false);
    // Catégorie : l'en-tête est refusé avant le corps.
    expect(!v.ok && v.causes.join()).toMatch(/catégorie inconnue/);
  });

  it('un nouvel article est un brouillon, absent du public', async () => {
    const { svc, tables } = monter();
    const a = await svc.enregistrer({ source: source('/blog/nom-de-restaurant') }, CLAUDE);
    expect(a.etat).toBe('brouillon');
    expect(a.revision).toBe(1);
    expect(tables.get(ArticleRevision)![0]).toMatchObject({ numero: 1, auteurType: 'jeton', auteurNom: 'Claude Code — poste' });
    await expect(svc.paru('/blog/nom-de-restaurant')).rejects.toBeInstanceOf(NotFoundException);
    expect(await svc.parus()).toEqual([]);
  });

  it('refuse un article invalide sans rien écrire, et le journalise', async () => {
    const { svc, tables, events } = monter();
    const e = await causesDe(svc.enregistrer({ source: source('/blog/a', '[le guide](/guides/trouver-un-nom-de-marque)') }, ADMIN));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((e as BadRequestException).getResponse())).toMatch(/\/guides\/trouver-un-nom-de-marque/);
    expect(tables.get(Article)).toHaveLength(0);
    expect(events.event).toHaveBeenCalledWith('article_rejected', expect.objectContaining({ path: '/blog/a', causes: 1 }));
  });

  it('une création sur un chemin pris est un conflit', async () => {
    const { svc } = monter();
    await svc.enregistrer({ source: source('/blog/a') }, ADMIN);
    await expect(svc.enregistrer({ source: source('/blog/a', 'Autre.') }, CLAUDE)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ArticlesService — modification', () => {
  it('aller-retour sans modification : aucune révision', async () => {
    const { svc, tables } = monter();
    await svc.enregistrer({ source: source('/guides/trouver-nom-de-produit') }, ADMIN);
    const { source: lue, revision } = await svc.exporter('/guides/trouver-nom-de-produit');
    expect(lue).toMatch(/^---\n# revision: 1\n/);
    const a = await svc.enregistrer({ source: lue }, CLAUDE);
    expect(a.revision).toBe(revision);
    expect(tables.get(ArticleRevision)).toHaveLength(1);
  });

  it('Claude et l’éditeur en même temps : le second est refusé, sans écrasement', async () => {
    const { svc } = monter();
    const cree = await svc.enregistrer({ source: source('/blog/a', 'v1') }, ADMIN);
    for (const v of ['v2', 'v3', 'v4']) await svc.enregistrer({ source: source('/blog/a', v), id: cree.id, revisionAttendue: (await svc.lire(cree.id)).revision }, ADMIN);
    // L'administrateur a ouvert la révision 4 ; Claude écrit la 5 depuis sa lecture.
    const { source: lue } = await svc.exporter('/blog/a');
    await svc.enregistrer({ source: lue.replace('v4', 'v5 par Claude') }, CLAUDE);
    const e = await causesDe(svc.enregistrer({ source: source('/blog/a', 'v5 par admin'), id: cree.id, revisionAttendue: 4 }, ADMIN));
    expect(e).toBeInstanceOf(ConflictException);
    expect((e as ConflictException).getResponse()).toMatchObject({ revisionCourante: 5, auteur: 'Claude Code — poste' });
    expect((await svc.lire(cree.id)).source).toMatch(/v5 par Claude/);
  });

  it('une modification sans révision citée est refusée', async () => {
    const { svc } = monter();
    const a = await svc.enregistrer({ source: source('/blog/a') }, ADMIN);
    await expect(svc.enregistrer({ source: source('/blog/a', 'x'), id: a.id }, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restaurer la révision 3 sur 5 en crée une 6e, sans effacer', async () => {
    const { svc, tables } = monter();
    const a = await svc.enregistrer({ source: source('/blog/a', 'v1') }, ADMIN);
    for (const v of ['v2', 'v3', 'v4', 'v5']) await svc.enregistrer({ source: source('/blog/a', v), id: a.id, revisionAttendue: (await svc.lire(a.id)).revision }, ADMIN);
    const r = await svc.restaurer(a.id, 3, ADMIN);
    expect(r.revision).toBe(6);
    expect(r.source).toMatch(/v3/);
    expect(tables.get(ArticleRevision)).toHaveLength(6);
    expect((await svc.revisions(a.id)).map((x) => x.numero)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('un brouillon peut changer d’adresse ; un article paru, non', async () => {
    const { svc } = monter();
    const b = await svc.enregistrer({ source: source('/blog/a') }, ADMIN);
    const renomme = await svc.enregistrer({ source: source('/blog/b'), id: b.id, revisionAttendue: 1 }, ADMIN);
    expect(renomme.path).toBe('/blog/b');

    const p = await svc.enregistrer({ source: source('/generateur-nom-saas'), publier: true }, ADMIN);
    const e = await causesDe(svc.enregistrer({ source: source('/blog/generateur-nom-saas'), id: p.id, revisionAttendue: p.revision }, ADMIN));
    expect(JSON.stringify((e as BadRequestException).getResponse())).toMatch(/adresse déjà publiée/);
  });
});

describe('ArticlesService — publication et liens', () => {
  it('publication immédiate : servi aussitôt', async () => {
    const { svc } = monter();
    await svc.enregistrer({ source: source('/blog/a') }, ADMIN);
    await svc.publier(['/blog/a'], ADMIN);
    expect((await svc.paru('/blog/a')).h1).toBe('Le titre');
  });

  it('article programmé : absent la veille, présent le jour venu à 0 h 05 Paris', async () => {
    const { svc, avancer } = monter('2026-11-29T22:50:00Z'); // 23 h 50 le 29/11 à Paris
    await svc.enregistrer({ source: source('/blog/brief-de-naming', 'x', { publie: '2026-11-30', misAJour: '2026-11-30' }), publier: true }, CLAUDE);
    await expect(svc.paru('/blog/brief-de-naming')).rejects.toBeInstanceOf(NotFoundException);
    expect((await svc.lister())[0].etat).toBe('programme');
    avancer('2026-11-29T23:05:00Z'); // 0 h 05 le 30/11 à Paris
    expect((await svc.parus()).map((a) => a.path)).toEqual(['/blog/brief-de-naming']);
  });

  it('un article programmé ne cite pas un article à paraître après lui', async () => {
    const { svc } = monter();
    await svc.enregistrer({ source: source('/blog/shortlist', 'x', { publie: '2026-12-07', misAJour: '2026-12-07' }), publier: true }, ADMIN);
    const e = await causesDe(
      svc.enregistrer({ source: source('/blog/brief', '[la suite](/blog/shortlist)', { publie: '2026-11-30', misAJour: '2026-11-30' }), publier: true }, ADMIN),
    );
    expect(JSON.stringify((e as BadRequestException).getResponse())).toMatch(/article programmé le 2026-12-07/);
  });

  it('un brouillon cite un brouillon ; c’est la publication qui tranche', async () => {
    const { svc } = monter();
    await svc.enregistrer({ source: source('/blog/b') }, ADMIN);
    await svc.enregistrer({ source: source('/blog/a', '[b](/blog/b)') }, ADMIN);
    const e = await causesDe(svc.publier(['/blog/a'], ADMIN));
    expect(JSON.stringify((e as BadRequestException).getResponse())).toMatch(/\/blog\/a : lien vers \/blog\/b, article en brouillon/);
  });

  it('deux articles qui se citent paraissent ensemble', async () => {
    const { svc } = monter();
    const b = await svc.enregistrer({ source: source('/blog/b') }, ADMIN);
    await svc.enregistrer({ source: source('/blog/a', '[b](/blog/b)') }, ADMIN);
    await svc.enregistrer({ source: source('/blog/b', '[a](/blog/a)'), id: b.id, revisionAttendue: 1 }, ADMIN);
    await expect(svc.publier(['/blog/a'], ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    await svc.publier(['/blog/a', '/blog/b'], ADMIN);
    expect((await svc.parus()).map((a) => a.path)).toEqual(['/blog/a', '/blog/b']);
  });

  it('lot : des articles qui se citent en boucle sont créés et publiés ensemble ; rejouer ne change rien', async () => {
    const { svc, tables } = monter();
    const lot = [
      source('/guides/trouver-nom-de-marque', '[inpi](/recherche-anteriorite-marque-inpi)', { publie: '2026-06-10', misAJour: '2026-09-03' }),
      source('/recherche-anteriorite-marque-inpi', '[guide](/guides/trouver-nom-de-marque)', { publie: '2026-09-03', misAJour: '2026-09-03' }),
      source('/blog/brief-de-naming', 'x', { publie: '2026-11-30', misAJour: '2026-11-30' }),
    ];
    expect(await svc.enregistrerLot(lot, CLAUDE, { publier: true })).toMatchObject({ crees: expect.arrayContaining(['/blog/brief-de-naming']), publies: expect.any(Array) });
    expect((await svc.parus()).map((a) => a.path)).toEqual(['/recherche-anteriorite-marque-inpi', '/guides/trouver-nom-de-marque']);
    expect((await svc.lister()).map((a) => a.etat)).toEqual(['programme', 'publie', 'publie']);
    const avant = tables.get(ArticleRevision)!.length;
    expect(await svc.enregistrerLot(lot, CLAUDE, { publier: true })).toEqual({ crees: [], inchanges: lot.map((s) => expect.any(String)), publies: [] });
    expect(tables.get(ArticleRevision)).toHaveLength(avant);
  });

  it('lot : un seul article refusé, rien n’est écrit', async () => {
    const { svc, tables } = monter();
    const e = await causesDe(svc.enregistrerLot([source('/blog/a'), source('/blog/b', '<div>x</div>')], ADMIN));
    expect(JSON.stringify((e as BadRequestException).getResponse())).toMatch(/\/blog\/b : ligne \d+ : HTML brut/);
    expect(tables.get(Article)).toHaveLength(0);
  });

  it('dépublication refusée tant qu’un article publié cite la cible', async () => {
    const { svc } = monter();
    await svc.enregistrer({ source: source('/recherche-anteriorite-marque-inpi'), publier: true }, ADMIN);
    await svc.enregistrer({ source: source('/guides/trouver-nom-de-marque', '[inpi](/recherche-anteriorite-marque-inpi)'), publier: true }, ADMIN);
    const e = await causesDe(svc.depublier('/recherche-anteriorite-marque-inpi', ADMIN));
    expect(e).toBeInstanceOf(ConflictException);
    expect((e as ConflictException).getResponse()).toMatchObject({ citants: ['/guides/trouver-nom-de-marque'] });
  });

  it('dépublication : retiré du public, l’index ne le liste plus', async () => {
    const { svc } = monter();
    await svc.enregistrer({ source: source('/blog/outils-de-naming-pour-agences'), publier: true }, ADMIN);
    await svc.depublier('/blog/outils-de-naming-pour-agences', ADMIN);
    expect(await svc.parus()).toEqual([]);
  });

  it('suppression : un article paru se dépublie seulement ; un brouillon jamais paru se supprime', async () => {
    const { svc, tables } = monter();
    const p = await svc.enregistrer({ source: source('/namorama-vs-namelix'), publier: true }, ADMIN);
    await expect(svc.supprimer(p.id, ADMIN)).rejects.toBeInstanceOf(ConflictException);
    await svc.depublier('/namorama-vs-namelix', ADMIN);
    await expect(svc.supprimer(p.id, ADMIN)).rejects.toBeInstanceOf(ConflictException); // a paru
    const b = await svc.enregistrer({ source: source('/blog/brouillon') }, ADMIN);
    await svc.supprimer(b.id, ADMIN);
    expect(tables.get(Article)!.map((a) => a.path)).toEqual(['/namorama-vs-namelix']);
    expect(tables.get(ArticleRevision)!.some((r) => r.articleId === b.id)).toBe(false);
  });
});

describe('ArticlesService — journal', () => {
  it('chaque geste émet son événement, sans le texte', async () => {
    const { svc, events } = monter();
    const a = await svc.enregistrer({ source: source('/blog/nom-de-restaurant', 'Texte secret.') }, CLAUDE);
    await svc.publier(['/blog/nom-de-restaurant'], CLAUDE);
    await svc.depublier('/blog/nom-de-restaurant', ADMIN);
    await svc.enregistrer({ source: source('/blog/nom-de-restaurant', 'Autre.'), id: a.id, revisionAttendue: 1 }, ADMIN);
    await svc.restaurer(a.id, 1, ADMIN);
    const noms = events.event.mock.calls.map((c) => c[0]);
    expect(noms).toEqual(['article_saved', 'article_published', 'article_unpublished', 'article_saved', 'article_saved', 'article_restored']);
    expect(events.event).toHaveBeenCalledWith('article_published', { path: '/blog/nom-de-restaurant', revision: 1, auteurType: 'jeton', auteurId: '7' });
    for (const [, donnees] of events.event.mock.calls) expect(JSON.stringify(donnees)).not.toMatch(/Texte secret|Autre\.|source|corps/);
  });
});
