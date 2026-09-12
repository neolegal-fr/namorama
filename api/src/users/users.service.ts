import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserActivityDay } from './entities/user-activity-day.entity';
import { Project } from '../projects/entities/project.entity';

/** Quota mensuel de crédits gratuits */
const FREE_MONTHLY_QUOTA = 100;

/** Mois calendaire courant au format « AAAA-MM » — clé du rapport offert. */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Champs recopiés du token Keycloak à chaque appel authentifié. */
export interface UserProfile {
  email?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
  isAdmin?: boolean;
}

/** Le rôle realm `admin`, tel que déclaré dans le token. */
export function isKeycloakAdmin(token: any): boolean {
  return Array.isArray(token?.realm_access?.roles) && token.realm_access.roles.includes('admin');
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(UserActivityDay)
    private activityRepository: Repository<UserActivityDay>,
    private configService: ConfigService,
  ) {}

  /**
   * Couples (compte, jour) déjà écrits par CE processus.
   *
   * `findOrCreate` est appelé au début de presque chaque requête authentifiée :
   * sans ce garde, un utilisateur qui parcourt l'application déclencherait un
   * `INSERT ... IGNORE` par clic. La clé primaire garantit déjà l'unicité en
   * base — ce cache ne corrige rien, il évite le trajet.
   *
   * Volontairement non borné en taille : une entrée par (compte, jour) actif,
   * et le processus redémarre à chaque déploiement. Bornée en revanche dans le
   * temps — les entrées d'hier sont purgées au premier appel du lendemain,
   * sinon un conteneur de longue durée les accumulerait indéfiniment.
   */
  private activiteVue = new Set<string>();
  private activiteJour = '';

  /**
   * Note que ce compte s'est servi du produit aujourd'hui.
   *
   * Best-effort, comme les logs : une requête utilisateur ne doit jamais
   * échouer parce qu'une statistique n'a pas pu s'écrire.
   */
  private async noterActivite(userId: number): Promise<void> {
    try {
      const now = new Date();
      const jour = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (jour !== this.activiteJour) {
        this.activiteVue.clear();
        this.activiteJour = jour;
      }
      const cle = `${userId}:${jour}`;
      if (this.activiteVue.has(cle)) return;

      await this.activityRepository
        .createQueryBuilder()
        .insert()
        .into(UserActivityDay)
        .values({ userId, day: jour })
        .orIgnore()
        .execute();

      this.activiteVue.add(cle);
    } catch (e) {
      this.logger.warn(`Activité non enregistrée pour l'utilisateur ${userId}: ${e}`);
    }
  }

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

  async findOrCreate(keycloakId: string, profile: UserProfile = {}): Promise<User> {
    return (await this.findOrCreateDetaille(keycloakId, profile)).user;
  }

  /**
   * Comme {@link findOrCreate}, mais dit si le compte vient d'être créé.
   *
   * C'est le seul endroit du produit qui le sache : Keycloak ne prévient pas
   * d'une inscription, et `createdAt` ne distingue pas « créé par cet appel »
   * de « créé il y a une minute ». L'entonnoir du tableau de bord en dépend —
   * sans ce booléen, l'étape « a créé un compte » n'aurait aucun signal à
   * rattacher à la visite en cours.
   */
  async findOrCreateDetaille(
    keycloakId: string,
    profile: UserProfile = {},
  ): Promise<{ user: User; cree: boolean }> {
    const { email, firstName, lastName, locale, isAdmin } = profile;
    let user = await this.usersRepository.findOne({ where: { keycloakId } });
    let cree = !user;

    if (!user) {
      const nouveau = this.usersRepository.create({
        keycloakId,
        email,
        firstName,
        lastName,
        locale,
        isAdmin: isAdmin ?? false,
        credits: FREE_MONTHLY_QUOTA,
        extraCredits: 0,
        lastFreeReset: new Date(),
      });
      try {
        user = await this.usersRepository.save(nouveau);
      } catch (e) {
        // « Lire puis écrire » n'est pas atomique, et c'est précisément au
        // premier chargement d'un compte neuf que la fenêtre s'ouvre : le
        // front tire une dizaine d'appels authentifiés en parallèle, tous
        // passent par ici, tous voient `null`, et tous tentent l'insertion.
        // Le perdant remontait en 500 — observé le 21/08/2026 sur
        // `GET /projects/:id`, « Duplicate entry … for key
        // IDX_9eccb789f0a033a2cfa5baf4d9 » — c'est-à-dire à la toute première
        // seconde d'une inscription, le pire moment possible.
        //
        // L'index unique sur `keycloakId` reste l'arbitre : on ne tente pas de
        // l'éviter, on accepte d'avoir perdu et on relit la ligne du gagnant.
        const gagnant = await this.usersRepository.findOne({ where: { keycloakId } });
        if (!gagnant) throw e;
        user = gagnant;
        cree = false;
      }
    } else {
      await this.maybeFreeReset(user, this.usersRepository);
      user = await this.usersRepository.findOne({ where: { keycloakId } }) ?? user;
      // Mettre à jour les infos de profil si disponibles
      if (email) user.email = email;
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (locale) user.locale = locale;
      // Contrairement aux champs ci-dessus, `false` est une valeur porteuse de
      // sens : un rôle retiré dans Keycloak doit redescendre en base.
      if (isAdmin !== undefined) user.isAdmin = isAdmin;
    }

    user.lastLogin = new Date();
    await this.usersRepository.save(user);

    // `lastLogin` ne retient que la dernière fois ; le journal retient CHAQUE
    // jour. Voir UserActivityDay pour ce que l'un mesure et l'autre pas.
    await this.noterActivite(user.id);

    return { user, cree };
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
