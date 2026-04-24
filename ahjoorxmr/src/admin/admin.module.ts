import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard';
import { AdminController } from './admin.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [
    ApiKeysModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        secret: cs.get<string>('JWT_ACCESS_SECRET') || 'default_access_secret',
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [AdminGuard],
  exports: [AdminGuard],
})
export class AdminModule {}
