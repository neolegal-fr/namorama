import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { DomainSuggestion } from '../projects/entities/domain-suggestion.entity';
import { CreditAdjustment } from './entities/credit-adjustment.entity';
import { BrandReportRecord } from '../brand-report/entities/brand-report-record.entity';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { comptesMesures, creditsGratuitsSql, jourISO, lundiDe, semaineSql } from './predicats';
import { FREE_MONTHLY_QUOTA, renouvellementDu } from '../users/users.service';
import { ModelCostsService } from './model-costs.service';

export interface AdminUserRow {
  id: number;
  keycloakId: string;
  email: string;
  firstName: string;
  lastName: string;
  /**
   * Crédits gratuits DISPONIBLES : ceux de la base, ou le quota mensuel si le
   * renouvellement du mois n'a pas encore été écrit (compte pas revenu depuis).
   */
  credits: number;
  extraCredits: number;
  totalCredits: number;
  /**
   * Le quota du mois est dû mais pas encore écrit en base : il le sera au
   * prochain passage du compte. `credits` affiche déjà le quota.
   */
  freeCreditsRenewalPending: boolean;
  createdAt: Date;
  lastLogin: Date | null;
  projectCount: number;
  /**
   * Rapports de marque produits pour ce compte. Compte les rapports réellement
   * générés (un par nom distinct) : une demande bloquée faute de crédits ou en
   * échec n'y figure pas — seuls les logs les voient (`brand_report_requested`).
   */
  brandReportCount: number;
  /**
   * Compte interne (vôtre, démonstration, test) : écarté de toutes les
   * statistiques. Se coche à la main — rien dans les données ne le trahit.
   */
  isInternal: boolean;
  /**
   * Coût cumulé des appels au modèle imputés à ce compte, en dollars, au tarif
   * de chaque appel. `null` : aucun appel relevé — pas « zéro dollar ».
   */
  aiCostUsd: number | null;
  /** Appels sans tarif connu, absents de `aiCostUsd`. */
  aiUnpricedCalls: number;
  /**
   * Crédits consommés depuis la création du compte : suggestions + coût réel
   * des rapports. Le dénominateur du coût par crédit.
   */
  creditsConsumed: number;
  /** Suggestions de ses projets notées 👍 / 👎 — par lui ou un collaborateur en écriture. */
  likes: number;
  dislikes: number;
  /**
   * Dernier courriel écrit depuis l'admin et accepté par le SMTP : pour ne pas
   * écrire deux fois à la même personne sans le savoir.
   */
  lastMailAt: Date | null;
  lastMailSubject: string | null;
  /** Ce courriel a reçu une réponse, saisie depuis l'admin. */
  lastMailReplied: boolean;
}

/**
 * L'entonnoir d'une fenêtre : combien sont venus, et jusqu'où ils sont allés.
 *
 * Volumétrie brute, sans pourcentage — les taux se calculent à l'affichage,
 * qui est le seul endroit à savoir quel dénominateur il montre. Deux
 * dénominateurs coexistent ici, et les confondre fausserait l'inscription :
 * une visite arrivée avec un compte ouvert ne pouvait pas en créer un.
 */
export interface FunnelMetrics {
  /** Visites (sessions de navigateur), comptes internes et admin écartés. */
  visits: number;
  /** Celles arrivées SANS compte ouvert — dénominateur de l'étape « inscription ». */
  visitsAnonymous: number;
  searched: number;
  accountsCreated: number;
  /** Demandes de rapport, y compris refusées faute de crédits : c'est l'intention qu'on compte. */
  reportsRequested: number;
  /**
   * Visites rattachées à un compte qui existe encore — dénominateur de la
   * fidélité, et lui seul.
   *
   * Une visite n'est rattachée qu'au premier appel authentifié : la grande
   * majorité des visites restent anonymes, et les rapporter à ce taux
   * répondrait à une autre question. Les visites dont le compte a été supprimé
   * depuis en sont exclues aussi : on ne sait plus quand il a été créé, et le
   * ranger d'office parmi les nouveaux inventerait une inscription.
   */
  visitsIdentified: number;
  /**
   * Parmi elles, celles dont le compte existait DÉJÀ au début de la fenêtre.
   *
   * C'est la part de revenants : le complément (`visitsIdentified -
   * visitsReturning`) est le fait de comptes nés pendant la période, qui
   * gonflent l'usage sans rien dire de la rétention.
   */
  visitsReturning: number;
  /** Visites ayant ouvert le dialogue des packs de crédits — la « page tarifs ». */
  pricingViewed: number;
  /** Visites ayant lancé un paiement Stripe, abouti ou non. */
  checkoutStarted: number;
}

/**
 * Ce qu'on mesure sur une fenêtre de temps. Le tableau de bord en calcule deux
 * — la période choisie et celle de même durée qui la précède — pour que chaque
 * chiffre s'affiche avec son évolution plutôt que seul.
 */
export interface PeriodMetrics {
  /** Bornes effectives, renvoyées telles qu'utilisées (ISO 8601). */
  from: string;
  to: string;
  /**
   * Comptes distincts ayant utilisé le produit.
   *
   * `null` = NON MESURABLE sur cette fenêtre, pas zéro. Voir
   * {@link AdminService.comptesActifs} : avant le journal d'activité, seule une
   * fenêtre se terminant maintenant avait une réponse juste.
   */
  activeUsers: number | null;
  newUsers: number;
  newProjects: number;
  suggestions: number;
  brandReports: number;
  /** Suggestions (1 crédit) + coût réel des rapports produits. */
  creditsConsumed: number;
  /** Inscrits de la fenêtre ayant créé au moins un projet depuis. */
  activatedUsers: number;
  /** `activatedUsers / newUsers` en %, ou `null` si personne ne s'est inscrit. */
  activationRate: number | null;
  /**
   * Notes posées sur les suggestions GÉNÉRÉES dans la fenêtre — pas sur les
   * notes posées dans la fenêtre : la question est « les noms de cette période
   * plaisent-ils ? », et c'est la date de la suggestion qui la situe. Une note
   * tardive sur un nom ancien rejoint donc la période de ce nom.
   */
  likes: number;
  dislikes: number;
  /**
   * Comptes dont les projets portent ces notes. À ce volume, un seul compte
   * qui écarte cent noms suffit à faire le taux : ce chiffre le dit.
   */
  ratingAccounts: number;
  /**
   * L'entonnoir de la fenêtre, ou `null` si son calcul a échoué.
   *
   * `null` n'est pas « zéro visiteur » : c'est « pas de réponse ». Le
   * dénominateur vit dans une table à part, jointe au compte — une jointure
   * suffit à faire échouer la requête (collation, schéma), et il serait absurde
   * qu'une carte nouvelle emporte les quinze autres avec elle.
   */
  funnel: FunnelMetrics | null;
}

export interface AdminStats {
  period: PeriodMetrics;
  previous: PeriodMetrics;
  totalUsers: number;
  totalProjects: number;
  totalSuggestions: number;
  totalBrandReports: number;
  avgSuggestionsPerProject: number;
  avgFavoritesPerProject: number;
  totalFreeCredits: number;
  totalPackCredits: number;
  /**
   * Premier jour couvert par le journal d'activité (`AAAA-MM-JJ`), ou `null`
   * s'il est vide. Sert à l'interface pour dire « mesuré depuis le … » au lieu
   * de laisser croire à un trou dans l'usage.
   */
  activityTrackingSince: string | null;
  /**
   * Première visite enregistrée (`AAAA-MM-JJ`), ou `null` si le journal des
   * visites est vide. Avant cette date, il n'y a pas « zéro visiteur » — il n'y
   * a pas de mesure, et l'interface doit le dire plutôt que d'afficher 0 %.
   */
  visitTrackingSince: string | null;
  /** Voir {@link TARIFS_MESURES_DEPUIS}. */
  pricingTrackingSince: string;
}

/** Un point de la série hebdomadaire. `week` est le LUNDI de la semaine. */
export interface WeeklyPoint {
  week: string;
  newUsers: number;
  /** `null` avant le démarrage du journal d'activité — un trou, pas un zéro. */
  activeUsers: number | null;
  /** Projets créés : une recherche aboutie, ou un nom soumis au test. */
  projects: number;
  creditsConsumed: number;
  /** Visites de la semaine. `null` avant le démarrage du journal des visites. */
  visits: number | null;
  /** Suggestions de la semaine notées 👍 / 👎 (voir `PeriodMetrics.likes`). */
  likes: number;
  dislikes: number;
  /** Visites de la semaine ayant ouvert le dialogue des packs. `null` : pas mesuré. */
  pricingViewed: number | null;
}

export interface AdminSeries {
  weeks: WeeklyPoint[];
  activityTrackingSince: string | null;
  visitTrackingSince: string | null;
  pricingTrackingSince: string;
}

/**
 * Premier jour où l'ouverture du dialogue des packs est connue.
 *
 * L'événement `credits_dialog_opened` existe depuis le 12/09/2026 ; les visites
 * antérieures au marquage en base ont été rattrapées depuis les logs
 * (`2026-09-24-tarifs-consultes.sql`). Avant cette date, rien : « 0 » y serait
 * un chiffre inventé.
 */
export const TARIFS_MESURES_DEPUIS = '2026-09-12';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(DomainSuggestion) private suggestionRepo: Repository<DomainSuggestion>,
    @InjectRepository(CreditAdjustment) private adjustmentRepo: Repository<CreditAdjustment>,
    @InjectRepository(BrandReportRecord) private brandReportRepo: Repository<BrandReportRecord>,
    private dataSource: DataSource,
    private readonly logger: AppLoggerService,
    private readonly modelCosts: ModelCostsService,
  ) {}

  /**
   * Nombre de rapports de marque par compte, pour une page d'utilisateurs.
   *
   * `BrandReportRecord` n'a pas de relation TypeORM vers `User` (il ne porte que
   * le `sub` Keycloak) : `loadRelationCountAndMap` ne s'applique donc pas, d'où
   * cette agrégation en une requête pour toute la page — et non une par ligne.
   */
  private async brandReportCounts(keycloakIds: string[]): Promise<Map<string, number>> {
    if (!keycloakIds.length) return new Map();
    const rows = await this.brandReportRepo.createQueryBuilder('r')
      .select('r.keycloakId', 'keycloakId')
      .addSelect('COUNT(*)', 'cnt')
      .where('r.keycloakId IN (:...ids)', { ids: keycloakIds })
      .groupBy('r.keycloakId')
      .getRawMany<{ keycloakId: string; cnt: string }>();
    return new Map(rows.map((r) => [r.keycloakId, Number(r.cnt)]));
  }

  /**
   * Nombre de projets par compte, pour une page d'utilisateurs.
   *
   * TypeORM 1.x a retiré `loadRelationCountAndMap`, qui portait ce décompte.
   * Même agrégation groupée que {@link brandReportCounts} : une requête pour
   * toute la page, et non une par ligne.
   */
  private async projectCounts(userIds: number[]): Promise<Map<number, number>> {
    if (!userIds.length) return new Map();
    const rows = await this.projectRepo.createQueryBuilder('p')
      .select('u.id', 'userId')
      .addSelect('COUNT(*)', 'cnt')
      .innerJoin('p.user', 'u')
      .where('u.id IN (:...ids)', { ids: userIds })
      .groupBy('u.id')
      .getRawMany<{ userId: number; cnt: string }>();
    return new Map(rows.map((r) => [Number(r.userId), Number(r.cnt)]));
  }

  /**
   * Les comptes retenus dans les statistiques : ni admin, ni interne.
   *
   * Ce prédicat apparaît DIX-NEUF fois dans ce fichier — un par agrégat. Écrit
   * à la main à chaque endroit, il suffisait d'en oublier un pour qu'un seul
   * indicateur compte les comptes de test, sans que rien ne le signale : le
   * chiffre reste plausible, il est simplement faux. D'où une seule source.
   *
   * Les deux drapeaux ne se recouvrent pas. `isAdmin` est recopié du token
   * Keycloak et ne couvre que les porteurs du rôle realm ; `isInternal` se
   * coche à la main, parce que rien dans les données ne trahit un compte de
   * test (cf. la migration du 23/08/2026).
   */
  private static comptesMesures(alias = 'u'): string {
    return comptesMesures(alias);
  }

  /**
   * Colonnes triables, et l'expression SQL de chacune.
   *
   * Liste BLANCHE : le paramètre vient de l'URL, et il finit dans un ORDER BY,
   * c'est-à-dire à un endroit qu'aucun paramètre lié ne protège. Tout ce qui
   * n'est pas dans cette table est refusé.
   *
   * Les deux compteurs passent par une sous-requête corrélée plutôt qu'une
   * jointure : ils sont calculés APRÈS pagination dans le reste de la méthode
   * (deux requêtes groupées, pour ne pas multiplier les lignes), et un tri ne
   * peut pas porter sur une valeur que la requête ne connaît pas encore.
   */
  private static readonly TRIS: Record<string, string> = {
    name: 'u.firstName',
    email: 'u.email',
    totalCredits: `(${creditsGratuitsSql()} + u.extraCredits)`,
    createdAt: 'u.createdAt',
    lastLogin: 'u.lastLogin',
    projectCount: '(SELECT COUNT(*) FROM project p WHERE p.userId = u.id)',
    brandReportCount: '(SELECT COUNT(*) FROM brand_report_record b WHERE b.keycloakId = u.keycloakId)',
    aiCostUsd: ModelCostsService.TRI_COUT,
    likes: `(SELECT COUNT(*) FROM domain_suggestion ds INNER JOIN project p ON p.id = ds.projectId
              WHERE p.userId = u.id AND ds.rating = 'liked')`,
    lastMailAt: '(SELECT MAX(m.createdAt) FROM admin_mail m WHERE m.userId = u.id AND m.delivered = 1)',
  };

  async getUsers(
    page: number,
    limit: number,
    search: string,
    sort = 'createdAt',
    dir: 'ASC' | 'DESC' = 'DESC',
  ): Promise<{ data: AdminUserRow[]; total: number }> {
    const colonne = AdminService.TRIS[sort] ?? AdminService.TRIS['createdAt'];
    const sens = dir === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.userRepo.createQueryBuilder('u')
      .orderBy(colonne, sens)
      // Départage stable : sans second critère, deux comptes de même valeur
      // peuvent changer de page d'un appel à l'autre — et l'un d'eux
      // disparaître de la liste pendant qu'on la parcourt.
      .addOrderBy('u.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.where('u.email LIKE :search', { search: `%${search}%` });
    }

    const [users, total] = await qb.getManyAndCount();
    return { data: await this.lignes(users), total };
  }

  /**
   * Crédits consommés par compte : suggestions (1 crédit) + coût réel des
   * rapports. Même reconstitution que `metriquesPeriode`, sur tout l'historique.
   */
  private async creditsConsommes(users: User[]): Promise<Map<number, number>> {
    if (!users.length) return new Map();
    const [sugg, rapports] = await Promise.all([
      this.dataSource.query(
        `SELECT p.userId AS userId, COUNT(*) AS n
           FROM domain_suggestion ds INNER JOIN project p ON p.id = ds.projectId
          WHERE p.userId IN (?) GROUP BY p.userId`,
        [users.map((u) => u.id)],
      ),
      this.dataSource.query(
        `SELECT r.keycloakId AS keycloakId, COALESCE(SUM(r.costCredits), 0) AS n
           FROM brand_report_record r
          WHERE r.keycloakId IN (?) GROUP BY r.keycloakId`,
        [users.map((u) => u.keycloakId)],
      ),
    ]);
    const parSub = new Map<string, number>(rapports.map((r: any) => [String(r.keycloakId), Number(r.n)]));
    const parId = new Map<number, number>(sugg.map((r: any) => [Number(r.userId), Number(r.n)]));
    return new Map(users.map((u) => [u.id, (parId.get(u.id) ?? 0) + (parSub.get(u.keycloakId) ?? 0)]));
  }

  /**
   * 👍 / 👎 par compte, sur les suggestions de SES projets.
   *
   * Le compte du projet, pas celui qui a cliqué : la note n'est ni horodatée
   * ni signée, et c'est de toute façon au propriétaire que la recherche a été
   * facturée.
   */
  private async notations(users: User[]): Promise<Map<number, { likes: number; dislikes: number }>> {
    if (!users.length) return new Map();
    const rows = await this.dataSource.query(
      `SELECT p.userId AS userId,
              COALESCE(SUM(ds.rating = 'liked'), 0)    AS likes,
              COALESCE(SUM(ds.rating = 'disliked'), 0) AS dislikes
         FROM domain_suggestion ds INNER JOIN project p ON p.id = ds.projectId
        WHERE p.userId IN (?) AND ds.rating <> 'neutral'
        GROUP BY p.userId`,
      [users.map((u) => u.id)],
    );
    return new Map(rows.map((r: any) => [Number(r.userId), { likes: Number(r.likes), dislikes: Number(r.dislikes) }]));
  }

  /** Dernier courriel remis à chaque compte. */
  private async derniersCourriels(users: User[]): Promise<Map<number, { at: Date; subject: string; replied: boolean }>> {
    if (!users.length) return new Map();
    const rows = await this.dataSource.query(
      `SELECT m.userId AS userId, m.createdAt AS at, m.subject AS subject, m.feedbackId IS NOT NULL AS replied
         FROM admin_mail m
         INNER JOIN (SELECT userId, MAX(id) AS id FROM admin_mail
                      WHERE delivered = 1 AND userId IN (?) GROUP BY userId) d ON d.id = m.id`,
      [users.map((u) => u.id)],
    );
    return new Map(rows.map((r: any) => [Number(r.userId), { at: r.at, subject: String(r.subject), replied: !!Number(r.replied) }]));
  }

  /** Les lignes du tableau des utilisateurs, compteurs compris, en requêtes groupées. */
  private async lignes(users: User[]): Promise<AdminUserRow[]> {
    const [reportCounts, projCounts, couts, consommes, notes, courriels] = await Promise.all([
      this.brandReportCounts(users.map((u) => u.keycloakId)),
      this.projectCounts(users.map((u) => u.id)),
      // Le coût vit dans une table récente, jointe à deux autres : son échec ne
      // doit pas vider la liste des comptes. Colonne vide, pas page blanche.
      this.modelCosts.coutsParCompte(users.map((u) => u.keycloakId)).catch((e) => {
        this.logger.error(`Coûts IA par compte non calculés : ${e}`, undefined, AdminService.name);
        return new Map();
      }),
      this.creditsConsommes(users),
      this.notations(users),
      // Table récente, comme les coûts : son absence ne vide pas la liste.
      this.derniersCourriels(users).catch((e) => {
        this.logger.error(`Derniers courriels non lus : ${e}`, undefined, AdminService.name);
        return new Map();
      }),
    ]);

    // `User`, pas `any` : typée `any`, cette ligne a laissé passer le 22/09/2026
    // une variable locale `credits` (un nombre) qui masquait la Map des crédits
    // consommés — `credits.get` a mis toute la liste en 500, sans erreur de
    // compilation.
    return users.map((u: User) => {
      const cout = couts.get(u.keycloakId);
      const enAttente = renouvellementDu(u.lastFreeReset);
      const credits = enAttente ? FREE_MONTHLY_QUOTA : u.credits;
      return {
        id: u.id,
        keycloakId: u.keycloakId,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        credits,
        extraCredits: u.extraCredits,
        totalCredits: credits + u.extraCredits,
        freeCreditsRenewalPending: enAttente,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        projectCount: projCounts.get(u.id) ?? 0,
        brandReportCount: reportCounts.get(u.keycloakId) ?? 0,
        isInternal: u.isInternal,
        aiCostUsd: cout ? cout.costUsd : null,
        aiUnpricedCalls: cout?.unpricedCalls ?? 0,
        creditsConsumed: consommes.get(u.id) ?? 0,
        likes: notes.get(u.id)?.likes ?? 0,
        dislikes: notes.get(u.id)?.dislikes ?? 0,
        lastMailAt: courriels.get(u.id)?.at ?? null,
        lastMailSubject: courriels.get(u.id)?.subject ?? null,
        lastMailReplied: courriels.get(u.id)?.replied ?? false,
      };
    });
  }


  async adjustCredits(userId: number, delta: number, reason: string, adminSub: string): Promise<AdminUserRow> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    // Appliquer le delta sur extraCredits (crédits permanents)
    user.extraCredits = Math.max(0, user.extraCredits + delta);
    await this.userRepo.save(user);

    // Enregistrer l'ajustement pour audit
    const adjustment = this.adjustmentRepo.create({ userId, delta, reason, adminSub });
    await this.adjustmentRepo.save(adjustment);

    return (await this.lignes([user]))[0];
  }

  /**
   * Marque un compte comme interne, ou le remet dans les statistiques.
   *
   * Aucun garde-fou sur l'identité de l'appelant : le geste est réversible d'un
   * clic et ne touche ni aux crédits, ni aux données du compte, ni à son accès
   * au produit. Il ne change QUE ce que le tableau de bord compte.
   */
  async setInternal(userId: number, internal: boolean): Promise<AdminUserRow> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    user.isInternal = internal;
    await this.userRepo.save(user);

    return (await this.lignes([user]))[0];
  }

  // ─── Repères de temps ──────────────────────────────────────────────────────

  /** Voir `jourISO`. */
  private static jourISO = jourISO;

  /**
   * Minuit le plus PROCHE, avant ou après.
   *
   * Le journal d'activité raisonne en jours civils, le sélecteur de période en
   * instants. Tronquer les deux bornes vers le bas ferait couvrir huit jours à
   * une fenêtre de sept ; arrondir chacune au minuit le plus proche en fait
   * exactement sept, quelle que soit l'heure à laquelle on regarde.
   */
  private static minuitProche(d: Date): Date {
    const j = new Date(d);
    j.setHours(0, 0, 0, 0);
    if (d.getTime() - j.getTime() >= 12 * 60 * 60 * 1000) j.setDate(j.getDate() + 1);
    return j;
  }

  /** Voir `lundiDe`. */
  private static lundiDe = lundiDe;

  /** Tolérance sur « la fenêtre se termine maintenant » : le temps d'un aller-retour. */
  private static readonly MAINTENANT_MS = 5 * 60 * 1000;

  /**
   * Premier jour couvert par le journal d'activité, ou `null` s'il est vide.
   *
   * Avant cette date, « comptes actifs » n'a pas de réponse — et l'absence de
   * réponse doit se voir. Cf. la migration du 23/08/2026.
   */
  private async debutDuJournal(): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT DATE_FORMAT(MIN(day), '%Y-%m-%d') AS d FROM user_activity_day`,
    );
    return rows[0]?.d ?? null;
  }

  /**
   * Premier jour enregistré dans le journal des visites, ou `null` s'il est vide.
   *
   * Même rôle que {@link debutDuJournal} pour les comptes actifs : avant cette
   * date, l'entonnoir n'a pas de dénominateur. Afficher « 0 visiteur » ferait
   * passer une absence de mesure pour une absence de trafic.
   */
  private async debutDesVisites(): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT DATE_FORMAT(MIN(firstSeenAt), '%Y-%m-%d') AS d FROM visitor_session`,
    );
    return rows[0]?.d ?? null;
  }

  // ─── Entonnoir ─────────────────────────────────────────────────────────────

  /**
   * Les visites retenues dans les statistiques.
   *
   * Une visite jamais authentifiée est COMPTÉE : c'est le cas normal d'un
   * visiteur, et c'est même toute la population qu'on cherche à mesurer. Sont
   * écartées les seules visites rattachées à un compte admin ou interne — le
   * même prédicat que partout ailleurs, appliqué au compte joint.
   *
   * `u.keycloakId IS NULL` couvre deux cas d'un coup : la visite anonyme, et
   * celle rattachée à un compte supprimé depuis. Tester `v.keycloakId` à la
   * place ferait disparaître la seconde des chiffres.
   */
  private static readonly VISITES_MESUREES =
    `(u.keycloakId IS NULL OR (${AdminService.comptesMesures()}))`;

  /**
   * Combien de visites, et jusqu'où elles sont allées, sur une fenêtre.
   *
   * Une visite est rattachée à la fenêtre par son PREMIER affichage. Une
   * session commencée la veille et poursuivie aujourd'hui appartient donc à
   * hier — sans quoi une même visite pourrait compter dans deux périodes, et le
   * total des visiteurs dépasserait le nombre de visites.
   */
  private async entonnoir(debut: Date, fin: Date): Promise<FunnelMetrics | null> {
    try {
      return await this.entonnoirBrut(debut, fin);
    } catch (e) {
      /*
       * Le SEUL agrégat qui a le droit d'échouer sans emporter la page.
       *
       * Tous les autres lisent des tables que ce service connaît depuis
       * toujours ; celui-ci joint `visitor_session` à `user`, et une jointure a
       * plus de façons de casser qu'un COUNT — c'est d'ailleurs une collation
       * divergente entre les deux tables qui a mis tout le tableau de bord à
       * 500 le 24/08/2026, pour une carte sur seize.
       *
       * `null`, et non zéro : l'interface dira « indisponible », pas
       * « personne n'est venu ».
       */
      this.logger.error(`Entonnoir non calculé : ${e}`, undefined, AdminService.name);
      return null;
    }
  }

  private async entonnoirBrut(debut: Date, fin: Date): Promise<FunnelMetrics> {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)                          AS visites,
              COALESCE(SUM(v.loggedInAtStart = 0), 0) AS anonymes,
              COALESCE(SUM(v.searched), 0)            AS recherches,
              COALESCE(SUM(v.accountCreated), 0)      AS comptes,
              COALESCE(SUM(v.reportRequested), 0)     AS rapports,
              COALESCE(SUM(v.pricingViewed), 0)       AS tarifs,
              COALESCE(SUM(v.checkoutStarted), 0)     AS paiements,
              COALESCE(SUM(u.keycloakId IS NOT NULL), 0)                     AS identifiees,
              COALESCE(SUM(u.keycloakId IS NOT NULL AND u.createdAt < ?), 0) AS revenants
         FROM visitor_session v
         LEFT JOIN user u ON u.keycloakId = v.keycloakId
        WHERE ${AdminService.VISITES_MESUREES}
          AND v.firstSeenAt >= ? AND v.firstSeenAt <= ?`,
      [debut, debut, fin],
    );
    const r = rows[0] ?? {};
    return {
      visits: Number(r.visites ?? 0),
      visitsAnonymous: Number(r.anonymes ?? 0),
      searched: Number(r.recherches ?? 0),
      accountsCreated: Number(r.comptes ?? 0),
      reportsRequested: Number(r.rapports ?? 0),
      visitsIdentified: Number(r.identifiees ?? 0),
      visitsReturning: Number(r.revenants ?? 0),
      pricingViewed: Number(r.tarifs ?? 0),
      checkoutStarted: Number(r.paiements ?? 0),
    };
  }

  /**
   * Visites par semaine, ou `null` si la requête échoue.
   *
   * Même raison que {@link entonnoir} : cette jointure est la plus récente du
   * service, et un échec doit hachurer UNE courbe, pas vider les cinq autres.
   */
  private async visitesParSemaine(depuis: string): Promise<any[] | null> {
    try {
      return await this.dataSource.query(
        `SELECT ${AdminService.SEMAINE('v.firstSeenAt')} AS semaine, COUNT(*) AS n,
                COALESCE(SUM(v.pricingViewed), 0) AS tarifs
           FROM visitor_session v
           LEFT JOIN user u ON u.keycloakId = v.keycloakId
          WHERE ${AdminService.VISITES_MESUREES} AND v.firstSeenAt >= ?
          GROUP BY semaine`,
        [depuis],
      );
    } catch (e) {
      this.logger.error(`Visites hebdomadaires non calculées : ${e}`, undefined, AdminService.name);
      return null;
    }
  }

  // ─── Comptes actifs ────────────────────────────────────────────────────────

  /**
   * Comptes distincts ayant utilisé le produit entre deux instants.
   *
   * Deux sources, et un `null` assumé quand aucune ne répond :
   *
   * 1. **Le journal d'activité** dès qu'il couvre toute la fenêtre. Une ligne
   *    par (compte, jour) : il répond juste pour n'importe quelle fenêtre, y
   *    compris passée. C'est la seule source qui permette de comparer une
   *    période à la précédente.
   * 2. **`user.lastLogin`** sinon, mais SEULEMENT si la fenêtre se termine
   *    maintenant. La colonne ne retient que le dernier passage : « actif dans
   *    la fenêtre » équivaut à « lastLogin dans la fenêtre » uniquement quand
   *    la borne haute est le présent. Sur une fenêtre passée, un compte revenu
   *    depuis a écrasé sa trace et manque à l'appel.
   * 3. Ni l'un ni l'autre → `null`. Renvoyer zéro ferait passer une absence de
   *    mesure pour une absence d'usage.
   */
  private async comptesActifs(debut: Date, fin: Date, debutJournal: string | null): Promise<number | null> {
    const premierJour = AdminService.minuitProche(debut);
    const dernierJour = new Date(AdminService.minuitProche(fin).getTime() - 24 * 60 * 60 * 1000);

    if (debutJournal && dernierJour >= premierJour && AdminService.jourISO(premierJour) >= debutJournal) {
      const rows = await this.dataSource.query(
        `SELECT COUNT(DISTINCT a.userId) AS n
           FROM user_activity_day a
           INNER JOIN user u ON u.id = a.userId
          WHERE ${AdminService.comptesMesures()} AND a.day >= ? AND a.day <= ?`,
        [AdminService.jourISO(premierJour), AdminService.jourISO(dernierJour)],
      );
      return Number(rows[0]?.n ?? 0);
    }

    if (Math.abs(Date.now() - fin.getTime()) <= AdminService.MAINTENANT_MS) {
      return this.userRepo.createQueryBuilder('u')
        .where('u.lastLogin >= :from AND u.lastLogin <= :to', { from: debut, to: fin })
        .andWhere(AdminService.comptesMesures())
        .getCount();
    }

    return null;
  }

  // ─── Indicateurs d'une fenêtre ─────────────────────────────────────────────

  /**
   * Les comptes admin servent à tester et à faire des démonstrations : leur
   * activité gonflerait chaque agrégat sans rien dire de l'usage réel. Ils sont
   * écartés de bout en bout — comptes, projets, suggestions, rapports, crédits.
   */
  private async metriquesPeriode(debut: Date, fin: Date, debutJournal: string | null): Promise<PeriodMetrics> {
    const [activeUsers, funnel, newProjects, brandReports, credits, activation] = await Promise.all([
      this.comptesActifs(debut, fin, debutJournal),

      this.entonnoir(debut, fin),

      this.projectRepo.createQueryBuilder('p')
        .innerJoin('p.user', 'u')
        .where('p.createdAt >= :from AND p.createdAt <= :to', { from: debut, to: fin })
        .andWhere(AdminService.comptesMesures())
        .getCount(),

      // Jointure sur le `sub` Keycloak : BrandReportRecord ne référence pas
      // `user.id`. L'`innerJoin` écarte au passage les rapports orphelins
      // (compte supprimé), qu'il serait trompeur de compter dans l'usage.
      this.brandReportRepo.createQueryBuilder('r')
        .innerJoin(User, 'u', 'u.keycloakId = r.keycloakId')
        .where('r.createdAt >= :from AND r.createdAt <= :to', { from: debut, to: fin })
        .andWhere(AdminService.comptesMesures())
        .getCount(),

      // Une suggestion coûte un crédit ; un rapport coûte ce qu'il a
      // RÉELLEMENT coûté (`costCredits`), pas le tarif du jour — un changement
      // de prix ne doit pas réécrire l'historique. Les rapports antérieurs à
      // cette colonne portent NULL : `SUM` les ignore, faute de savoir.
      //
      // `COALESCE(ds.createdAt, p.createdAt)` : les suggestions créées depuis
      // le 23/08/2026 ont leur propre date ; les plus anciennes retombent sur
      // celle du projet, avec le décalage que cela suppose.
      this.dataSource.query(
        `SELECT
           (SELECT COUNT(*)
              FROM domain_suggestion ds
              INNER JOIN project p ON p.id = ds.projectId
              INNER JOIN user u ON u.id = p.userId
             WHERE ${AdminService.comptesMesures()}
               AND COALESCE(ds.createdAt, p.createdAt) >= ?
               AND COALESCE(ds.createdAt, p.createdAt) <= ?) AS suggestions,
           (SELECT COALESCE(SUM(r.costCredits), 0)
              FROM brand_report_record r
              INNER JOIN user u ON u.keycloakId = r.keycloakId
             WHERE ${AdminService.comptesMesures()}
               AND r.createdAt >= ? AND r.createdAt <= ?) AS creditsRapports,
           (SELECT COALESCE(SUM(ds.rating = 'liked'), 0) AS likes
              FROM domain_suggestion ds
              INNER JOIN project p ON p.id = ds.projectId
              INNER JOIN user u ON u.id = p.userId
             WHERE ${AdminService.comptesMesures()} AND ds.rating <> 'neutral'
               AND COALESCE(ds.createdAt, p.createdAt) >= ?
               AND COALESCE(ds.createdAt, p.createdAt) <= ?) AS likes,
           (SELECT COALESCE(SUM(ds.rating = 'disliked'), 0)
              FROM domain_suggestion ds
              INNER JOIN project p ON p.id = ds.projectId
              INNER JOIN user u ON u.id = p.userId
             WHERE ${AdminService.comptesMesures()} AND ds.rating <> 'neutral'
               AND COALESCE(ds.createdAt, p.createdAt) >= ?
               AND COALESCE(ds.createdAt, p.createdAt) <= ?) AS dislikes,
           (SELECT COUNT(DISTINCT p.userId)
              FROM domain_suggestion ds
              INNER JOIN project p ON p.id = ds.projectId
              INNER JOIN user u ON u.id = p.userId
             WHERE ${AdminService.comptesMesures()} AND ds.rating <> 'neutral'
               AND COALESCE(ds.createdAt, p.createdAt) >= ?
               AND COALESCE(ds.createdAt, p.createdAt) <= ?) AS comptesNotant`,
        [debut, fin, debut, fin, debut, fin, debut, fin, debut, fin],
      ),

      // Taux d'activation : parmi les comptes créés dans la fenêtre, ceux qui
      // ont créé au moins un projet. « Projet » couvre les deux parcours — une
      // recherche aboutie en crée un, un nom soumis au test aussi. Mesuré à
      // aujourd'hui, pas à la fin de la fenêtre : la question est « ces gens
      // ont-ils fini par s'en servir », pas « dans les sept jours ».
      this.dataSource.query(
        `SELECT COUNT(*) AS inscrits,
                COALESCE(SUM(EXISTS (SELECT 1 FROM project p WHERE p.userId = u.id)), 0) AS actives
           FROM user u
          WHERE ${AdminService.comptesMesures()} AND u.createdAt >= ? AND u.createdAt <= ?`,
        [debut, fin],
      ),
    ]);

    const suggestions = Number(credits[0]?.suggestions ?? 0);
    const creditsRapports = Number(credits[0]?.creditsRapports ?? 0);
    const newUsers = Number(activation[0]?.inscrits ?? 0);
    const activatedUsers = Number(activation[0]?.actives ?? 0);

    return {
      from: debut.toISOString(),
      to: fin.toISOString(),
      activeUsers,
      newUsers,
      newProjects,
      suggestions,
      brandReports,
      creditsConsumed: suggestions + creditsRapports,
      activatedUsers,
      activationRate: newUsers > 0 ? Math.round((activatedUsers / newUsers) * 1000) / 10 : null,
      likes: Number(credits[0]?.likes ?? 0),
      dislikes: Number(credits[0]?.dislikes ?? 0),
      ratingAccounts: Number(credits[0]?.comptesNotant ?? 0),
      funnel,
    };
  }

  async getStats(from?: Date, to?: Date): Promise<AdminStats> {
    const periodEnd = to ?? new Date();
    const periodStart = from ?? new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Période de comparaison : même DURÉE, immédiatement avant. Comparer à
    // « le mois dernier » quand on regarde sept jours ne dirait rien.
    // Les bornes des agrégats sont INCLUSIVES des deux côtés (`>=` et `<=`) :
    // faire finir la période précédente sur `periodStart` compterait deux fois
    // ce qui tombe exactement à la charnière. Elle s'arrête une milliseconde
    // avant, et les deux fenêtres se touchent sans se chevaucher.
    const duree = periodEnd.getTime() - periodStart.getTime();
    const previousEnd = new Date(periodStart.getTime() - 1);
    const previousStart = new Date(periodStart.getTime() - duree);

    const [debutJournal, debutVisites] = await Promise.all([
      this.debutDuJournal(),
      this.debutDesVisites(),
    ]);

    const [period, previous] = await Promise.all([
      this.metriquesPeriode(periodStart, periodEnd, debutJournal),
      this.metriquesPeriode(previousStart, previousEnd, debutJournal),
    ]);

    const [totalUsers, totalProjects, totalSuggestions, totalBrandReports] = await Promise.all([
      this.userRepo.count({ where: { isAdmin: false, isInternal: false } }),
      this.projectRepo.createQueryBuilder('p')
        .innerJoin('p.user', 'u')
        .where(AdminService.comptesMesures())
        .getCount(),
      this.suggestionRepo.createQueryBuilder('ds')
        .innerJoin('ds.project', 'p')
        .innerJoin('p.user', 'u')
        .where(AdminService.comptesMesures())
        .getCount(),
      this.brandReportRepo.createQueryBuilder('r')
        .innerJoin(User, 'u', 'u.keycloakId = r.keycloakId')
        .where(AdminService.comptesMesures())
        .getCount(),
    ]);

    const avgSuggestionsResult = await this.dataSource.query(
      `SELECT AVG(cnt) as avg FROM (
         SELECT COUNT(*) as cnt FROM domain_suggestion ds
         INNER JOIN project p ON p.id = ds.projectId
         INNER JOIN user u ON u.id = p.userId
         WHERE ${AdminService.comptesMesures()}
         GROUP BY ds.projectId) sub`
    );
    const avgFavoritesResult = await this.dataSource.query(
      `SELECT AVG(cnt) as avg FROM (
         SELECT COUNT(*) as cnt FROM domain_suggestion ds
         INNER JOIN project p ON p.id = ds.projectId
         INNER JOIN user u ON u.id = p.userId
         WHERE ds.rating = 'liked' AND ${AdminService.comptesMesures()}
         GROUP BY ds.projectId) sub`
    );

    const creditsResult = await this.dataSource.query(
      // Solde disponible, pas solde en base : sans cela, les comptes absents
      // depuis le mois dernier tireraient le total vers le bas.
      `SELECT SUM(${creditsGratuitsSql()}) as free, SUM(u.extraCredits) as pack FROM user u WHERE ${AdminService.comptesMesures()}`
    );

    return {
      period,
      previous,
      totalUsers,
      totalProjects,
      totalSuggestions,
      totalBrandReports,
      avgSuggestionsPerProject: Math.round((avgSuggestionsResult[0]?.avg ?? 0) * 10) / 10,
      avgFavoritesPerProject: Math.round((avgFavoritesResult[0]?.avg ?? 0) * 10) / 10,
      totalFreeCredits: Number(creditsResult[0]?.free ?? 0),
      totalPackCredits: Number(creditsResult[0]?.pack ?? 0),
      activityTrackingSince: debutJournal,
      visitTrackingSince: debutVisites,
      pricingTrackingSince: TARIFS_MESURES_DEPUIS,
    };
  }

  // ─── Série hebdomadaire ────────────────────────────────────────────────────

  /** Semaine ISO en SQL. Voir `semaineSql`. */
  private static readonly SEMAINE = semaineSql;

  private static parSemaine(rows: any[]): Map<string, number> {
    return new Map(rows.map((r) => [String(r.semaine), Number(r.n)]));
  }

  /**
   * Historique hebdomadaire des indicateurs de flux.
   *
   * La semaine, pas le mois : à ce volume, six points mensuels ne dessinent
   * rien. Et pas le jour : le produit ne reçoit pas assez de monde pour qu'un
   * point quotidien porte autre chose que du bruit.
   *
   * Ne porte que des FLUX (ce qui s'est produit pendant la semaine). Les stocks
   * — solde de crédits, moyennes par projet — n'ont pas d'historique et n'en
   * auraient pas le sens.
   */
  async getSeries(weeks: number): Promise<AdminSeries> {
    const nb = Math.min(Math.max(Math.trunc(weeks) || 26, 2), 104);

    const lundiCourant = AdminService.lundiDe(new Date());
    const lundis: string[] = [];
    for (let k = nb - 1; k >= 0; k--) {
      const d = new Date(lundiCourant);
      d.setDate(d.getDate() - 7 * k);
      lundis.push(AdminService.jourISO(d));
    }
    const depuis = lundis[0];

    const [debutJournal, debutVisites, inscrits, projets, suggestions, creditsRapports, actifs, visites, notes] = await Promise.all([
      this.debutDuJournal(),
      this.debutDesVisites(),

      this.dataSource.query(
        `SELECT ${AdminService.SEMAINE('u.createdAt')} AS semaine, COUNT(*) AS n
           FROM user u
          WHERE ${AdminService.comptesMesures()} AND u.createdAt >= ?
          GROUP BY semaine`,
        [depuis],
      ),

      this.dataSource.query(
        `SELECT ${AdminService.SEMAINE('p.createdAt')} AS semaine, COUNT(*) AS n
           FROM project p
           INNER JOIN user u ON u.id = p.userId
          WHERE ${AdminService.comptesMesures()} AND p.createdAt >= ?
          GROUP BY semaine`,
        [depuis],
      ),

      this.dataSource.query(
        `SELECT ${AdminService.SEMAINE('COALESCE(ds.createdAt, p.createdAt)')} AS semaine, COUNT(*) AS n
           FROM domain_suggestion ds
           INNER JOIN project p ON p.id = ds.projectId
           INNER JOIN user u ON u.id = p.userId
          WHERE ${AdminService.comptesMesures()} AND COALESCE(ds.createdAt, p.createdAt) >= ?
          GROUP BY semaine`,
        [depuis],
      ),

      this.dataSource.query(
        `SELECT ${AdminService.SEMAINE('r.createdAt')} AS semaine, COALESCE(SUM(r.costCredits), 0) AS n
           FROM brand_report_record r
           INNER JOIN user u ON u.keycloakId = r.keycloakId
          WHERE ${AdminService.comptesMesures()} AND r.createdAt >= ?
          GROUP BY semaine`,
        [depuis],
      ),

      this.dataSource.query(
        `SELECT ${AdminService.SEMAINE('a.day')} AS semaine, COUNT(DISTINCT a.userId) AS n
           FROM user_activity_day a
           INNER JOIN user u ON u.id = a.userId
          WHERE ${AdminService.comptesMesures()} AND a.day >= ?
          GROUP BY semaine`,
        [depuis],
      ),

      this.visitesParSemaine(depuis),

      // Même date que les suggestions : la semaine où le nom a été produit.
      this.dataSource.query(
        `SELECT ${AdminService.SEMAINE('COALESCE(ds.createdAt, p.createdAt)')} AS semaine,
                COALESCE(SUM(ds.rating = 'liked'), 0)    AS likes,
                COALESCE(SUM(ds.rating = 'disliked'), 0) AS dislikes
           FROM domain_suggestion ds
           INNER JOIN project p ON p.id = ds.projectId
           INNER JOIN user u ON u.id = p.userId
          WHERE ${AdminService.comptesMesures()} AND ds.rating <> 'neutral'
            AND COALESCE(ds.createdAt, p.createdAt) >= ?
          GROUP BY semaine`,
        [depuis],
      ),
    ]);

    const mInscrits = AdminService.parSemaine(inscrits);
    const mProjets = AdminService.parSemaine(projets);
    const mSugg = AdminService.parSemaine(suggestions);
    const mRapports = AdminService.parSemaine(creditsRapports);
    const mActifs = AdminService.parSemaine(actifs);
    const mVisites = visites === null ? null : AdminService.parSemaine(visites);
    const mTarifs = visites === null ? null : new Map<string, number>(visites.map((r: any) => [String(r.semaine), Number(r.tarifs)]));
    const mNotes = new Map<string, { likes: number; dislikes: number }>(
      notes.map((r: any) => [String(r.semaine), { likes: Number(r.likes), dislikes: Number(r.dislikes) }]),
    );

    // Le journal ne couvre une semaine que si son premier jour la précède. Une
    // semaine à cheval sur son démarrage compterait les seuls jours mesurés et
    // se lirait comme un creux : elle reste « non mesurée ».
    const premiereSemaineMesuree = debutJournal
      ? AdminService.jourISO(AdminService.lundiDe(new Date(`${debutJournal}T00:00:00`)))
      : null;
    const journalCouvre = (lundi: string) =>
      premiereSemaineMesuree !== null && lundi > premiereSemaineMesuree;

    // Même règle pour les visites : une semaine à cheval sur le démarrage du
    // journal n'a que ses derniers jours mesurés et se lirait comme un creux.
    const premiereSemaineVisitee = debutVisites
      ? AdminService.jourISO(AdminService.lundiDe(new Date(`${debutVisites}T00:00:00`)))
      : null;
    const visitesCouvertes = (lundi: string) =>
      mVisites !== null && premiereSemaineVisitee !== null && lundi > premiereSemaineVisitee;

    const premiereSemaineTarifs = AdminService.jourISO(AdminService.lundiDe(new Date(`${TARIFS_MESURES_DEPUIS}T00:00:00`)));

    return {
      activityTrackingSince: debutJournal,
      visitTrackingSince: debutVisites,
      pricingTrackingSince: TARIFS_MESURES_DEPUIS,
      weeks: lundis.map((lundi) => ({
        week: lundi,
        newUsers: mInscrits.get(lundi) ?? 0,
        activeUsers: journalCouvre(lundi) ? (mActifs.get(lundi) ?? 0) : null,
        projects: mProjets.get(lundi) ?? 0,
        creditsConsumed: (mSugg.get(lundi) ?? 0) + (mRapports.get(lundi) ?? 0),
        visits: visitesCouvertes(lundi) ? (mVisites!.get(lundi) ?? 0) : null,
        likes: mNotes.get(lundi)?.likes ?? 0,
        dislikes: mNotes.get(lundi)?.dislikes ?? 0,
        // Avant TARIFS_MESURES_DEPUIS, les semaines vaudraient zéro sans l'être.
        pricingViewed: visitesCouvertes(lundi) && lundi > premiereSemaineTarifs ? (mTarifs!.get(lundi) ?? 0) : null,
      })),
    };
  }
}
