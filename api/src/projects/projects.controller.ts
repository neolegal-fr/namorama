import { Controller, Get, Param, Patch, Delete, Post, Logger, Body, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { UsersService } from '../users/users.service';

@Controller('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService
  ) {}

  @Get()
  async findAll(@AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    return this.projectsService.findAllByUser(user);
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    return this.projectsService.findOne(id, user);
  }

  @Patch(':id')
  async update(@Param('id', new ParseUUIDPipe()) id: string, @AuthenticatedUser() keycloakUser: any, @Body() data: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    return this.projectsService.update(id, user, data);
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    return this.projectsService.remove(id, user);
  }

  @Post(':id/suggestions')
  async addSuggestion(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AuthenticatedUser() keycloakUser: any,
    @Body() body: { domainName: string; availability: Record<string, boolean> },
  ) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    return this.projectsService.addManualSuggestion(id, user, body.domainName, body.availability);
  }

  @Patch('suggestions/availability')
  async updateAvailability(
    @AuthenticatedUser() keycloakUser: any,
    @Body() body: { updates: { id: string; availability: Record<string, boolean> }[] },
  ) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    await this.projectsService.updateSuggestionsAvailability(body.updates, user);
    return { ok: true };
  }

  @Patch('suggestions/:id/rating')
  async setRating(
    @Param('id', new ParseUUIDPipe()) id: string,
    @AuthenticatedUser() keycloakUser: any,
    @Body('rating') rating: string,
  ) {
    if (!['liked', 'disliked', 'neutral'].includes(rating)) {
      throw new BadRequestException('rating must be liked, disliked or neutral');
    }
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    const result = await this.projectsService.setRating(id, user, rating as 'liked' | 'disliked' | 'neutral');
    return { rating: result };
  }
}