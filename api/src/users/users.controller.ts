import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthenticatedUser } from 'nest-keycloak-connect';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub, keycloakUser.email);
    return {
      keycloakId: user.keycloakId,
      email: user.email,
      subscriptionCredits: user.credits,
      extraCredits: user.extraCredits,
      totalCredits: user.totalCredits,
      hasActiveSubscription: !!user.stripeSubscriptionId,
    };
  }

  @Get('me/subscription')
  async getSubscription(@AuthenticatedUser() keycloakUser: any) {
    return this.usersService.getSubscription(keycloakUser.sub);
  }

  @Get('credits')
  async getCredits(@AuthenticatedUser() keycloakUser: any) {
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    return {
      credits: user.totalCredits,
      subscriptionCredits: user.credits,
      extraCredits: user.extraCredits,
      hasActiveSubscription: !!user.stripeSubscriptionId,
    };
  }
}
