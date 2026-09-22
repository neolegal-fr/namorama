import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelUsage } from './model-usage.entity';
import { ModelPrice } from './model-price.entity';
import { ModelUsageService } from './model-usage.service';
import { ContexteAppelInterceptor } from './contexte-appel';

/**
 * Global, comme la journalisation : les appels au modèle partent de deux
 * modules (domain, brand-report), et le relevé doit les voir tous.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ModelUsage, ModelPrice])],
  providers: [
    ModelUsageService,
    { provide: APP_INTERCEPTOR, useClass: ContexteAppelInterceptor },
  ],
  exports: [ModelUsageService],
})
export class ModelUsageModule {}
