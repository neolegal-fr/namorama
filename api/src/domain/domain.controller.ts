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
    const cost = 1; // 1 crédit par recherche
    const success = await this.usersService.decrementCredits(user.sub, cost);
    
    if (!success) {
      throw new ForbiddenException('Crédits insuffisants');
    }

    const domains = await this.domainService.findAvailableDomains(dto.description, dto.keywords);
    return { domains };
  }
}
