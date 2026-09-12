import { Controller, Delete, Get, HttpCode, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService, isKeycloakAdmin } from './users.service';
import { User } from './entities/user.entity';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { FunnelService, sessionIdDeLaRequete } from '../common/funnel/funnel.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly funnel: FunnelService,
  ) {}

  /**
   * Rattache la visite en cours au compte, et note l'inscription si c'en est une.
   *
   * Appelé depuis les deux points d'entrée que le front passe après une
   * connexion. Le verdict « inscription » ne se prend plus ici : il se déduit
   * de `createdAt` comparé au début de la visite, parce que rien ne garantit
   * que ce soit l'un de ces deux appels qui ait créé le compte — au chargement
   * de l'application, une dizaine d'appels authentifiés partent ensemble et
   * n'importe lequel peut gagner. Voir {@link FunnelService.rattacher}.
   */
  private async rattacherVisite(req: Request, user: User, cree: boolean): Promise<void> {
    await this.funnel.rattacher(sessionIdDeLaRequete(req), user.keycloakId, user.createdAt, cree);
  }

  @Get('me')
  async getMe(@AuthenticatedUser() keycloakUser: any, @Req() req: Request) {
    const { user, cree } = await this.usersService.findOrCreateDetaille(keycloakUser.sub, {
      email: keycloakUser.email,
      firstName: keycloakUser.given_name,
      lastName: keycloakUser.family_name,
      locale: keycloakUser.locale,
      isAdmin: isKeycloakAdmin(keycloakUser),
    });

    await this.rattacherVisite(req, user, cree);

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

  @Delete('me')
  @HttpCode(204)
  async deleteAccount(@AuthenticatedUser() keycloakUser: any) {
    await this.usersService.deleteAccount(keycloakUser.sub);
  }

  /**
   * Solde de crédits — et, en pratique, le premier appel authentifié de chaque
   * chargement de page : c'est lui qui rattache la visite au compte.
   */
  @Get('credits')
  async getCredits(@AuthenticatedUser() keycloakUser: any, @Req() req: Request) {
    const { user, cree } = await this.usersService.findOrCreateDetaille(keycloakUser.sub, {
      email: keycloakUser.email,
      firstName: keycloakUser.given_name,
      lastName: keycloakUser.family_name,
      locale: keycloakUser.locale,
      isAdmin: isKeycloakAdmin(keycloakUser),
    });
    await this.rattacherVisite(req, user, cree);
    return {
      credits: user.totalCredits,
      freeCredits: user.credits,
      packCredits: user.extraCredits,
    };
  }
}
