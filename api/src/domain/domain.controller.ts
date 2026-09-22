import { Controller, Post, Body, Req, Res, BadRequestException, ForbiddenException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request, Response } from 'express';
import { DomainService } from './domain.service';
import { RefineDescriptionDto } from './dto/refine-description.dto';
import { SearchDomainsDto } from './dto/search-domains.dto';
import { RecheckDomainsDto } from './dto/recheck-domains.dto';
import { AnalyzeNamesDto } from './dto/analyze-names.dto';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import { Project } from '../projects/entities/project.entity';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { FunnelService, sessionIdDeLaRequete } from '../common/funnel/funnel.service';
import { imputer } from '../common/model-usage/contexte-appel';

@Controller('domain')
export class DomainController {
  private readonly logger = new Logger(DomainController.name);

  constructor(
    private readonly domainService: DomainService,
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly events: AppLoggerService,
    private readonly funnel: FunnelService,
  ) {}

  @Public()
  @Post('refine')
  async refine(@Body() dto: RefineDescriptionDto) {
    const refined = await this.domainService.refineDescription(dto.description);
    return { refined };
  }

  @Public()
  @Post('suggest-name')
  async suggestName(@Body() dto: RefineDescriptionDto) {
    const suggestedName = await this.domainService.suggestProjectName(dto.description);
    return { suggestedName };
  }

  @Public()
  @Post('keywords')
  async generateKeywords(@Body() dto: RefineDescriptionDto) {
    const keywords = await this.domainService.generateKeywords(dto.description, dto.locale);
    return { keywords };
  }

  /** #1 — contraintes de naming devinées depuis le brief, pour pré-remplir l'écran de configuration. */
  @Public()
  @Post('constraints')
  async constraints(@Body() dto: RefineDescriptionDto) {
    return this.domainService.extractNamingConstraints(dto.description);
  }

  /** #4 — produits existants du même secteur et leurs domaines, avant de lancer la recherche. */
  @Public()
  @Post('competitors')
  async competitors(@Body() dto: RefineDescriptionDto) {
    return this.domainService.findSimilarProductDomains(dto.description, dto.locale);
  }

  /**
   * Note un ou plusieurs noms.
   *
   * Un lot part en **un seul appel au modèle** : la consigne et le barème ne
   * dépendent pas du nom, les payer une fois par nom était le premier poste de
   * la facture OpenAI (64 % sur les 30 jours au 16/09/2026). Voir
   * `DomainService.analyzeNames`.
   *
   * La réponse porte les deux formes : `analyses` pour le lot, et `analysis`
   * quand un seul identifiant a été demandé — un onglet ouvert avant le
   * déploiement continue ainsi de fonctionner.
   */
  @Post('analyze')
  async analyze(
    @Body() dto: AnalyzeNamesDto,
    @AuthenticatedUser() keycloakUser: any,
  ) {
    const lang = dto.lang;
    const ids = [...new Set([...(dto.suggestionIds ?? []), ...(dto.suggestionId ? [dto.suggestionId] : [])])];
    // Un corps sans aucun identifiant descendait jusqu'à
    // `findOne({ where: { id: undefined } })`, que TypeORM refuse par une
    // exception — une saisie invalide ressortait en 500. Observé en production
    // le 26/08/2026 sur `/domain/analyze`.
    if (ids.length === 0) throw new BadRequestException('Identifiant de suggestion manquant');

    const user = await this.usersService.findOrCreate(keycloakUser.sub, { email: keycloakUser.email, firstName: keycloakUser.given_name, lastName: keycloakUser.family_name });

    // Les droits se contrôlent identifiant par identifiant, AVANT tout appel au
    // modèle : la liste vient du navigateur et peut porter n'importe quoi.
    const suggestions = await Promise.all(ids.map((id) => this.projectsService.getSuggestionForUser(id, user)));

    const analyses: Record<string, string> = {};
    /** Ceux qu'il faut vraiment calculer, par nom — le même nom deux fois ne coûte qu'une note. */
    const aCalculer = new Map<string, string[]>();

    suggestions.forEach((suggestion, i) => {
      if (!suggestion) return; // inconnu ou hors des droits : simplement absent de la réponse
      const cache = this.analyseEnCache(suggestion.analysis, lang);
      if (cache) { analyses[ids[i]] = cache; return; }
      const dejaPrevu = aCalculer.get(suggestion.domainName);
      if (dejaPrevu) dejaPrevu.push(ids[i]);
      else aCalculer.set(suggestion.domainName, [ids[i]]);
    });

    // Un seul identifiant demandé, introuvable : c'est une erreur, pas une
    // réponse vide. En lot, l'absence se lit dans ce qui manque — une carte
    // supprimée entre-temps ne doit pas faire échouer les dix-neuf autres.
    if (ids.length === 1 && !analyses[ids[0]] && aCalculer.size === 0) {
      throw new NotFoundException('Suggestion non trouvée');
    }

    if (aCalculer.size > 0) {
      const produites = await this.domainService.analyzeNames([...aCalculer.keys()], lang);
      await Promise.all(
        [...aCalculer].flatMap(([nom, idsDuNom]) => {
          const analyse = produites.get(nom);
          if (!analyse) return []; // le modèle a sauté ce nom : la carte garde son bouton
          idsDuNom.forEach((id) => { analyses[id] = analyse; });
          return idsDuNom.map((id) => this.projectsService.saveAnalysis(id, analyse));
        }),
      );
    }

    return { analyses, analysis: ids.length === 1 ? analyses[ids[0]] : undefined };
  }

  /**
   * L'analyse déjà en base, si elle est réutilisable.
   *
   * Réutilisable veut dire « dans la langue demandée » : une note rendue en
   * français ne sert pas un utilisateur passé à l'anglais. L'ancien format
   * texte n'a pas de langue, et n'est donc conservé que si aucune n'est
   * demandée.
   */
  private analyseEnCache(analysis: string | null | undefined, lang?: string): string | null {
    if (!analysis) return null;
    try {
      const cached = JSON.parse(analysis);
      return !lang || cached.lang === lang ? analysis : null;
    } catch {
      return lang ? null : analysis;
    }
  }

  @Post('pick-best')
  async pickBest(
    @Body() body: { suggestions: { name: string; analysis: string | null; extensions: Record<string, boolean | null> }[]; lang?: string },
    @AuthenticatedUser() _keycloakUser: any,
  ) {
    return this.domainService.pickBestDomain(body.suggestions, body.lang);
  }

  @Public()
  @Post('recheck')
  async recheck(@Body() dto: RecheckDomainsDto) {
    const domains = await this.domainService.recheckAvailability(dto.names, dto.extensions);
    return { domains };
  }


  /**
   * Le compte sur lequel la recherche est facturée.
   *
   * Sur un projet PARTAGÉ en écriture, c'est son propriétaire : décision
   * produit — le projet reste le sien, c'est sa réserve qui finance ce qu'on y
   * lance. Le collaborateur agit, le propriétaire paie, et les suggestions
   * rejoignent le projet de ce dernier.
   *
   * Partout ailleurs, le demandeur paie pour lui-même et rien ne change.
   */
  private async payeurDuProjet(projectId: string | undefined, demandeur: any) {
    if (!projectId) return demandeur;
    const acces = await this.projectsService.accessFor(projectId, demandeur);
    if (!acces) throw new NotFoundException('Projet non trouvé');
    if (acces.role === 'read') throw new ForbiddenException('Ce projet vous est partagé en lecture seule');
    return acces.owner ?? demandeur;
  }

  @Post('search/stream')
  async searchStream(
    @Body() dto: SearchDomainsDto,
    @AuthenticatedUser() keycloakUser: any,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    // Marqué AVANT le contrôle de crédits : l'entonnoir mesure des intentions,
    // et quelqu'un qui lance une recherche sans pouvoir la payer a bien
    // franchi cette étape-là. La confondre avec un abandon masquerait
    // précisément le blocage qu'on cherche à voir.
    await this.funnel.marquer(sessionIdDeLaRequete(req), 'recherche', keycloakUser.sub);

    const demandeur = await this.usersService.findOrCreate(keycloakUser.sub, { email: keycloakUser.email, firstName: keycloakUser.given_name, lastName: keycloakUser.family_name });
    let user: typeof demandeur;
    try {
      user = await this.payeurDuProjet(dto.projectId, demandeur);
    } catch (e: any) {
      res.status(e?.getStatus?.() ?? 403).json({ message: e?.message ?? 'Accès refusé' });
      return;
    }
    // Les appels au modèle de cette recherche sont ceux que ses crédits paient.
    imputer(user.keycloakId, dto.projectId);

    if (user.totalCredits <= 0) {
      this.events.event('search_blocked_no_credits', { userId: keycloakUser.sub, payeur: user.keycloakId });
      res.status(403).json({ message: 'Crédits insuffisants' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (data: Record<string, any>) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const limit = Math.min(10, user.totalCredits);
    const results: any[] = [];
    const startedAt = Date.now();

    this.events.event('search_started', {
      userId: keycloakUser.sub,
      extensions: (dto.extensions ?? ['.com']).join(','),
      matchMode: dto.matchMode,
      minLength: dto.minLength,
      keywords: dto.keywords.length,
      hasCompetitors: (dto.competitorDomains ?? []).length > 0,
      hasStyleRefs: (dto.likedExamples ?? []).length > 0,
      isAppend: (dto.excludeNames ?? []).length > 0,
    });

    try {
      const { totalChecked, minLengthUsed, unresolved, sources } = await this.domainService.findAvailableDomains(
        dto.description,
        dto.keywords,
        {
          targetCount: limit,
          extensions: dto.extensions,
          matchMode: dto.matchMode,
          locale: dto.locale,
          excludeNames: dto.excludeNames ?? [],
          onEvent: (event) => {
            emit(event);
            if (event.type === 'result') results.push(event.domain);
          },
          descriptiveNames: dto.descriptiveNames ?? false,
          culturalNames: dto.culturalNames ?? false,
          likedNames: dto.likedNames ?? [],
          dislikedNames: dto.dislikedNames ?? [],
          minLength: dto.minLength,
          likedExamples: dto.likedExamples ?? [],
          competitorDomains: dto.competitorDomains ?? [],
          dislikedStyleDomains: dto.dislikedStyleDomains ?? [],
        },
      );

      const actualCost = results.length;
      let project: Project;
      let savedDomains: { name: string; id: string }[] = [];
      let remainingCredits = user.totalCredits - actualCost;

      try {
        await this.dataSource.transaction(async (manager) => {
          project = await this.projectsService.createOrUpdate(
            user,
            {
              id: dto.projectId,
              name: dto.projectName,
              description: dto.description,
              keywords: dto.keywords,
              extensions: dto.extensions || ['.com'],
              matchMode: dto.matchMode || 'any',
              minLength: dto.minLength,
              likedExamples: dto.likedExamples,
              dislikedExamples: dto.dislikedStyleDomains,
            },
            manager,
          );

          if (actualCost > 0) {
            const newTotal = await this.usersService.decrementCredits(user.keycloakId, actualCost, manager);
            remainingCredits = newTotal;
            const saved = await this.projectsService.addSuggestions(project, results, manager);
            savedDomains = saved.map(s => ({ name: s.domainName, id: s.id }));
          }
        });

        this.events.event('search_completed', {
          userId: keycloakUser.sub,
          found: results.length,
          requested: limit,
          totalChecked,
          minLengthUsed,
          durationMs: Date.now() - startedAt,
          // Le cas qui mérite le plus d'attention : l'utilisateur a attendu
          // pour rien, et c'est le premier motif d'abandon attendu.
          emptyResult: results.length === 0,
          // Vérifications non concluantes par extension. Un résultat vide
          // accompagné d'un compteur élevé désigne une panne de WHOIS, pas
          // un marché saturé — c'est toute la différence.
          unresolved,
          // Part des verdicts rendus par la délégation DNS, sans interroger le
          // registre. C'est la mesure du pré-filtre : s'il tombe à zéro sur une
          // extension, c'est que le registre a changé de comportement.
          viaDns: sources.dns,
          viaRegistre: sources.registre,
        });

        emit({
          type: 'done',
          totalChecked,
          minLengthUsed,
          requested: limit,
          found: results.length,
          projectId: project!.id,
          savedDomains,
          remainingCredits,
        });
      } catch (error) {
        this.logger.error('Échec de la transaction streaming:', error);
        emit({ type: 'error', message: 'Impossible de sauvegarder les résultats' });
      }
    } catch (error) {
      this.logger.error('Erreur pendant le streaming:', error);
      this.events.event('search_failed', {
        userId: keycloakUser.sub,
        durationMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : String(error),
      });
      emit({ type: 'error', message: 'Erreur lors de la recherche' });
    }

    res.end();
  }

  @Post('search')
  async search(@Body() dto: SearchDomainsDto, @AuthenticatedUser() keycloakUser: any, @Req() req: Request) {
    await this.funnel.marquer(sessionIdDeLaRequete(req), 'recherche', keycloakUser.sub);
    const demandeur = await this.usersService.findOrCreate(keycloakUser.sub, { email: keycloakUser.email, firstName: keycloakUser.given_name, lastName: keycloakUser.family_name });
    const user = await this.payeurDuProjet(dto.projectId, demandeur);
    imputer(user.keycloakId, dto.projectId);

    if (user.totalCredits <= 0) {
      throw new ForbiddenException('Crédits insuffisants');
    }

    const limit = Math.min(10, user.totalCredits);

    // Opérations externes (IA + Whois) hors transaction pour ne pas bloquer la DB
    const { results, totalChecked, minLengthUsed } = await this.domainService.findAvailableDomains(
      dto.description,
      dto.keywords,
      {
        targetCount: limit,
        extensions: dto.extensions,
        matchMode: dto.matchMode,
        locale: dto.locale,
        excludeNames: dto.excludeNames ?? [],
        descriptiveNames: dto.descriptiveNames ?? false,
        culturalNames: dto.culturalNames ?? false,
        likedNames: dto.likedNames ?? [],
        dislikedNames: dto.dislikedNames ?? [],
        minLength: dto.minLength,
        likedExamples: dto.likedExamples ?? [],
        competitorDomains: dto.competitorDomains ?? [],
        dislikedStyleDomains: dto.dislikedStyleDomains ?? [],
      },
    );

    const actualCost = results.length;

    // Toutes les écritures DB dans une transaction atomique
    let project: Project;
    let newTotal = user.totalCredits - actualCost;
    try {
      await this.dataSource.transaction(async (manager) => {
        project = await this.projectsService.createOrUpdate(
          user,
          {
            id: dto.projectId,
            name: dto.projectName,
            description: dto.description,
            keywords: dto.keywords,
            extensions: dto.extensions || ['.com'],
            matchMode: dto.matchMode || 'any',
            minLength: dto.minLength,
            likedExamples: dto.likedExamples,
            dislikedExamples: dto.dislikedStyleDomains,
          },
          manager,
        );

        if (actualCost > 0) {
          newTotal = await this.usersService.decrementCredits(user.keycloakId, actualCost, manager);
          await this.projectsService.addSuggestions(project, results, manager);
        }
      });
    } catch (error) {
      this.logger.error('Échec de la transaction de sauvegarde du projet:', error);
      throw new InternalServerErrorException('Impossible de sauvegarder les résultats');
    }

    return {
      domains: results,
      totalChecked,
      minLengthUsed,
      projectId: project!.id,
      creditsDebited: actualCost,
      remainingCredits: newTotal,
    };
  }
}
