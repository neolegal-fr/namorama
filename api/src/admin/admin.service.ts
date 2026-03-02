import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { DomainSuggestion } from '../projects/entities/domain-suggestion.entity';
import { CreditAdjustment } from './entities/credit-adjustment.entity';

export interface AdminUserRow {
  id: number;
  keycloakId: string;
  email: string;
  credits: number;
  extraCredits: number;
  totalCredits: number;
  createdAt: Date;
  lastLogin: Date | null;
  projectCount: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers7: number;
  activeUsers30: number;
  newUsers7: number;
  newUsers30: number;
  totalProjects: number;
  totalSuggestions: number;
  avgSuggestionsPerProject: number;
  avgFavoritesPerProject: number;
  totalFreeCredits: number;
  totalPackCredits: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(DomainSuggestion) private suggestionRepo: Repository<DomainSuggestion>,
    @InjectRepository(CreditAdjustment) private adjustmentRepo: Repository<CreditAdjustment>,
    private dataSource: DataSource,
  ) {}

  async getUsers(page: number, limit: number, search: string): Promise<{ data: AdminUserRow[]; total: number }> {
    const qb = this.userRepo.createQueryBuilder('u')
      .loadRelationCountAndMap('u.projectCount', 'u.projects')
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.where('u.email LIKE :search', { search: `%${search}%` });
    }

    const [users, total] = await qb.getManyAndCount();

    const data: AdminUserRow[] = users.map((u: any) => ({
      id: u.id,
      keycloakId: u.keycloakId,
      email: u.email,
      credits: u.credits,
      extraCredits: u.extraCredits,
      totalCredits: u.credits + u.extraCredits,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      projectCount: u.projectCount ?? 0,
    }));

    return { data, total };
  }

  async adjustCredits(userId: number, delta: number, reason: string, adminSub: string): Promise<AdminUserRow> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    // Appliquer le delta sur extraCredits (crédits permanents)
    user.extraCredits = Math.max(0, user.extraCredits + delta);
    await this.userRepo.save(user);

    // Enregistrer l'ajustement pour audit
    const adjustment = this.adjustmentRepo.create({ userId, delta, reason, adminSub });
    await this.adjustmentRepo.save(adjustment);

    return {
      id: user.id,
      keycloakId: user.keycloakId,
      email: user.email,
      credits: user.credits,
      extraCredits: user.extraCredits,
      totalCredits: user.credits + user.extraCredits,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      projectCount: await this.projectRepo.count({ where: { user: { id: userId } } }),
    };
  }

  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const date7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const date30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers7, activeUsers30, newUsers7, newUsers30] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.createQueryBuilder('u').where('u.lastLogin >= :d', { d: date7 }).getCount(),
      this.userRepo.createQueryBuilder('u').where('u.lastLogin >= :d', { d: date30 }).getCount(),
      this.userRepo.createQueryBuilder('u').where('u.createdAt >= :d', { d: date7 }).getCount(),
      this.userRepo.createQueryBuilder('u').where('u.createdAt >= :d', { d: date30 }).getCount(),
    ]);

    const [totalProjects, totalSuggestions] = await Promise.all([
      this.projectRepo.count(),
      this.suggestionRepo.count(),
    ]);

    const avgSuggestionsResult = await this.dataSource.query(
      `SELECT AVG(cnt) as avg FROM (SELECT COUNT(*) as cnt FROM domain_suggestion GROUP BY projectId) sub`
    );
    const avgFavoritesResult = await this.dataSource.query(
      `SELECT AVG(cnt) as avg FROM (SELECT COUNT(*) as cnt FROM domain_suggestion WHERE isFavorite = 1 GROUP BY projectId) sub`
    );

    const creditsResult = await this.dataSource.query(
      `SELECT SUM(credits) as free, SUM(extraCredits) as pack FROM user`
    );

    return {
      totalUsers,
      activeUsers7,
      activeUsers30,
      newUsers7,
      newUsers30,
      totalProjects,
      totalSuggestions,
      avgSuggestionsPerProject: Math.round((avgSuggestionsResult[0]?.avg ?? 0) * 10) / 10,
      avgFavoritesPerProject: Math.round((avgFavoritesResult[0]?.avg ?? 0) * 10) / 10,
      totalFreeCredits: creditsResult[0]?.free ?? 0,
      totalPackCredits: creditsResult[0]?.pack ?? 0,
    };
  }
}
