import {
  Controller,
  Post,
  Get,
  Headers,
  Req,
  Body,
  HttpCode,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import type { RawBodyRequest as RawBodyReq } from '@nestjs/common';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import { PaymentsService } from './payments.service';
import type { PackType } from './payments.service';
import { UsersService } from '../users/users.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly usersService: UsersService,
  ) {}

  /** Crée une session Checkout pour un pack de crédits (decouverte | pro | max) */
  @Post('checkout/pack')
  async checkoutPack(
    @Body('packType') packType: PackType,
    @AuthenticatedUser() keycloakUser: any,
  ) {
    const validTypes: PackType[] = ['decouverte', 'pro', 'max'];
    if (!validTypes.includes(packType)) {
      throw new BadRequestException(`packType invalide : ${packType}`);
    }
    const user = await this.usersService.findOrCreate(keycloakUser.sub, keycloakUser.email);
    const url = await this.paymentsService.createPackCheckout(user, packType);
    return { url };
  }

  /**
   * Appelé par la page /payment/success après redirection Stripe.
   * Traite la session si elle n'a pas encore été traitée par le webhook (dev local).
   */
  @Post('fulfill-session')
  async fulfillSession(
    @Body('sessionId') sessionId: string,
    @AuthenticatedUser() keycloakUser: any,
  ) {
    const result = await this.paymentsService.fulfillSession(sessionId, keycloakUser.sub);
    const user = await this.usersService.findOrCreate(keycloakUser.sub);
    return {
      creditsAdded: result.creditsAdded,
      totalCredits: user.totalCredits,
      freeCredits: user.credits,
      packCredits: user.extraCredits,
    };
  }

  /** Webhook Stripe — corps brut requis pour la vérification de signature */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyReq<Request>,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Corps de la requête manquant');
    }

    try {
      await this.paymentsService.handleWebhook(req.rawBody, signature);
    } catch (err) {
      this.logger.error('Erreur webhook:', err);
      throw new BadRequestException('Webhook invalide');
    }

    return { received: true };
  }
}
