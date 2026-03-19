import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Project } from '../projects/entities/project.entity';

/** Quota mensuel de crédits gratuits */
const FREE_MONTHLY_QUOTA = 100;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    private configService: ConfigService,
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

  async findOrCreate(keycloakId: string, email?: string, firstName?: string, lastName?: string, locale?: string): Promise<User> {
    let user = await this.usersRepository.findOne({ where: { keycloakId } });

    if (!user) {
      user = this.usersRepository.create({
        keycloakId,
        email,
        firstName,
        lastName,
        locale,
        credits: FREE_MONTHLY_QUOTA,
        extraCredits: 0,
        lastFreeReset: new Date(),
      });
      user = await this.usersRepository.save(user);
    } else {
      await this.maybeFreeReset(user, this.usersRepository);
      user = await this.usersRepository.findOne({ where: { keycloakId } }) ?? user;
      // Mettre à jour les infos de profil si disponibles
      if (email) user.email = email;
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (locale) user.locale = locale;
    }

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

  /** Ajoute des crédits pack (achat ponctuel, permanents). Retourne le User mis à jour. */
  async addExtraCredits(keycloakId: string, amount: number, manager?: EntityManager): Promise<User | null> {
    const repo = manager ? manager.getRepository(User) : this.usersRepository;
    const user = await repo.findOne({ where: { keycloakId } });
    if (!user) return null;
    user.extraCredits += amount;
    return repo.save(user);
  }

  async setStripeCustomerId(keycloakId: string, stripeCustomerId: string): Promise<void> {
    await this.usersRepository.update({ keycloakId }, { stripeCustomerId });
  }

  async findById(id: number) {
    return this.usersRepository.findOne({ where: { id } });
  }

  /** Supprime le compte par id interne (usage admin). */
  async deleteAccountById(id: number): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) return;
    await this.deleteAccount(user.keycloakId);
  }

  /** Supprime le compte : user en base (cascade DB → projets → suggestions), puis Keycloak. */
  async deleteAccount(keycloakId: string): Promise<void> {
    await this.usersRepository.delete({ keycloakId });
    await this.deleteFromKeycloak(keycloakId);
  }

  private async deleteFromKeycloak(keycloakId: string): Promise<void> {
    try {
      const authServerUrl = this.configService.get<string>('KEYCLOAK_AUTH_SERVER_URL');
      const realm = this.configService.get<string>('KEYCLOAK_REALM');
      const clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID');
      const clientSecret = this.configService.get<string>('KEYCLOAK_SECRET');

      const tokenRes = await fetch(
        `${authServerUrl}/realms/${realm}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId ?? '',
            client_secret: clientSecret ?? '',
          }),
        },
      );
      const { access_token } = await tokenRes.json();

      const res = await fetch(`${authServerUrl}/admin/realms/${realm}/users/${keycloakId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!res.ok) {
        this.logger.warn(`Keycloak DELETE user ${keycloakId} returned ${res.status} — user already removed from DB`);
      }
    } catch (err) {
      this.logger.error(`Failed to delete Keycloak user ${keycloakId}`, err);
    }
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
