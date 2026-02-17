import { Controller, Get, Param, Patch, Logger, Body } from '@nestjs/common';
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
  async findOne(@Param('id') id: string, @AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    return this.projectsService.findOne(id, user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @AuthenticatedUser() keycloakUser: any, @Body() data: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    return this.projectsService.update(id, user, data);
  }

  @Patch('suggestions/:id/favorite')
  async toggleFavorite(@Param('id') id: string, @AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    const isFavorite = await this.projectsService.toggleFavorite(id, user);
    return { isFavorite };
  }
}