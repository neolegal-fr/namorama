import { Module } from '@nestjs/common';
import { DomainService } from './domain.service';
import { DomainController } from './domain.controller';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [UsersModule, ProjectsModule],
  providers: [DomainService],
  controllers: [DomainController]
})
export class DomainModule {}
