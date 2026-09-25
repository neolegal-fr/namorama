import { Controller, Get, Patch, Post, Delete, Param, Body, Query, ParseIntPipe, DefaultValuePipe, HttpCode, ForbiddenException } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { Roles, AuthenticatedUser } from 'nest-keycloak-connect';
import { AdminService } from './admin.service';
import { ModelCostsService } from './model-costs.service';
import { ModelPricesService } from './model-prices.service';
import { RetentionService } from './retention.service';
import { AdminMailService } from './admin-mail.service';
import { FeedbackService } from '../feedback/feedback.service';
import { UsersService } from '../users/users.service';

class AdjustCreditsDto {
  @IsNumber()
  delta: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Un nouveau tarif. Montants en dollars par million de tokens ; `perCall`
 * pour un outil (`web_search`), à l'appel.
 */
class NouveauTarifDto {
  /** Préfixe du modèle tel que l'API le renvoie : `gpt-5.6-luna` couvre ses instantanés datés. */
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._:-]+$/, { message: 'Identifiant de modèle invalide' })
  model: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date attendue au format AAAA-MM-JJ' })
  effectiveFrom: string;

  @IsNumber()
  @Min(0)
  inputPerM: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cachedInputPerM?: number | null;

  @IsNumber()
  @Min(0)
  outputPerM: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perCall?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

/** Consigne facultative : un angle, un fait à citer. Le but du message, lui, est fixe. */
class BrouillonDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class CourrielDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body: string;

  /** Version des consignes du brouillon de départ ; `null` pour un texte écrit à la main. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  promptVersion?: string | null;
}

class ReponseDto {
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message: string;
}

class SetInternalDto {
  @IsBoolean()
  internal: boolean;
}

@Controller('admin')
@Roles({ roles: ['realm:admin'] })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly feedbackService: FeedbackService,
    private readonly usersService: UsersService,
    private readonly modelCosts: ModelCostsService,
    private readonly modelPrices: ModelPricesService,
    private readonly retention: RetentionService,
    private readonly adminMail: AdminMailService,
  ) {}

  @Get('users')
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search = '',
    @Query('sort') sort = 'createdAt',
    @Query('dir') dir = 'DESC',
  ) {
    return this.adminService.getUsers(page, limit, search, sort, dir === 'ASC' ? 'ASC' : 'DESC');
  }

  @Patch('users/:id/credits')
  async adjustCredits(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdjustCreditsDto,
    @AuthenticatedUser() admin: any,
  ) {
    return this.adminService.adjustCredits(id, body.delta, body.reason ?? '', admin.sub);
  }

  /**
   * Marque un compte comme interne (ou l'en retire).
   *
   * Le corps porte un booléen EXPLICITE plutôt qu'une bascule : deux clics
   * rapides sur une bascule, ou deux onglets ouverts, laisseraient le compte
   * dans l'état inverse de celui qu'on voit à l'écran.
   */
  @Patch('users/:id/internal')
  async setInternal(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetInternalDto,
  ) {
    return this.adminService.setInternal(id, body.internal);
  }

  // ─── Écrire à un utilisateur ──────────────────────────────────────────────

  /** Les envois déjà faits à ce compte. */
  @Get('users/:id/mails')
  async getMails(@Param('id', ParseIntPipe) id: number) {
    return this.adminMail.historique(id);
  }

  /** Un brouillon rédigé par le modèle — rien n'est envoyé. */
  @Post('users/:id/mails/draft')
  async draftMail(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: BrouillonDto,
    @AuthenticatedUser() admin: any,
  ) {
    return this.adminMail.rediger(id, AdminController.signataire(admin), body.note?.trim() || undefined);
  }

  @Post('users/:id/mails')
  async sendMail(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CourrielDto,
    @AuthenticatedUser() admin: any,
  ) {
    return this.adminMail.envoyer(id, { sub: admin.sub, nom: AdminController.signataire(admin) }, {
      subject: body.subject,
      body: body.body,
      promptVersion: body.promptVersion ?? null,
    });
  }

  /** La réponse reçue par courriel, recopiée : elle devient un feedback à valider. */
  @Post('mails/:mailId/reply')
  async recordMailReply(
    @Param('mailId', ParseIntPipe) mailId: number,
    @Body() body: ReponseDto,
  ) {
    return this.adminMail.enregistrerReponse(mailId, body.message);
  }

  /** Le prénom de l'administrateur connecté : il signe, et nomme l'expéditeur. */
  private static signataire(admin: any): string {
    return String(admin?.given_name || admin?.name || 'Namorama').replace(/[\r\n"<>]/g, '').slice(0, 60);
  }

  @Delete('users/:id')
  @HttpCode(204)
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() admin: any,
  ) {
    const user = await this.usersService.findById(id);
    if (user?.keycloakId === admin.sub) {
      throw new ForbiddenException('You cannot delete your own account from the admin panel');
    }
    await this.usersService.deleteAccountById(id);
  }

  @Get('stats')
  async getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getStats(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /**
   * Historique hebdomadaire, pour les courbes du tableau de bord.
   *
   * Séparé de `/stats` : la série balaie six mois et ne change qu'une fois par
   * semaine, alors que les indicateurs se recalculent à chaque changement de
   * période. Les fusionner ferait rejouer six mois d'agrégats à chaque clic.
   */
  @Get('series')
  async getSeries(
    @Query('weeks', new DefaultValuePipe(26), ParseIntPipe) weeks: number,
  ) {
    return this.adminService.getSeries(weeks);
  }

  /**
   * Ce qu'ont coûté les appels au modèle : période, période précédente, série
   * hebdomadaire et tarifs courants.
   *
   * Séparé de `/stats` pour échouer seul : le relevé joint trois tables
   * récentes, et une carte en panne ne doit pas emporter les quinze autres.
   */
  @Get('model-costs')
  async getModelCosts(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('weeks', new DefaultValuePipe(26), ParseIntPipe) weeks = 26,
  ) {
    return this.modelCosts.getCosts(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      weeks,
    );
  }

  /** Détail des coûts du modèle pour un compte : par opération, et semaine par semaine. */
  @Get('users/:id/model-costs')
  async getUserModelCosts(@Param('id', ParseIntPipe) id: number) {
    return this.modelCosts.getUserCosts(id);
  }

  /** Tous les tarifs, historique compris : un tarif ne se modifie pas, il se remplace à une date. */
  @Get('model-prices')
  async getModelPrices() {
    return this.modelPrices.lister();
  }

  @Post('model-prices')
  async addModelPrice(@Body() body: NouveauTarifDto) {
    return this.modelPrices.ajouter(body);
  }

  /** Pour corriger une saisie erronée : recalcule tous les appels que ce tarif couvrait. */
  @Delete('model-prices/:id')
  @HttpCode(204)
  async deleteModelPrice(@Param('id', ParseIntPipe) id: number) {
    await this.modelPrices.supprimer(id);
  }

  /**
   * Qui revient, et combien de temps on reste. Indépendant de la période
   * choisie : à ce volume, une fenêtre de sept jours ne contiendrait presque
   * aucun inscrit assez ancien pour avoir un J+7.
   */
  @Get('retention')
  async getRetention() {
    return this.retention.getRetention();
  }

  @Get('feedback')
  async getFeedback() {
    return this.feedbackService.findAll();
  }

  @Post('feedback/:id/award-credits')
  async awardCredits(@Param('id') id: string) {
    return this.feedbackService.awardCredits(id);
  }

  @Post('feedback/:id/reject')
  async rejectFeedback(@Param('id') id: string) {
    return this.feedbackService.reject(id);
  }

  @Delete('feedback/:id')
  @HttpCode(204)
  async deleteFeedback(@Param('id') id: string) {
    await this.feedbackService.delete(id);
  }
}
