import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { UsersService } from '../users/users.service';

@Controller('projects')
export class ProjectsController {
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

  @Patch('suggestions/:id/favorite')
  async toggleFavorite(@Param('id') id: string, @AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    const isFavorite = await this.projectsService.toggleFavorite(id, user);
    return { isFavorite };
  }
}