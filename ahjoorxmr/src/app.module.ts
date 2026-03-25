import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { StellarAuthModule } from './stellar-auth/auth.module';
import { UsersModule } from './users/users.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ContributionsModule } from './contributions/contributions.module';
import { AuditModule } from './audit/audit.module';
import { GroupsModule } from './groups/groups.module';
import { QueueModule } from './bullmq/queue.module';
import { Membership } from './memberships/entities/membership.entity';
import { Group } from './groups/entities/group.entity';
import { User } from './users/entities/user.entity';
import { Contribution } from './contributions/entities/contribution.entity';
import { AuditLog } from './audit/entities/audit-log.entity';
import { JwtAuthGuard } from './stellar-auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isDevelopment =
          configService.get<string>('NODE_ENV') === 'development';
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST') || 'localhost',
          port: parseInt(configService.get<string>('DB_PORT') || '5432', 10),
          username: configService.get<string>('DB_USERNAME') || 'postgres',
          password: configService.get<string>('DB_PASSWORD') || 'postgres',
          database: configService.get<string>('DB_NAME') || 'ahjoorxmr',
          entities: [Membership, Group, User, Contribution, AuditLog],
          synchronize: isDevelopment, // Auto-create tables only in development
          logging: isDevelopment, // Enable logging only in development
        };
      },
      inject: [ConfigService],
    }),
    HealthModule,
    AuthModule,
    StellarAuthModule,
    UsersModule,
    MembershipsModule,
    ContributionsModule,
    AuditModule,
    GroupsModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
