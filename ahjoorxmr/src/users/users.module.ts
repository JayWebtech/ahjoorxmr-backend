import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { UsersService } from './users.service';
import { AdminUsersController } from './admin-users.controller';
import { GdprModule } from './gdpr.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ProfileCompletenessService } from './services/profile-completeness.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), GdprModule, ApiKeysModule],
  controllers: [UsersController, AdminUsersController],
  providers: [UserRepository, UsersService, ProfileCompletenessService],
  exports: [UserRepository, UsersService, ProfileCompletenessService, TypeOrmModule],
})
export class UsersModule { }
