import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOrCreate(keycloakId: string, email?: string): Promise<User> {
    let user = await this.usersRepository.findOne({ where: { keycloakId } });

    if (!user) {
      user = this.usersRepository.create({
        keycloakId,
        email,
        credits: 100,
        extraCredits: 0,
      });
      user = await this.usersRepository.save(user);
    }

    return user;
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { stripeCustomerId } });
  }

  async getCredits(keycloakId: string): Promise<number> {
    const user = await this.findOrCreate(keycloakId);
    return user.totalCredits;
  }

  /**
   * Décrémente les crédits en consommant d'abord les crédits d'abonnement,
   * puis les crédits extra. Retourne le nouveau total, ou -1 si insuffisant.
   */
  async decrementCredits(keycloakId: string, amount: number, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(User) : this.usersRepository;
    const user = await repo.findOne({ where: { keycloakId } });

    if (!user || user.totalCredits < amount) return -1;

    let remaining = amount;
    if (user.credits >= remaining) {
      user.credits -= remaining;
    } else {
      remaining -= user.credits;
      user.credits = 0;
      user.extraCredits -= remaining;
    }

    await repo.save(user);
    return user.totalCredits;
  }

  /** Ajoute des crédits extra (achat ponctuel, permanents) */
  async addExtraCredits(keycloakId: string, amount: number, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(User) : this.usersRepository;
    const user = await repo.findOne({ where: { keycloakId } });
    if (!user) return;
    user.extraCredits += amount;
    await repo.save(user);
  }

  /** Remet les crédits d'abonnement à leur quota mensuel */
  async resetSubscriptionCredits(keycloakId: string, quota: number, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(User) : this.usersRepository;
    const user = await repo.findOne({ where: { keycloakId } });
    if (!user) return;
    user.credits = quota;
    await repo.save(user);
  }

  /** Annule l'abonnement : remet les crédits abonnement à 0 */
  async cancelSubscription(stripeCustomerId: string): Promise<void> {
    const user = await this.findByStripeCustomerId(stripeCustomerId);
    if (!user) return;
    user.credits = 0;
    user.stripeSubscriptionId = null as unknown as string;
    await this.usersRepository.save(user);
  }

  async setStripeCustomerId(keycloakId: string, stripeCustomerId: string): Promise<void> {
    await this.usersRepository.update({ keycloakId }, { stripeCustomerId });
  }

  async setStripeSubscriptionId(keycloakId: string, stripeSubscriptionId: string): Promise<void> {
    await this.usersRepository.update({ keycloakId }, { stripeSubscriptionId });
  }

  /** Retourne les informations d'abonnement de l'utilisateur */
  async getSubscription(keycloakId: string): Promise<{
    plan: 'essential' | null;
    status: 'active' | 'cancelled' | 'expired' | 'none';
    subscriptionCredits: number;
    subscriptionCreditsTotal: number;
    extraCredits: number;
    currentPeriodEnd: string | null;
    nextBillingAmount: number | null;
  }> {
    const user = await this.findOrCreate(keycloakId);
    const now = new Date();

    let status: 'active' | 'cancelled' | 'expired' | 'none' = 'none';
    let plan: 'essential' | null = null;

    if (user.stripeSubscriptionId) {
      plan = 'essential';
      if (user.subscriptionCancelledAt) {
        status = user.subscriptionCancelledAt > now ? 'cancelled' : 'active';
      } else {
        status = 'active';
      }
    } else if (user.subscriptionCancelledAt) {
      plan = 'essential';
      status = 'expired';
    }

    return {
      plan,
      status,
      subscriptionCredits: user.credits,
      subscriptionCreditsTotal: plan ? 2000 : 0,
      extraCredits: user.extraCredits,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
      nextBillingAmount: status === 'active' ? 500 : null,
    };
  }

  /** Enregistre la date de fin de période d'abonnement (appelé depuis webhook invoice.paid) */
  async setSubscriptionPeriodEndByCustomerId(stripeCustomerId: string, periodEnd: Date): Promise<void> {
    const user = await this.findByStripeCustomerId(stripeCustomerId);
    if (!user) return;
    user.subscriptionCurrentPeriodEnd = periodEnd;
    await this.usersRepository.save(user);
  }

  /** Enregistre la date de fin de période d'abonnement par keycloakId (checkout) */
  async setSubscriptionPeriodEnd(keycloakId: string, periodEnd: Date): Promise<void> {
    await this.usersRepository.update({ keycloakId }, { subscriptionCurrentPeriodEnd: periodEnd });
  }

  /** Enregistre la date d'annulation à fin de période (cancel_at_period_end) */
  async setSubscriptionCancelledAt(stripeCustomerId: string, cancelledAt: Date | null): Promise<void> {
    const user = await this.findByStripeCustomerId(stripeCustomerId);
    if (!user) return;
    user.subscriptionCancelledAt = cancelledAt;
    await this.usersRepository.save(user);
  }

  /** @deprecated Utiliser addExtraCredits ou resetSubscriptionCredits */
  async addCredits(keycloakId: string, amount: number): Promise<void> {
    const user = await this.findOrCreate(keycloakId);
    user.extraCredits += amount;
    await this.usersRepository.save(user);
  }
}
