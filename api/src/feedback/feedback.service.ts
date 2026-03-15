import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './feedback.entity';
import { UsersService } from '../users/users.service';

const CREDITS_REWARD = 1000;
const RATE_LIMIT_DAYS = 30;

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private feedbackRepo: Repository<Feedback>,
    private usersService: UsersService,
  ) {}

  async submit(keycloakId: string, message: string, email?: string): Promise<void> {
    // Rate limit : 1 feedback par 30 jours par utilisateur
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RATE_LIMIT_DAYS);

    const recent = await this.feedbackRepo.findOne({
      where: { keycloakId },
      order: { createdAt: 'DESC' },
    });

    if (recent && recent.createdAt > cutoff) {
      throw new BadRequestException('RATE_LIMIT');
    }

    const feedback = this.feedbackRepo.create({
      keycloakId,
      message: message.trim(),
      email: email?.trim() || null,
    });
    await this.feedbackRepo.save(feedback);

    await this.usersService.addExtraCredits(keycloakId, CREDITS_REWARD);
  }

  async findAll(): Promise<Feedback[]> {
    return this.feedbackRepo.find({ order: { createdAt: 'DESC' } });
  }
}
