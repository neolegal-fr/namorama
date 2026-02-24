import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { UsersModule } from '../users/users.module';
import { StripeEvent } from './entities/stripe-event.entity';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([StripeEvent])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
