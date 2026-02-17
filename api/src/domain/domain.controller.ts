import { Controller, Post, Body, ForbiddenException } from '@nestjs/common';
import { DomainService } from './domain.service';
import { RefineDescriptionDto } from './dto/refine-description.dto';
import { SearchDomainsDto } from './dto/search-domains.dto';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';

@Controller('domain')
export class DomainController {
  constructor(
    private readonly domainService: DomainService,
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService
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
    const keywords = await this.domainService.generateKeywords(dto.description);
    return { keywords };
  }

  @Post('search')
  async search(@Body() dto: SearchDomainsDto, @AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    const currentCredits = user.credits;
    
    if (currentCredits <= 0) {
      throw new ForbiddenException('Crédits insuffisants');
    }

    const limit = Math.min(10, currentCredits);

    const result = await this.domainService.findAvailableDomains(
      dto.description, 
      dto.keywords, 
      limit,
      dto.extensions,
      dto.matchMode
    );
    const { results, totalChecked } = result;
    
        const actualCost = results.length;
    
        
    
        // Sauvegarder ou mettre à jour le projet systématiquement
    
        const project = await this.projectsService.createOrUpdate(user, {
    
          id: dto.projectId,
    
          name: dto.projectName,
    
          description: dto.description,
    
          keywords: dto.keywords,
    
          extensions: dto.extensions || ['.com'],
    
          matchMode: dto.matchMode || 'any'
    
        });
    
    
    
        if (actualCost > 0) {
    
          await this.usersService.decrementCredits(user.keycloakId, actualCost);
    
          await this.projectsService.addSuggestions(project, results);
    
        }
    
    
    
        return { 
    
          domains: results,
    
          totalChecked,
    
          projectId: project.id,
    
          creditsDebited: actualCost,
    
          remainingCredits: user.credits - actualCost
    
        };
    
      }
    
    }
    
    