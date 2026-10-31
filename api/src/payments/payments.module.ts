import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { UsersModule } from '../users/users.module';
import { StripeEvent } from './entities/stripe-event.entity';
import { Paiement } from './entities/paiement.entity';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([StripeEvent, Paiement])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
