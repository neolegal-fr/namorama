import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { StripeEvent } from './entities/stripe-event.entity';

/** Crédits offerts par l'abonnement mensuel */
const SUBSCRIPTION_QUOTA = 2000;

/** Crédits offerts par le pack ponctuel */
const PACK_CREDITS = 1000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(StripeEvent)
    private readonly stripeEventRepo: Repository<StripeEvent>,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2026-01-28.clover',
    });
  }

  private get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
  }

  /** Crée ou récupère le customer Stripe associé à l'utilisateur */
  private async ensureStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { keycloakId: user.keycloakId },
    });

    await this.usersService.setStripeCustomerId(user.keycloakId, customer.id);
    return customer.id;
  }

  /** Crée une session Stripe Checkout pour l'abonnement mensuel */
  async createSubscriptionCheckout(user: User): Promise<string> {
    const customerId = await this.ensureStripeCustomer(user);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: this.configService.get<string>('STRIPE_ESSENTIAL_PRICE_ID'),
          quantity: 1,
        },
      ],
      success_url: `${this.frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendUrl}/payment/cancel`,
      metadata: { keycloakId: user.keycloakId, type: 'subscription' },
      invoice_creation: undefined, // géré automatiquement par Stripe en mode subscription
    });

    return session.url!;
  }

  /** Crée une session Stripe Checkout pour un pack de crédits ponctuel */
  async createPackCheckout(user: User): Promise<string> {
    const customerId = await this.ensureStripeCustomer(user);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          price: this.configService.get<string>('STRIPE_PACK_PRICE_ID'),
          quantity: 1,
        },
      ],
      success_url: `${this.frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendUrl}/payment/cancel`,
      metadata: { keycloakId: user.keycloakId, type: 'pack' },
      invoice_creation: { enabled: true },
    });

    return session.url!;
  }

  /** Crée une session Stripe Customer Portal */
  async createPortalSession(user: User): Promise<string> {
    const customerId = await this.ensureStripeCustomer(user);

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.frontendUrl}/`,
    });

    return session.url;
  }

  /** Vérifie si une session a déjà été traitée (idempotence) */
  private async isAlreadyProcessed(sessionId: string): Promise<boolean> {
    const existing = await this.stripeEventRepo.findOne({ where: { sessionId } });
    return !!existing;
  }

  /** Marque une session comme traitée */
  private async markProcessed(sessionId: string, type: string): Promise<void> {
    await this.stripeEventRepo.save({ sessionId, type });
  }

  /**
   * Traite une session Stripe Checkout après redirection vers /payment/success.
   * Fallback pour les environnements locaux où Stripe ne peut pas atteindre le webhook.
   * Idempotent : sans effet si la session a déjà été traitée par le webhook.
   */
  async fulfillSession(sessionId: string, keycloakId: string): Promise<{ creditsAdded: number }> {
    if (await this.isAlreadyProcessed(sessionId)) {
      this.logger.log(`Session déjà traitée : ${sessionId}`);
      return { creditsAdded: 0 };
    }

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return { creditsAdded: 0 };
    }

    // Vérifier que la session appartient bien à cet utilisateur
    if (session.metadata?.keycloakId !== keycloakId) {
      this.logger.warn(`Session ${sessionId} n'appartient pas à ${keycloakId}`);
      return { creditsAdded: 0 };
    }

    await this.markProcessed(sessionId, session.metadata?.type ?? 'unknown');

    if (session.mode === 'payment' && session.metadata?.type === 'pack') {
      await this.usersService.addExtraCredits(keycloakId, PACK_CREDITS);
      this.logger.log(`fulfillSession: ${PACK_CREDITS} crédits extra ajoutés pour ${keycloakId}`);
      return { creditsAdded: PACK_CREDITS };
    }

    if (session.mode === 'subscription' && session.subscription) {
      await this.usersService.setStripeSubscriptionId(keycloakId, session.subscription as string);
      await this.usersService.resetSubscriptionCredits(keycloakId, SUBSCRIPTION_QUOTA);
      this.logger.log(`fulfillSession: abonnement activé pour ${keycloakId}`);
      return { creditsAdded: SUBSCRIPTION_QUOTA };
    }

    return { creditsAdded: 0 };
  }

  /** Traite un événement webhook Stripe (corps brut requis pour la vérification de signature) */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Signature webhook invalide:', err);
      throw new Error('Invalid webhook signature');
    }

    this.logger.log(`Webhook reçu: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const keycloakId = session.metadata?.keycloakId;
        if (!keycloakId) break;

        if (await this.isAlreadyProcessed(session.id)) {
          this.logger.log(`Webhook: session déjà traitée via fulfillSession: ${session.id}`);
          break;
        }
        await this.markProcessed(session.id, session.metadata?.type ?? 'unknown');

        if (session.mode === 'payment' && session.metadata?.type === 'pack') {
          await this.usersService.addExtraCredits(keycloakId, PACK_CREDITS);
          this.logger.log(`Webhook: Pack ${PACK_CREDITS} crédits ajouté pour ${keycloakId}`);
        }
        if (session.mode === 'subscription' && session.subscription) {
          await this.usersService.setStripeSubscriptionId(keycloakId, session.subscription as string);
          await this.usersService.resetSubscriptionCredits(keycloakId, SUBSCRIPTION_QUOTA);
          this.logger.log(`Webhook: Abonnement activé pour ${keycloakId}`);
        }
        break;
      }

      case 'invoice.paid': {
        // Renouvellement mensuel → remettre les crédits d'abonnement à leur quota
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === 'subscription_cycle' && invoice.customer) {
          const user = await this.usersService.findByStripeCustomerId(invoice.customer as string);
          if (user) {
            await this.usersService.resetSubscriptionCredits(user.keycloakId, SUBSCRIPTION_QUOTA);
            this.logger.log(`Renouvellement abonnement : ${SUBSCRIPTION_QUOTA} crédits pour ${user.keycloakId}`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Abonnement résilié → remettre les crédits d'abonnement à 0
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.customer) {
          await this.usersService.cancelSubscription(subscription.customer as string);
          this.logger.log(`Abonnement résilié pour customer ${subscription.customer}`);
        }
        break;
      }

      default:
        this.logger.debug(`Événement non géré: ${event.type}`);
    }
  }
}
