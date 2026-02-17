import { Controller, Post, Body, ForbiddenException } from '@nestjs/common';
import { DomainService } from './domain.service';
import { RefineDescriptionDto } from './dto/refine-description.dto';
import { SearchDomainsDto } from './dto/search-domains.dto';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import { UsersService } from '../users/users.service';

@Controller('domain')
export class DomainController {
  constructor(
    private readonly domainService: DomainService,
    private readonly usersService: UsersService
  ) {}

  @Public()
  @Post('refine')
  async refine(@Body() dto: RefineDescriptionDto) {
    const refined = await this.domainService.refineDescription(dto.description);
    return { refined };
  }

  @Public()
  @Post('keywords')
  async generateKeywords(@Body() dto: RefineDescriptionDto) {
    const keywords = await this.domainService.generateKeywords(dto.description);
    return { keywords };
  }

  @Post('search')
  async search(@Body() dto: SearchDomainsDto, @AuthenticatedUser() user: any) {
    // 1. Vérifier le solde actuel
    const currentCredits = await this.usersService.getCredits(user.sub);
    
    if (currentCredits <= 0) {
      throw new ForbiddenException('Crédits insuffisants');
    }

    // 2. Limiter la recherche à ce que l'utilisateur peut s'offrir (max 10 par requête)
    const limit = Math.min(10, currentCredits);

    // 3. Trouver les domaines avec support multi-extensions
    const result = await this.domainService.findAvailableDomains(
      dto.description, 
      dto.keywords, 
      limit,
      dto.extensions,
      dto.matchMode
    );
    const { results, totalChecked } = result;
    
    // 4. Débiter le montant réel
    const actualCost = results.length;
    if (actualCost > 0) {
      await this.usersService.decrementCredits(user.sub, actualCost);
    }

    return { 
      domains: results, // Maintenant une liste d'objets avec détail des extensions
      totalChecked,
      creditsDebited: actualCost,
      remainingCredits: currentCredits - actualCost
    };
  }
}
