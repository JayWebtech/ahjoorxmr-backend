import { Module, OnApplicationShutdown, Logger, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './common/redis/redis.module';
import { CacheInterceptor } from './common/interceptors/cache.interceptor';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ContributionsModule } from './contributions/contributions.module';
import { RedisModule } from './common/redis/redis.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { Membership } from './memberships/entities/membership.entity';
import { Group } from './groups/entities/group.entity';
import { User } from './users/entities/user.entity';
import { Contribution } from './contributions/entities/contribution.entity';
import { AuditLog } from './audit/entities/audit-log.entity';
import { StellarModule } from './stellar/stellar.module';
import { EventListenerModule } from './event-listener/event-listener.module';
import { CustomThrottlerModule } from './throttler/throttler.module';
import { AuditModule } from './audit/audit.module';
import { SeedModule } from './database/seeds/seed.module';

@Module({
  imports: [
    // ConfigModule must be first to make environment variables available
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TypeORM configuration with PostgreSQL
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

    // RedisModule for caching and session management
    RedisModule,
    CustomThrottlerModule,
    SchedulerModule,
    HealthModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    MembershipsModule,
    ContributionsModule,
    StellarModule,
    EventListenerModule,
    AuditModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule implements OnApplicationShutdown {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Graceful shutdown handler for SIGTERM and SIGINT signals.
   * Ensures in-flight requests complete and resources are properly released.
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    const startTime = Date.now();
    this.logger.log(
      `[${new Date().toISOString()}] Received shutdown signal: ${signal || 'UNKNOWN'}`,
    );

    try {
      // Step 1: Stop accepting new HTTP requests (handled by NestJS automatically)
      this.logger.log(
        `[${new Date().toISOString()}] Step 1: Stopped accepting new HTTP requests`,
      );

      // Step 2: Wait for in-flight HTTP requests to complete
      // NestJS handles this automatically when app.close() is called
      this.logger.log(
        `[${new Date().toISOString()}] Step 2: Waiting for in-flight HTTP requests to complete`,
      );

      // Step 3: Close BullMQ workers (drain active jobs)
      // BullMQ workers are closed automatically via their OnModuleDestroy hooks
      this.logger.log(
        `[${new Date().toISOString()}] Step 3: Draining BullMQ workers (active jobs will complete)`,
      );

      // Step 4: Close database connections
      if (this.dataSource.isInitialized) {
        this.logger.log(
          `[${new Date().toISOString()}] Step 4: Closing database connections`,
        );
        await this.dataSource.destroy();
        this.logger.log(
          `[${new Date().toISOString()}] Database connections closed successfully`,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[${new Date().toISOString()}] Graceful shutdown completed in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error(
        `[${new Date().toISOString()}] Error during graceful shutdown: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
