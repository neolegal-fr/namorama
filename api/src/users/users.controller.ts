import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthenticatedUser } from 'nest-keycloak-connect';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('credits')
  async getCredits(@AuthenticatedUser() user: any) {
    // user.sub est l'ID Keycloak
    const credits = await this.usersService.getCredits(user.sub);
    return { credits };
  }

  @Get('me')
  async getMe(@AuthenticatedUser() user: any) {
    return await this.usersService.findOrCreate(user.sub, user.email);
  }
}