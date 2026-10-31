import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { StripeEvent } from './entities/stripe-event.entity';
import { Paiement } from './entities/paiement.entity';

export type PackType = 'decouverte' | 'pro' | 'max';

const PACK_CREDITS: Record<PackType, number> = {
  decouverte: 500,
  pro: 2000,
  max: 5000,
};

const PACK_PRICE_ENV: Record<PackType, string> = {
  decouverte: 'STRIPE_PACK_DECOUVERTE_PRICE_ID',
  pro: 'STRIPE_PACK_PRO_PRICE_ID',
  max: 'STRIPE_PACK_MAX_PRICE_ID',
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(StripeEvent)
    private readonly stripeEventRepo: Repository<StripeEvent>,
    @InjectRepository(Paiement)
    private readonly paiementRepo: Repository<Paiement>,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2026-07-29.dahlia',
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

  /** Crée une session Stripe Checkout pour un pack de crédits (decouverte | pro | max) */
  async createPackCheckout(user: User, packType: PackType): Promise<string> {
    const customerId = await this.ensureStripeCustomer(user);
    const priceId = this.configService.get<string>(PACK_PRICE_ENV[packType]);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendUrl}/payment/cancel`,
      metadata: { keycloakId: user.keycloakId, type: 'pack', packType },
      invoice_creation: { enabled: true },
    });

    return session.url!;
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
   * Inscrit une session de pack PAYÉE au registre des paiements.
   *
   * Appelée APRÈS l'ajout des crédits, par le retour du navigateur comme par
   * le webhook : `sessionId` est unique et l'insertion ignore un doublon, si
   * bien que les deux chemins ne produisent qu'une ligne. Une session non
   * payée (`payment_status` ≠ `paid`) n'est jamais inscrite, même quand le
   * flux de crédits l'a acceptée : le registre ne compte que l'encaissé.
   *
   * Ne lève jamais : un registre en panne ne doit pas priver un client des
   * crédits qu'il vient de payer. L'échec se journalise avec l'identifiant de
   * session, de quoi le rattraper par `rattraper-paiements`.
   *
   * @returns `true` si une ligne a été écrite ; `false` si la session n'est pas
   *          un pack payé, si elle était déjà inscrite, ou en cas d'échec.
   */
  async enregistrerPaiement(session: Stripe.Checkout.Session): Promise<boolean> {
    const keycloakId = session.metadata?.keycloakId;
    if (session.payment_status !== 'paid' || session.metadata?.type !== 'pack' || !keycloakId) {
      return false;
    }
    const pack = (session.metadata?.packType ?? 'decouverte') as PackType;

    try {
      const resultat = await this.paiementRepo
        .createQueryBuilder()
        .insert()
        .into(Paiement)
        .values({
          sessionId: session.id,
          keycloakId,
          pack,
          credits: PACK_CREDITS[pack] ?? PACK_CREDITS.decouverte,
          montantCentimes: session.amount_total ?? 0,
          devise: (session.currency ?? 'eur').toUpperCase(),
          payeLe: session.created ? new Date(session.created * 1000) : new Date(),
        })
        .orIgnore()
        .execute();
      return Number(resultat?.raw?.affectedRows ?? 0) > 0;
    } catch (e) {
      this.logger.error(`payment_record_failed sessionId=${session.id} : ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }

  /**
   * Inscrit au registre les sessions traitées avant qu'il n'existe.
   *
   * Parcourt `stripe_event`, relit chaque session chez Stripe — seule source de
   * son montant et de son compte — et l'inscrit par {@link enregistrerPaiement},
   * avec ses mêmes règles (payée, pack, doublon ignoré). Ne touche JAMAIS aux
   * crédits : ils ont été ajoutés au moment du paiement. Rejouable sans effet.
   *
   * `livemode` est rapporté pour chaque session : un paiement de test passé par
   * la clé de production n'existe pas, mais une session relue avec une clé de
   * test, si.
   */
  async rattraperPaiements(): Promise<{ sessionId: string; livemode: boolean | null; inscrite: boolean; erreur?: string }[]> {
    const traitees = await this.stripeEventRepo.find();
    const bilan: { sessionId: string; livemode: boolean | null; inscrite: boolean; erreur?: string }[] = [];
    for (const { sessionId } of traitees) {
      try {
        const session = await this.stripe.checkout.sessions.retrieve(sessionId);
        bilan.push({ sessionId, livemode: session.livemode, inscrite: await this.enregistrerPaiement(session) });
      } catch (e) {
        bilan.push({ sessionId, livemode: null, inscrite: false, erreur: e instanceof Error ? e.message : String(e) });
      }
    }
    return bilan;
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

    if (session.metadata?.keycloakId !== keycloakId) {
      this.logger.warn(`Session ${sessionId} n'appartient pas à ${keycloakId}`);
      return { creditsAdded: 0 };
    }

    await this.markProcessed(sessionId, session.metadata?.type ?? 'unknown');

    if (session.mode === 'payment' && session.metadata?.type === 'pack') {
      const packType = (session.metadata?.packType ?? 'decouverte') as PackType;
      const credits = PACK_CREDITS[packType] ?? PACK_CREDITS.decouverte;
      await this.usersService.addExtraCredits(keycloakId, credits);
      this.logger.log(`fulfillSession: ${credits} crédits pack (${packType}) ajoutés pour ${keycloakId}`);
      await this.enregistrerPaiement(session);
      return { creditsAdded: credits };
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

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const keycloakId = session.metadata?.keycloakId;
      if (!keycloakId) return;

      if (await this.isAlreadyProcessed(session.id)) {
        this.logger.log(`Webhook: session déjà traitée via fulfillSession: ${session.id}`);
        return;
      }
      await this.markProcessed(session.id, session.metadata?.type ?? 'unknown');

      if (session.mode === 'payment' && session.metadata?.type === 'pack') {
        const packType = (session.metadata?.packType ?? 'decouverte') as PackType;
        const credits = PACK_CREDITS[packType] ?? PACK_CREDITS.decouverte;
        await this.usersService.addExtraCredits(keycloakId, credits);
        this.logger.log(`Webhook: ${credits} crédits pack (${packType}) ajoutés pour ${keycloakId}`);
        await this.enregistrerPaiement(session);
      }
    } else {
      this.logger.debug(`Événement non géré: ${event.type}`);
    }
  }
}
