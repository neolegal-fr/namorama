import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ModelCostsService } from './model-costs.service';
import { ModelPricesService } from './model-prices.service';
import { RetentionService } from './retention.service';
import { AdminMailService } from './admin-mail.service';
import { AdminMail } from './entities/admin-mail.entity';
import { ModelPrice } from '../common/model-usage/model-price.entity';
import { CreditAdjustment } from './entities/credit-adjustment.entity';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { DomainSuggestion } from '../projects/entities/domain-suggestion.entity';
import { BrandReportRecord } from '../brand-report/entities/brand-report-record.entity';
import { FeedbackModule } from '../feedback/feedback.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditAdjustment, AdminMail, User, Project, DomainSuggestion, BrandReportRecord, ModelPrice]),
    FeedbackModule,
    UsersModule,
    MailModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, ModelCostsService, ModelPricesService, RetentionService, AdminMailService],
})
export class AdminModule {}
