import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DomainModule } from './domain/domain.module';
import { 
  KeycloakConnectModule, 
  ResourceGuard, 
  RoleGuard, 
  AuthGuard,
  PolicyEnforcementMode,
  TokenValidation
} from 'nest-keycloak-connect';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { FeedbackModule } from './feedback/feedback.module';
import { BrandReportModule } from './brand-report/brand-report.module';
import { LoggingModule } from './common/logging/logging.module';
import { FunnelModule } from './common/funnel/funnel.module';
import { ModelUsageModule } from './common/model-usage/model-usage.module';
import { EventsController } from './events/events.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mariadb',
        url: config.get('DATABASE_URL'),
        autoLoadEntities: true,
        // `synchronize` laisse TypeORM réécrire le schéma pour le faire
        // correspondre aux entités à chaque démarrage. Sur une base de
        // production — comptes, projets, paiements — c'est une opération
        // destructrice lancée sans relecture : le défaut est donc « non », et
        // l'activation demande un geste explicite.
        //
        // `NODE_ENV` ne peut pas servir de garde : il n'est défini nulle part
        // dans ce projet (ni Dockerfile, ni compose, ni `.env`), donc un test
        // `NODE_ENV !== 'production'` laisserait la synchronisation ACTIVE en
        // production. L'opt-in explicite est le seul défaut qui échoue du bon
        // côté.
        synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
      }),
      inject: [ConfigService],
    }),
    KeycloakConnectModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        authServerUrl: config.get('KEYCLOAK_AUTH_SERVER_URL') || '',
        realm: config.get('KEYCLOAK_REALM') || '',
        clientId: config.get('KEYCLOAK_CLIENT_ID') || '',
        secret: config.get('KEYCLOAK_SECRET') || '',
        policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
        tokenValidation: TokenValidation.OFFLINE,
      }),
      inject: [ConfigService],
    }),
    LoggingModule,
    FunnelModule,
    ModelUsageModule,
    DomainModule,
    UsersModule,
    ProjectsModule,
    PaymentsModule,
    AdminModule,
    FeedbackModule,
    BrandReportModule,
  ],
  controllers: [AppController, EventsController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ResourceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
  ],
})
export class AppModule {}
