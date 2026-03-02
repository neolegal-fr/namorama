import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CreditAdjustment } from './entities/credit-adjustment.entity';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { DomainSuggestion } from '../projects/entities/domain-suggestion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CreditAdjustment, User, Project, DomainSuggestion])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
