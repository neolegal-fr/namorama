import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';

/** Quota mensuel de crédits gratuits */
const FREE_MONTHLY_QUOTA = 100;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Réinitialise les crédits gratuits si le dernier reset date d'un mois précédent.
   * Appelé de façon transparente avant toute lecture/écriture de crédits.
   */
  private async maybeFreeReset(user: User, repo: Repository<User>): Promise<void> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!user.lastFreeReset || user.lastFreeReset < startOfMonth) {
      user.credits = FREE_MONTHLY_QUOTA;
      user.lastFreeReset = now;
      await repo.save(user);
    }
  }

  async findOrCreate(keycloakId: string, email?: string): Promise<User> {
    let user = await this.usersRepository.findOne({ where: { keycloakId } });

    if (!user) {
      user = this.usersRepository.create({
        keycloakId,
        email,
        credits: FREE_MONTHLY_QUOTA,
        extraCredits: 0,
        lastFreeReset: new Date(),
      });
      user = await this.usersRepository.save(user);
    } else {
      await this.maybeFreeReset(user, this.usersRepository);
      // Recharger après un éventuel reset
      user = await this.usersRepository.findOne({ where: { keycloakId } }) ?? user;
    }

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await this.usersRepository.save(user);

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
   * Décrémente les crédits en consommant d'abord les crédits gratuits,
   * puis les crédits pack. Retourne le nouveau total, ou -1 si insuffisant.
   */
  async decrementCredits(keycloakId: string, amount: number, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(User) : this.usersRepository;
    const user = await repo.findOne({ where: { keycloakId } });
    if (!user) return -1;

    // Lazy reset dans le contexte de la transaction
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!user.lastFreeReset || user.lastFreeReset < startOfMonth) {
      user.credits = FREE_MONTHLY_QUOTA;
      user.lastFreeReset = now;
    }

    if (user.totalCredits < amount) return -1;

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

  /** Ajoute des crédits pack (achat ponctuel, permanents) */
  async addExtraCredits(keycloakId: string, amount: number, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(User) : this.usersRepository;
    const user = await repo.findOne({ where: { keycloakId } });
    if (!user) return;
    user.extraCredits += amount;
    await repo.save(user);
  }

  async setStripeCustomerId(keycloakId: string, stripeCustomerId: string): Promise<void> {
    await this.usersRepository.update({ keycloakId }, { stripeCustomerId });
  }

  /** Retourne les informations de crédits de l'utilisateur */
  async getSubscription(keycloakId: string): Promise<{
    freeCredits: number;
    packCredits: number;
    freeResetDate: string;
  }> {
    const user = await this.findOrCreate(keycloakId);

    const now = new Date();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      freeCredits: user.credits,
      packCredits: user.extraCredits,
      freeResetDate: nextReset.toISOString(),
    };
  }
}
