import { Controller, Post, Get, Param, Body, Query, Req, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { ProjectsService } from '../projects/projects.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import { BrandReportService, BRAND_REPORT_COST } from './brand-report.service';

/**
 * Fréquence minimale entre deux rafraîchissements d'un même rapport.
 *
 * Le rafraîchissement est gratuit et illimité dans le temps : la garde est
 * technique, pas tarifaire. 6 h suffisent — les registres ne bougent pas plus
 * vite, et cela empêche une boucle d'appeler l'INPI et l'EUIPO sans fin.
 */
const REFRESH_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
import { BrandReportStore } from './brand-report.store';
import { ReportMailService } from './report-mail.service';
import { BrandReportRequestDto } from './dto/brand-report.dto';
import { UsersService } from '../users/users.service';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { FunnelService, sessionIdDeLaRequete } from '../common/funnel/funnel.service';
import { imputer } from '../common/model-usage/contexte-appel';

@Controller('brand-report')
export class BrandReportController {
  private readonly logger = new Logger(BrandReportController.name);

  constructor(
    private readonly brandReport: BrandReportService,
    private readonly store: BrandReportStore,
    private readonly reportMail: ReportMailService,
    private readonly usersService: UsersService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly events: AppLoggerService,
    private readonly funnel: FunnelService,
      private readonly projectsService: ProjectsService,
  ) {}

  /**
   * Aperçu public bridé (US-055) : domaine phare + quelques réseaux, sans marque.
   * Sert de démonstration sur la landing avant l'achat du rapport complet.
   */
  @Public()
  @Post('preview')
  async preview(@Body() dto: BrandReportRequestDto) {
    return this.brandReport.generate(dto.name, { preview: true });
  }

  /** Rapport partagé en lecture seule (public, via jeton). */
  @Public()
  @Get('shared/:token')
  async shared(@Param('token') token: string) {
    const report = await this.store.findByToken(token);
    if (!report) throw new NotFoundException('Rapport introuvable');
    return report;
  }


  /**
   * Le compte SOUS LEQUEL les rapports d'un projet sont rangés.
   *
   * Un rapport payé par le propriétaire d'un projet partagé doit être lisible
   * par ses invités — c'est ce que « consulter le projet » promet. Le
   * rapprochement passe par le projet, jamais par le nom seul : sans lui, il
   * suffirait de deviner un nom pour lire le rapport d'un inconnu.
   *
   * Sans projet, ou sans droit dessus, on retombe sur le demandeur lui-même.
   */
  private async subDesRapports(projectId: string | undefined, sub: string): Promise<string> {
    if (!projectId) return sub;
    try {
      const demandeur = await this.usersService.findOrCreate(sub);
      const acces = await this.projectsService.accessFor(projectId, demandeur);
      return acces?.owner?.keycloakId ?? sub;
    } catch {
      return sub;
    }
  }

  /** Noms pour lesquels ce compte a déjà un rapport (le front affiche « Voir le rapport »). */
  @Get('mine')
  async mine(@AuthenticatedUser() keycloakUser: { sub: string; email?: string; given_name?: string; family_name?: string }, @Query('projectId') projectId?: string) {
    return { names: await this.store.listNames(await this.subDesRapports(projectId, keycloakUser.sub)) };
  }

  /**
   * Synthèses des noms vérifiés par ce compte, pour afficher les verdicts
   * directement sur les cartes de résultats — c'est ce qui rend plusieurs noms
   * comparables côte à côte sans ouvrir un rapport à la fois.
   *
   * Uniquement des données acquises : un nom sans rapport n'a pas de synthèse.
   */
  @Get('summaries')
  async summaries(@AuthenticatedUser() keycloakUser: { sub: string; email?: string; given_name?: string; family_name?: string }, @Query('projectId') projectId?: string) {
    return { summaries: await this.store.listSummaries(await this.subDesRapports(projectId, keycloakUser.sub)) };
  }

  /**
   * Rapport déjà généré pour ce (compte, nom) — permet au front de proposer un
   * lien « voir le rapport » plutôt que de refacturer {@link BRAND_REPORT_COST} crédits.
   */
  @Get('existing')
  async existing(
    @Query('name') name: string,
    @AuthenticatedUser() keycloakUser: { sub: string; email?: string; given_name?: string; family_name?: string },
    @Query('projectId') projectId?: string,
  ) {
    const report = name ? await this.store.find(await this.subDesRapports(projectId, keycloakUser.sub), name) : null;
    return report ? { exists: true, report } : { exists: false };
  }

  /**
   * Ce qu'il faut pour afficher le bon libellé avant achat, SANS que le front
   * devine : acheté ou non, prix, droit gratuit disponible, solde.
   *
   * Ne renvoie JAMAIS de verdict. Avant achat, la réponse se limite au prix et
   * à l'état du droit ; le rapport lui-même n'atteint le navigateur que via
   * `POST /brand-report`, après débit ou consommation du droit. Un simple
   * compteur « 3 contrôles favorables » suffirait à déduire l'essentiel : il
   * n'est pas exposé non plus.
   */
  /**
   * Renvoie par email un rapport DÉJÀ acquis.
   *
   * Aucun débit : le rapport existe, on ne fait que le retransmettre. Rien
   * n'est généré ici — si le nom n'a pas de rapport pour ce compte, on répond
   * 404 plutôt que de produire un document au passage.
   */
  @Post('send')
  async send(
    @Body() dto: { name?: string; emails?: string[] },
    @AuthenticatedUser() keycloakUser: { sub: string; email?: string; given_name?: string; family_name?: string },
  ) {
    const report = dto.name ? await this.store.find(keycloakUser.sub, dto.name) : null;
    if (!report) throw new NotFoundException('Aucun rapport pour ce nom');

    const recipients = dto.emails?.length ? dto.emails : keycloakUser.email;
    const sent = await this.reportMail.sendReport(recipients, report);
    this.events.event('brand_report_reshared', { sub: keycloakUser.sub, sent });
    return { sent };
  }

  @Get('offer')
  async offer(
    @Query('name') name: string,
    @AuthenticatedUser() keycloakUser: { sub: string; email?: string; given_name?: string; family_name?: string },
    @Query('projectId') projectId?: string,
  ) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub, { email: keycloakUser.email, firstName: keycloakUser.given_name, lastName: keycloakUser.family_name });
    const purchased = name ? !!(await this.store.find(await this.subDesRapports(projectId, keycloakUser.sub), name)) : false;
    return {
      deepReport: {
        purchased,
        priceCredits: BRAND_REPORT_COST,
      },
      account: { credits: user.totalCredits },
    };
  }

  /**
   * Rapport complet (authentifié), facturé {@link BRAND_REPORT_COST} crédits —
   * ou OFFERT s'il s'agit du premier rapport du mois calendaire.
   *
   * Idempotent : si un rapport existe déjà pour ce (compte, nom), il est renvoyé
   * SANS débit (`cached: true`). Sinon, la génération (I/O externe) se fait AVANT
   * le débit — un échec ne consomme aucun crédit — et le débit est atomique.
   */
  @Post()
  async full(
    @Body() dto: BrandReportRequestDto,
    @AuthenticatedUser() keycloakUser: { sub: string; email?: string; given_name?: string; family_name?: string },
    @Req() req: Request,
  ) {
    // Même règle que l'événement ci-dessous : c'est la DEMANDE qui est comptée
    // dans l'entonnoir, avant qu'on sache si elle aboutira.
    await this.funnel.marquer(sessionIdDeLaRequete(req), 'rapport', keycloakUser.sub);

    // Émis AVANT tout traitement : c'est la demande qui est comptée, pas son
    // issue. Sans cet événement, un rapport bloqué ou en échec n'apparaît nulle
    // part, et le total par utilisateur sous-estime l'usage réel.
    // Le nom demandé n'est pas journalisé (donnée saisie par l'utilisateur) :
    // seul le `sub` permet d'agréger par compte.
    this.events.event('brand_report_requested', {
      sub: keycloakUser.sub,
      cost: BRAND_REPORT_COST,
      forced: !!dto.force,
    });

    const demandeur = await this.usersService.findOrCreate(keycloakUser.sub, { email: keycloakUser.email, firstName: keycloakUser.given_name, lastName: keycloakUser.family_name });

    /*
     * Qui paie, et sous quel compte le rapport est rangé.
     *
     * Sur un projet PARTAGÉ en écriture, les deux sont le propriétaire du
     * projet : c'est sa réserve qui finance, et c'est chez lui que le rapport
     * doit apparaître — il l'a payé. Le collaborateur le voit par le projet.
     *
     * Sans projet, ou sur son propre projet, rien ne change : le demandeur est
     * le payeur.
     */
    let user = demandeur;
    let payeurSub = keycloakUser.sub;
    if (dto.projectId) {
      const acces = await this.projectsService.accessFor(dto.projectId, demandeur);
      if (!acces) throw new NotFoundException('Projet non trouvé');
      if (acces.role === 'read') throw new ForbiddenException('Ce projet vous est partagé en lecture seule');
      if (acces.owner && acces.owner.keycloakId !== keycloakUser.sub) {
        user = acces.owner;
        payeurSub = acces.owner.keycloakId;
      }
    }
    // Même compte que les crédits : c'est lui que le rapport a coûté.
    imputer(payeurSub, dto.projectId);

    // Déjà généré → on le renvoie tel quel, sans refacturer (sauf régénération forcée).
    // Protégé : un souci de cache ne doit jamais faire échouer la génération.
    // Rafraîchissement : gratuit et sans limite de temps (décision produit).
    // Les registres évoluent et une marque peut se déposer à tout moment ;
    // facturer la mise à jour transformerait le rapport en photo périmée que
    // personne ne rouvre. La garde est technique — une fréquence minimale —
    // et non tarifaire.
    let isRefresh = false;
    if (dto.force) {
      const existing = await this.store.find(payeurSub, dto.name).catch(() => null);
      if (existing) {
        isRefresh = true;
        const last = Date.parse(String(existing.generatedAt ?? ''));
        if (Number.isFinite(last) && Date.now() - last < REFRESH_MIN_INTERVAL_MS) {
          this.events.event('brand_report_refresh_throttled', { sub: keycloakUser.sub });
          // On rend le rapport en cache plutôt qu'une erreur : l'utilisateur a
          // demandé « à jour », il obtient ce qui l'est déjà.
          return { ...existing, remainingCredits: user.totalCredits, emailed: false, cached: true };
        }
      }
    }

    let cached: Awaited<ReturnType<typeof this.store.find>> = null;
    if (!dto.force) {
      cached = await this.store.find(payeurSub, dto.name).catch((e) => {
        this.logger.error('Lecture du cache de rapport échouée', e);
        return null;
      });
    }
    if (cached) {
      this.events.event('brand_report_cache_hit', { sub: keycloakUser.sub });
      return { ...cached, remainingCredits: user.totalCredits, emailed: false, cached: true };
    }

    // Une règle, une seule : un rapport coûte son tarif. Le rapport offert
    // mensuel a été retiré — il demandait une comptabilité parallèle (période
    // de référence, horodatage, verrou pessimiste, coût réel mémorisé) pour
    // une gratuité que les 100 crédits mensuels couvrent déjà : 50 suggestions
    // et un rapport, sans mécanique supplémentaire à expliquer ni à déboguer.
    if (!isRefresh && user.totalCredits < BRAND_REPORT_COST) {
      this.events.event('brand_report_blocked_no_credits', { sub: keycloakUser.sub, cost: BRAND_REPORT_COST });
      throw new ForbiddenException('Crédits insuffisants');
    }

    // La génération précède le débit : un échec ne consomme aucun crédit. On le
    // trace tout de même, sinon l'écart entre demandes et rapports produits
    // reste inexpliqué dans les tableaux de bord.
    let report: Awaited<ReturnType<typeof this.brandReport.generate>>;
    try {
      report = await this.brandReport.generate(dto.name, {
        extensions: dto.extensions,
        withQuality: true,
        context: dto.context,
      });
    } catch (e) {
      this.events.event('brand_report_failed', {
        sub: keycloakUser.sub,
        reason: String((e as Error)?.message ?? e).slice(0, 120),
      });
      throw e;
    }

    // Débit du tarif plein, sauf rafraîchissement — déjà payé une fois.
    let remainingCredits = user.totalCredits;
    let costCharged = isRefresh ? 0 : BRAND_REPORT_COST;
    if (!isRefresh) {
      await this.dataSource.transaction(async (manager) => {
        const newTotal = await this.usersService.decrementCredits(payeurSub, BRAND_REPORT_COST, manager);
        // -1 = crédits devenus insuffisants entre-temps : on annule (rollback).
        if (newTotal < 0) throw new ForbiddenException('Crédits insuffisants');
        remainingCredits = newTotal;
      });
    }

    // Mémoriser, avec le coût RÉELLEMENT débité, pour éviter tout re-débit
    // ultérieur et garder un historique juste même si le tarif change.
    // `undefined` sur un rafraîchissement : le coût d'origine reste en base,
    // sinon un rapport payé 50 crédits serait réécrit à 0 à la première mise
    // à jour, et les totaux par compte deviendraient faux.
    await this.store.save(payeurSub, dto.name, report, isRefresh ? undefined : costCharged).catch((e) =>
      this.logger.error('Échec de la mémorisation du rapport', e),
    );

    // `cost` porte le débit réel (0 si offert) : les totaux par compte dans
    // `analyze-logs.py rapports` restent justes, et `free` permet de compter
    // les rapports offerts séparément.
    this.events.event('brand_report_generated', {
      sub: keycloakUser.sub,
      cost: costCharged,
      free: costCharged === 0,
      refresh: isRefresh,
      score: report.score,
    });

    // Destinataires : la liste fournie, sinon l'email du compte.
    // Envoi en tâche de fond : ne bloque jamais la réponse (best-effort, borné
    // par les timeouts SMTP). Le rapport s'affiche immédiatement.
    const recipients = dto.emails?.length ? dto.emails : keycloakUser.email;
    void this.reportMail.sendReport(recipients, report).catch((e) =>
      this.logger.error('Envoi email du rapport échoué', e),
    );
    const willEmail = Array.isArray(recipients) ? recipients.length > 0 : !!recipients;
    return { ...report, remainingCredits, emailed: willEmail, cached: false, costCredits: costCharged };
  }
}
