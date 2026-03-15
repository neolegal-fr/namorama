import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './feedback.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

const CREDITS_REWARD = 500;

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private feedbackRepo: Repository<Feedback>,
    private usersService: UsersService,
    private mailService: MailService,
  ) {}

  async submit(keycloakId: string | null, message: string, email?: string): Promise<{ creditsAwarded: boolean }> {
    const feedback = this.feedbackRepo.create({
      keycloakId: keycloakId ?? null,
      message: message.trim(),
      email: email?.trim() || null,
    });
    await this.feedbackRepo.save(feedback);

    // Fire-and-forget — ne bloque pas la réponse si l'envoi échoue
    this.mailService.sendFeedbackNotification({
      message: feedback.message,
      email: feedback.email,
      keycloakId: feedback.keycloakId,
    }).catch(() => {/* already logged in MailService */});

    return { creditsAwarded: false };
  }

  async awardCredits(feedbackId: string): Promise<Feedback> {
    const feedback = await this.feedbackRepo.findOne({ where: { id: feedbackId } });
    if (!feedback) throw new NotFoundException('Feedback not found');
    if (feedback.creditAwarded) throw new BadRequestException('Credits already awarded');
    if (feedback.rejected) throw new BadRequestException('Feedback already rejected');
    if (!feedback.keycloakId) throw new BadRequestException('Anonymous feedback — no user to reward');

    const user = await this.usersService.addExtraCredits(feedback.keycloakId, CREDITS_REWARD);
    feedback.creditAwarded = true;
    const saved = await this.feedbackRepo.save(feedback);

    // Envoie le mail de récompense si on a une adresse de destination
    const rewardTo = user?.email || feedback.email;
    if (rewardTo && user) {
      this.mailService.sendRewardEmail({
        to: rewardTo,
        firstName: user.firstName ?? null,
        locale: user.locale ?? null,
        creditsAwarded: CREDITS_REWARD,
        totalCredits: user.totalCredits,
      }).catch(() => {/* already logged in MailService */});
    }

    return saved;
  }

  async reject(feedbackId: string): Promise<Feedback> {
    const feedback = await this.feedbackRepo.findOne({ where: { id: feedbackId } });
    if (!feedback) throw new NotFoundException('Feedback not found');
    if (feedback.creditAwarded) throw new BadRequestException('Credits already awarded');
    if (feedback.rejected) throw new BadRequestException('Feedback already rejected');

    feedback.rejected = true;
    return this.feedbackRepo.save(feedback);
  }

  async delete(feedbackId: string): Promise<void> {
    const feedback = await this.feedbackRepo.findOne({ where: { id: feedbackId } });
    if (!feedback) throw new NotFoundException('Feedback not found');
    await this.feedbackRepo.remove(feedback);
  }

  async findAll(): Promise<Feedback[]> {
    return this.feedbackRepo.find({ order: { createdAt: 'DESC' } });
  }
}
