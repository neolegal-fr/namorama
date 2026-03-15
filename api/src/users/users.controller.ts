import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthenticatedUser } from 'nest-keycloak-connect';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(
      keycloakUser.sub,
      keycloakUser.email,
      keycloakUser.given_name,
      keycloakUser.family_name,
      keycloakUser.locale,
    );
    return {
      keycloakId: user.keycloakId,
      email: user.email,
      freeCredits: user.credits,
      packCredits: user.extraCredits,
      totalCredits: user.totalCredits,
    };
  }

  @Get('me/subscription')
  async getSubscription(@AuthenticatedUser() keycloakUser: any) {
    return this.usersService.getSubscription(keycloakUser.sub);
  }

  @Get('credits')
  async getCredits(@AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(
      keycloakUser.sub,
      keycloakUser.email,
      keycloakUser.given_name,
      keycloakUser.family_name,
      keycloakUser.locale,
    );
    return {
      credits: user.totalCredits,
      freeCredits: user.credits,
      packCredits: user.extraCredits,
    };
  }
}
