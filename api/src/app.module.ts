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
        synchronize: true, // Désactiver en production
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
    DomainModule,
    UsersModule,
    ProjectsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
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
