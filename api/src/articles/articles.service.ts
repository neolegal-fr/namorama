import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { CHEMINS_DU_SITE } from './compilateur/chemins';
import {
  ArticleCompile,
  avecRevision,
  compilerArticle,
  dateDeParis,
  lireEnTete,
  sansRevision,
  Segment,
} from './compilateur/compilateur';
import { Article } from './entities/article.entity';
import { ArticleRevision, TypeAuteur } from './entities/article-revision.entity';

/** Qui écrit : un compte administrateur, ou un jeton de rédaction. */
export interface Auteur {
  type: TypeAuteur;
  /** `sub` Keycloak, ou identifiant du jeton. */
  id: string;
  /** Adresse du compte, ou nom du jeton. */
  nom: string;
}

/** État affiché : un article publié dont la date n'est pas venue est « programmé ». */
export type EtatAffiche = 'brouillon' | 'programme' | 'publie';

/** Ce que lisent l'index, le plan du site et l'en-tête : sans le corps. */
export interface ArticleResume {
  path: string;
  title: string;
  description: string;
  titre: string;
  extrait: string;
  categorie: string;
  publie: string;
  misAJour: string;
  lecture: number;
}

/** Article servi au public : de quoi rendre la page. */
export interface ArticlePublic extends ArticleResume {
  h1: string;
  segments: Segment[];
}

export interface ArticleAdmin extends ArticlePublic {
  id: number;
  etat: EtatAffiche;
  aParu: boolean;
  revision: number;
  majLe: Date;
  majPar: string;
  source: string;
}

export interface RevisionAdmin {
  numero: number;
  auteurType: TypeAuteur;
  auteurNom: string;
  creeLe: Date;
}

export type Verification =
  | { ok: true; article: Omit<ArticleCompile, 'liens'> }
  | { ok: false; causes: string[] };

/** Enregistrement : `id` (écran) ou chemin de la source ; `revisionAttendue` pour une modification. */
export interface DemandeEnregistrement {
  source: string;
  id?: number;
  revisionAttendue?: number | null;
  publier?: boolean;
}

/**
 * Rédaction et lecture des articles du blog (chantier `articles-en-base`).
 *
 * Toute écriture passe par le compilateur ; un article invalide est refusé, avec toutes
 * ses causes, sans rien modifier. Une modification cite la révision sur laquelle elle a
 * été écrite : si l'article a changé depuis, elle est refusée (409) plutôt que d'écraser
 * — Claude et l'éditeur peuvent travailler en même temps.
 */
@Injectable()
export class ArticlesService {
  /** Horloge remplaçable dans les tests. */
  maintenant: () => Date = () => new Date();

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: AppLoggerService,
  ) {}

  private aujourdhui(): string {
    return dateDeParis(this.maintenant());
  }

  private aParu(a: Pick<Article, 'premiereParution'>): boolean {
    return !!a.premiereParution && a.premiereParution <= this.aujourdhui();
  }

  private etatAffiche(a: Article): EtatAffiche {
    if (a.etat === 'brouillon') return 'brouillon';
    return a.publie > this.aujourdhui() ? 'programme' : 'publie';
  }

  // ── Lecture publique ───────────────────────────────────────────────────────

  private estServi(a: Article): boolean {
    return a.etat === 'publie' && a.publie <= this.aujourdhui();
  }

  /** Articles parus, du plus récent au plus ancien. */
  async parus(): Promise<ArticleResume[]> {
    const tous = await this.dataSource.manager.find(Article, { where: { etat: 'publie' } });
    return tous
      .filter((a) => this.estServi(a))
      .sort((x, y) => y.publie.localeCompare(x.publie) || x.path.localeCompare(y.path))
      .map((a) => resume(a));
  }

  /** Un article paru, ou 404 : brouillon et article programmé n'existent pas pour le public. */
  async paru(path: string): Promise<ArticlePublic> {
    const a = await this.dataSource.manager.findOne(Article, { where: { path } });
    if (!a || !this.estServi(a)) throw new NotFoundException('Article introuvable');
    return { ...resume(a), h1: a.h1, segments: a.segments };
  }

  // ── Lecture de rédaction ───────────────────────────────────────────────────

  async lister(): Promise<ArticleAdmin[]> {
    const tous = await this.dataSource.manager.find(Article);
    return tous
      .sort((x, y) => y.publie.localeCompare(x.publie) || x.path.localeCompare(y.path))
      .map((a) => this.vueAdmin(a));
  }

  async lire(id: number): Promise<ArticleAdmin> {
    const a = await this.dataSource.manager.findOne(Article, { where: { id } });
    if (!a) throw new NotFoundException('Article introuvable');
    return this.vueAdmin(a);
  }

  /** La source au format Markdown, avec la ligne `# revision: N` qu'un envoi citera. */
  async exporter(path: string): Promise<{ source: string; revision: number }> {
    const a = await this.dataSource.manager.findOne(Article, { where: { path } });
    if (!a) throw new NotFoundException(`Aucun article à l'adresse ${path}`);
    return { source: avecRevision(a.source, a.revision), revision: a.revision };
  }

  async revisions(id: number): Promise<RevisionAdmin[]> {
    const rs = await this.dataSource.manager.find(ArticleRevision, { where: { articleId: id }, order: { numero: 'DESC' } });
    return rs.map((r) => ({ numero: r.numero, auteurType: r.auteurType, auteurNom: r.auteurNom, creeLe: r.creeLe }));
  }

  async revision(id: number, numero: number): Promise<{ numero: number; source: string }> {
    const r = await this.dataSource.manager.findOne(ArticleRevision, { where: { articleId: id, numero } });
    if (!r) throw new NotFoundException('Révision introuvable');
    return { numero: r.numero, source: r.source };
  }

  private vueAdmin(a: Article): ArticleAdmin {
    return {
      ...resume(a),
      id: a.id,
      h1: a.h1,
      segments: a.segments,
      etat: this.etatAffiche(a),
      aParu: this.aParu(a),
      revision: a.revision,
      majLe: a.majLe,
      majPar: a.majPar,
      source: a.source,
    };
  }

  // ── Compilation ────────────────────────────────────────────────────────────

  /**
   * Chemin → date de parution prévue de chaque article (`null` : brouillon), avec les
   * changements à simuler : un article renommé, une publication groupée.
   */
  private async carteDesArticles(
    m: EntityManager,
    simuler: { retirer?: string; ajouter?: Map<string, string | null> } = {},
  ): Promise<Map<string, string | null>> {
    const tous = await m.find(Article);
    const carte = new Map<string, string | null>();
    for (const a of tous) carte.set(a.path, a.etat === 'publie' ? a.publie : null);
    if (simuler.retirer) carte.delete(simuler.retirer);
    for (const [p, d] of simuler.ajouter ?? []) carte.set(p, d);
    return carte;
  }

  private compiler(source: string, articles: Map<string, string | null>, verifierParution: boolean) {
    return compilerArticle(source, {
      cheminsDuSite: new Set(CHEMINS_DU_SITE),
      articles,
      verifierParution,
      aujourdhui: this.aujourdhui(),
    });
  }

  private refuser(path: string | undefined, causes: string[], auteur: Auteur | null): never {
    this.events.event('article_rejected', {
      path: path ?? null,
      causes: causes.length,
      auteurType: auteur?.type ?? null,
      auteurId: auteur?.id ?? null,
    });
    throw new BadRequestException({ message: 'Article refusé', causes });
  }

  /** Rendu ou causes de refus, sans rien écrire (aperçu de l'écran, vérification de Claude). */
  async verifier(sourceBrute: string, options: { publier?: boolean; id?: number } = {}): Promise<Verification> {
    const source = sansRevision(sourceBrute ?? '');
    const m = this.dataSource.manager;
    const path = lireEnTete(source).entete.path;
    // Sans `id` ni ligne `# revision`, c'est une création : un chemin existant est
    // « pris », comme l'enregistrement le dirait — pas une modification de cet article.
    const creation = !options.id && lireEnTete(sourceBrute ?? '').revision === null;
    const existant = options.id
      ? await m.findOne(Article, { where: { id: options.id } })
      : path && !creation
        ? await m.findOne(Article, { where: { path } })
        : null;
    const publie = options.publier || existant?.etat === 'publie';
    const carte = await this.carteDesArticles(m, {
      retirer: existant?.path,
      ajouter: path ? new Map([[path, publie ? (lireEnTete(source).entete.publie ?? null) : null]]) : undefined,
    });
    const causes = this.causesDeChemin(existant, path, await m.find(Article));
    const r = this.compiler(source, carte, publie);
    if (!r.ok || causes.length) return { ok: false, causes: [...causes, ...(r.ok ? [] : r.causes)] };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { liens, ...article } = r.article;
    return { ok: true, article };
  }

  /** Chemin figé une fois paru ; chemin déjà pris par un autre article. */
  private causesDeChemin(existant: Article | null, path: string | undefined, tous: Article[]): string[] {
    if (!path) return [];
    const causes: string[] = [];
    if (existant && existant.path !== path && this.aParu(existant)) {
      causes.push(`adresse déjà publiée : ${existant.path} a paru et ne peut plus changer d'adresse`);
    }
    const autre = tous.find((a) => a.path === path && a.id !== existant?.id);
    if (autre) causes.push(`path ${path} déjà pris par un autre article`);
    return causes;
  }

  // ── Écriture ───────────────────────────────────────────────────────────────

  /**
   * Crée (en brouillon, sauf `publier`) ou modifie un article.
   *
   * - `id` : l'article visé (écran) ; sinon le chemin de la source le désigne quand une
   *   révision est citée, et une source sans révision est une création.
   * - Une source identique à l'actuelle ne crée aucune révision.
   */
  async enregistrer(demande: DemandeEnregistrement, auteur: Auteur): Promise<ArticleAdmin> {
    const lu = lireEnTete(demande.source ?? '');
    const source = sansRevision(demande.source ?? '');
    const revisionAttendue = demande.revisionAttendue ?? lu.revision ?? null;
    const path = lu.entete.path;

    return this.dataSource.transaction(async (m) => {
      let existant: Article | null = null;
      if (demande.id) {
        existant = await m.findOne(Article, { where: { id: demande.id }, lock: { mode: 'pessimistic_write' } });
        if (!existant) throw new NotFoundException('Article introuvable');
      } else if (revisionAttendue !== null && path) {
        existant = await m.findOne(Article, { where: { path }, lock: { mode: 'pessimistic_write' } });
        if (!existant) throw new NotFoundException(`Aucun article à l'adresse ${path}`);
      } else if (path) {
        const deja = await m.findOne(Article, { where: { path } });
        if (deja) {
          throw new ConflictException({
            message: `Un article existe déjà à l'adresse ${path} : lisez-le d'abord pour le modifier`,
            revisionCourante: deja.revision,
            auteur: deja.majPar,
          });
        }
      }

      if (existant) {
        if (revisionAttendue === null) {
          throw new BadRequestException('Une modification doit citer la révision sur laquelle elle a été écrite');
        }
        if (existant.source === source && !demande.publier) return this.vueAdmin(existant);
        if (existant.revision !== revisionAttendue) {
          throw new ConflictException({
            message: `L'article a changé depuis la révision ${revisionAttendue} : révision ${existant.revision}, par ${existant.majPar}`,
            revisionCourante: existant.revision,
            auteur: existant.majPar,
          });
        }
      }

      const publie = !!demande.publier || existant?.etat === 'publie';
      const tous = await m.find(Article);
      const carte = await this.carteDesArticles(m, {
        retirer: existant?.path,
        ajouter: path ? new Map([[path, publie ? (lu.entete.publie ?? null) : null]]) : undefined,
      });
      const causes = this.causesDeChemin(existant, path, tous);
      const r = this.compiler(source, carte, publie);
      if (!r.ok || causes.length) this.refuser(path, [...causes, ...(r.ok ? [] : r.causes)], auteur);
      const c = (r as { ok: true; article: ArticleCompile }).article;

      const inchange = existant?.source === source;
      const article: Article = existant ?? m.create(Article, { revision: 0, etat: 'brouillon', premiereParution: null });
      Object.assign(article, {
        path: c.path,
        title: c.title,
        description: c.description,
        titre: c.titre,
        extrait: c.extrait,
        categorie: c.categorie,
        publie: c.publie,
        misAJour: c.misAJour,
        source,
        h1: c.h1,
        segments: c.segments,
        liens: c.liens,
        lecture: c.lecture,
      });
      if (!inchange) {
        article.revision += 1;
        article.majLe = this.maintenant();
        article.majPar = auteur.nom;
      }
      const publication = publie && article.etat !== 'publie';
      if (publie) {
        article.etat = 'publie';
        if (!this.aParu(article)) article.premiereParution = article.publie;
      }
      const enregistre = await m.save(Article, article);
      if (!inchange) {
        await m.insert(ArticleRevision, {
          articleId: enregistre.id,
          numero: enregistre.revision,
          source,
          auteurType: auteur.type,
          auteurId: auteur.id,
          auteurNom: auteur.nom,
        });
        this.journaliser('article_saved', enregistre, auteur);
      }
      if (publication) this.journaliser('article_published', enregistre, auteur);
      return this.vueAdmin(enregistre);
    });
  }

  /**
   * Enregistre plusieurs articles d'un coup, jugés ensemble : des articles qui se citent
   * en boucle ne peuvent pas être créés un par un (le premier citerait une adresse
   * inconnue). C'est le chemin de l'import des articles historiques, et d'une série
   * écrite par Claude.
   *
   * Un article déjà en base avec la même source est laissé tel quel : rejouer un import
   * ne crée aucune révision. Un article existant dont la source diffère doit passer par
   * `enregistrer`, qui exige la révision lue. Rien n'est écrit si un seul est refusé.
   */
  async enregistrerLot(
    sources: string[],
    auteur: Auteur,
    options: { publier?: boolean } = {},
  ): Promise<{ crees: string[]; inchanges: string[]; publies: string[] }> {
    if (!Array.isArray(sources) || !sources.length) throw new BadRequestException('Aucun article à enregistrer');
    return this.dataSource.transaction(async (m) => {
      const tous = await m.find(Article);
      const lus = sources.map((brute) => {
        const source = sansRevision(brute ?? '');
        return { source, entete: lireEnTete(source).entete };
      });
      const causes: string[] = [];
      const chemins = new Set<string>();
      const nouveaux: typeof lus = [];
      const inchanges: string[] = [];
      for (const l of lus) {
        const p = l.entete.path;
        if (!p) continue; // la compilation nommera l'en-tête manquant
        if (chemins.has(p)) causes.push(`${p} : présent deux fois dans le lot`);
        chemins.add(p);
        const existant = tous.find((a) => a.path === p);
        if (!existant) nouveaux.push(l);
        else if (existant.source === l.source) inchanges.push(p);
        else causes.push(`${p} : un article existe déjà à cette adresse, avec un autre texte — le modifier en citant sa révision`);
      }
      const carte = await this.carteDesArticles(m, {
        ajouter: new Map(
          lus
            .filter((l) => l.entete.path)
            .map((l) => [l.entete.path!, options.publier ? (l.entete.publie ?? null) : null] as [string, string | null]),
        ),
      });
      const compiles: ArticleCompile[] = [];
      for (const l of lus.filter((x) => !x.entete.path || nouveaux.includes(x))) {
        const r = this.compiler(l.source, carte, !!options.publier);
        if (!r.ok) causes.push(...r.causes.map((c) => `${l.entete.path ?? '(sans path)'} : ${c}`));
        else compiles.push(r.article);
      }
      if (causes.length) this.refuser(undefined, causes, auteur);

      for (const c of compiles) {
        const source = nouveaux.find((l) => l.entete.path === c.path)!.source;
        const publie = !!options.publier;
        const a = await m.save(
          Article,
          m.create(Article, {
            path: c.path,
            title: c.title,
            description: c.description,
            titre: c.titre,
            extrait: c.extrait,
            categorie: c.categorie,
            publie: c.publie,
            misAJour: c.misAJour,
            source,
            h1: c.h1,
            segments: c.segments,
            liens: c.liens,
            lecture: c.lecture,
            revision: 1,
            etat: publie ? 'publie' : 'brouillon',
            premiereParution: publie ? c.publie : null,
            majLe: this.maintenant(),
            majPar: auteur.nom,
          }),
        );
        await m.insert(ArticleRevision, {
          articleId: a.id,
          numero: 1,
          source,
          auteurType: auteur.type,
          auteurId: auteur.id,
          auteurNom: auteur.nom,
        });
        this.journaliser('article_saved', a, auteur);
        if (publie) this.journaliser('article_published', a, auteur);
      }
      // Les articles inchangés mais encore en brouillon sont publiés si demandé.
      const publies: string[] = options.publier ? compiles.map((c) => c.path) : [];
      if (options.publier) {
        for (const p of inchanges) {
          const a = tous.find((x) => x.path === p)!;
          if (a.etat === 'publie') continue;
          const r = this.compiler(a.source, carte, true);
          if (!r.ok) this.refuser(p, r.causes.map((c) => `${p} : ${c}`), auteur);
          a.etat = 'publie';
          if (!this.aParu(a)) a.premiereParution = a.publie;
          await m.save(Article, a);
          this.journaliser('article_published', a, auteur);
          publies.push(p);
        }
      }
      return { crees: compiles.map((c) => c.path), inchanges, publies };
    });
  }

  /**
   * Publie un ou plusieurs articles. Les liens sont jugés comme si tous paraissaient
   * ensemble : des articles qui se citent l'un l'autre ne pourraient pas paraître un
   * par un.
   */
  async publier(paths: string[], auteur: Auteur): Promise<ArticleAdmin[]> {
    if (!Array.isArray(paths) || !paths.length) throw new BadRequestException('Aucun article à publier');
    return this.dataSource.transaction(async (m) => {
      const tous = await m.find(Article);
      const vises = paths.map((p) => {
        const a = tous.find((x) => x.path === p);
        if (!a) throw new NotFoundException(`Aucun article à l'adresse ${p}`);
        return a;
      });
      const carte = await this.carteDesArticles(m, { ajouter: new Map(vises.map((a) => [a.path, a.publie])) });
      const causes: string[] = [];
      for (const a of vises) {
        const r = this.compiler(a.source, carte, true);
        if (!r.ok) causes.push(...r.causes.map((c) => `${a.path} : ${c}`));
      }
      if (causes.length) this.refuser(paths.join(', '), causes, auteur);
      const sortie: ArticleAdmin[] = [];
      for (const a of vises) {
        if (a.etat !== 'publie') {
          a.etat = 'publie';
          if (!this.aParu(a)) a.premiereParution = a.publie;
          await m.save(Article, a);
          this.journaliser('article_published', a, auteur);
        }
        sortie.push(this.vueAdmin(a));
      }
      return sortie;
    });
  }

  /** Les articles publiés (parus ou programmés) qui citent `path`. */
  private citants(tous: Article[], path: string): Article[] {
    return tous.filter((a) => a.path !== path && a.etat === 'publie' && a.liens.includes(path));
  }

  /** Repasse en brouillon. Refusé tant qu'un article publié cite celui-ci. */
  async depublier(path: string, auteur: Auteur): Promise<ArticleAdmin> {
    return this.dataSource.transaction(async (m) => {
      const tous = await m.find(Article);
      const a = tous.find((x) => x.path === path);
      if (!a) throw new NotFoundException(`Aucun article à l'adresse ${path}`);
      if (a.etat === 'brouillon') return this.vueAdmin(a);
      const citants = this.citants(tous, path);
      if (citants.length) {
        throw new ConflictException({
          message: `${path} est cité par ${citants.map((c) => c.path).join(', ')} : retirer ces liens d'abord`,
          citants: citants.map((c) => c.path),
        });
      }
      a.etat = 'brouillon';
      // Jamais servi : son adresse redevient libre de changer.
      if (!this.aParu(a)) a.premiereParution = null;
      await m.save(Article, a);
      this.journaliser('article_unpublished', a, auteur);
      return this.vueAdmin(a);
    });
  }

  /** Reprend le texte d'une révision antérieure : une nouvelle révision, rien d'effacé. */
  async restaurer(id: number, numero: number, auteur: Auteur): Promise<ArticleAdmin> {
    const { source } = await this.revision(id, numero);
    const actuel = await this.lire(id);
    const vue = await this.enregistrer({ source, id, revisionAttendue: actuel.revision }, auteur);
    this.events.event('article_restored', {
      path: vue.path,
      revision: vue.revision,
      depuis: numero,
      auteurType: auteur.type,
      auteurId: auteur.id,
    });
    return vue;
  }

  /** Supprime un brouillon qui n'a jamais paru. Un article paru se dépublie. */
  async supprimer(id: number, auteur: Auteur): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const a = await m.findOne(Article, { where: { id } });
      if (!a) throw new NotFoundException('Article introuvable');
      if (this.aParu(a)) {
        throw new ConflictException({ message: `${a.path} a déjà paru : il ne peut qu'être dépublié`, aParu: true });
      }
      if (a.etat === 'publie') {
        throw new ConflictException({ message: `${a.path} est programmé : le dépublier avant de le supprimer` });
      }
      await m.delete(ArticleRevision, { articleId: id });
      await m.delete(Article, { id });
      this.journaliser('article_deleted', a, auteur);
    });
  }

  private journaliser(nom: string, a: Article, auteur: Auteur): void {
    this.events.event(nom, { path: a.path, revision: a.revision, auteurType: auteur.type, auteurId: auteur.id });
  }
}

function resume(a: Article): ArticleResume {
  return {
    path: a.path,
    title: a.title,
    description: a.description,
    titre: a.titre,
    extrait: a.extrait,
    categorie: a.categorie,
    publie: a.publie,
    misAJour: a.misAJour,
    lecture: a.lecture,
  };
}
