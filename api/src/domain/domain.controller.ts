import { Controller, Post, Body, Res, ForbiddenException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Response } from 'express';
import { DomainService } from './domain.service';
import { RefineDescriptionDto } from './dto/refine-description.dto';
import { SearchDomainsDto } from './dto/search-domains.dto';
import { RecheckDomainsDto } from './dto/recheck-domains.dto';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import { Project } from '../projects/entities/project.entity';

@Controller('domain')
export class DomainController {
  private readonly logger = new Logger(DomainController.name);

  constructor(
    private readonly domainService: DomainService,
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService,
    @InjectDataSource() private readonly dataSource: DataSource,
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

  @Public()
  @Post('recheck')
  async recheck(@Body() dto: RecheckDomainsDto) {
    const domains = await this.domainService.recheckAvailability(dto.names, dto.extensions);
    return { domains };
  }

  @Post('search/stream')
  async searchStream(
    @Body() dto: SearchDomainsDto,
    @AuthenticatedUser() keycloakUser: any,
    @Res() res: Response,
  ) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);

    if (user.totalCredits <= 0) {
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

    try {
      const { totalChecked } = await this.domainService.findAvailableDomains(
        dto.description,
        dto.keywords,
        limit,
        dto.extensions,
        dto.matchMode,
        dto.locale,
        dto.excludeNames ?? [],
        (event) => {
          emit(event);
          if (event.type === 'result') results.push(event.domain);
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

        emit({
          type: 'done',
          totalChecked,
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
      emit({ type: 'error', message: 'Erreur lors de la recherche' });
    }

    res.end();
  }

  @Post('search')
  async search(@Body() dto: SearchDomainsDto, @AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);

    if (user.totalCredits <= 0) {
      throw new ForbiddenException('Crédits insuffisants');
    }

    const limit = Math.min(10, user.totalCredits);

    // Opérations externes (IA + Whois) hors transaction pour ne pas bloquer la DB
    const { results, totalChecked } = await this.domainService.findAvailableDomains(
      dto.description,
      dto.keywords,
      limit,
      dto.extensions,
      dto.matchMode,
      dto.locale,
      dto.excludeNames ?? [],
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
      projectId: project!.id,
      creditsDebited: actualCost,
      remainingCredits: newTotal,
    };
  }
}
