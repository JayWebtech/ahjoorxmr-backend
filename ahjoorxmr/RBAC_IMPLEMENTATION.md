# RBAC Implementation Guide

## Overview
This document describes the Role-Based Access Control (RBAC) implementation for admin endpoints in the ahjoorxmr backend.

## Components Implemented

### 1. User Entity with Roles
- **File**: `src/users/entities/user.entity.ts`
- **Features**:
  - Added `role` field with enum: `admin`, `user`, `moderator`
  - Added `walletAddress` field (unique, indexed)
  - Added `refreshTokenHash` field for token revocation
  - Default role: `user`

### 2. Decorators
- **@Roles(...roles)**: `src/common/decorators/roles.decorator.ts`
  - Marks endpoints with required roles
  - Example: `@Roles('admin')`

- **@Public()**: `src/common/decorators/public.decorator.ts`
  - Marks endpoints as publicly accessible (no auth required)
  - Example: `@Public()`

- **@CurrentUser()**: `src/common/decorators/current-user.decorator.ts`
  - Extracts user from request
  - Example: `@CurrentUser() user` or `@CurrentUser('id') userId`

### 3. Guards

#### JwtAuthGuard
- **File**: `src/stellar-auth/jwt-auth.guard.ts`
- **Purpose**: Validates JWT tokens and extracts user
- **Features**:
  - Extends Passport's AuthGuard('jwt')
  - Respects @Public() decorator
  - Applied globally via APP_GUARD
  - Returns user object with id, walletAddress, and role

#### RolesGuard
- **File**: `src/common/guards/roles.guard.ts`
- **Purpose**: Enforces role-based access control
- **Features**:
  - Checks if user has required role(s)
  - Returns 403 Forbidden if insufficient permissions
  - Must be used with JwtAuthGuard
  - Example: `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('admin')`

### 4. JWT Strategy
- **File**: `src/stellar-auth/jwt.strategy.ts`
- **Purpose**: Validates JWT and loads user data
- **Features**:
  - Uses RS256 algorithm
  - Extracts user from database
  - Includes role in request.user object
  - Throws UnauthorizedException if user not found

### 5. Protected Endpoints

#### Queue Admin Endpoints
- **Controller**: `src/bullmq/queue-admin.controller.ts`
- **Base Path**: `/api/v1/admin/queue`
- **Protection**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`
- **Endpoints**:
  - `GET /stats` - Get queue statistics
  - `GET /dead-letter` - Get dead letter queue jobs
  - `POST /retry` - Retry a failed job

#### Audit Log Endpoints
- **Controller**: `src/audit/audit.controller.ts`
- **Base Path**: `/api/v1/audit`
- **Protection**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`
- **Endpoints**:
  - `GET /` - Get audit logs with pagination and filtering

#### Groups Admin Endpoints
- **Controller**: `src/groups/groups.controller.ts`
- **Base Path**: `/api/v1/groups`
- **Protection**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`
- **Endpoints**:
  - `DELETE /:id` - Delete a group

### 6. Services

#### UsersService
- **File**: `src/users/users.service.ts`
- **Methods**:
  - `findById(id)` - Find user by ID
  - `findByWalletAddress(walletAddress)` - Find user by wallet
  - `upsertByWalletAddress(walletAddress)` - Create or get user
  - `updateRefreshTokenHash(userId, hash)` - Update refresh token
  - `updateRole(userId, role)` - Update user role

#### AuditService
- **File**: `src/audit/audit.service.ts`
- **Methods**:
  - `getAuditLogs(query)` - Get paginated audit logs
  - `createLog(action, entityType, entityId, userId, metadata)` - Create audit log

#### GroupsService
- **File**: `src/groups/groups.service.ts`
- **Methods**:
  - `deleteGroup(id)` - Delete a group

#### QueueService (Extended)
- **File**: `src/bullmq/queue.service.ts`
- **New Methods**:
  - `getDeadLetterJobs()` - Get all dead letter queue jobs
  - `retryDeadLetterJob(jobId)` - Retry a failed job

### 7. Database Migration
- **File**: `migrations/1740500000000-AddUserRoleAndAuth.ts`
- **Changes**:
  - Add `walletAddress` column to users (unique, indexed)
  - Add `role` enum column to users (default: 'user')
  - Add `refreshTokenHash` column to users
  - Create `audit_logs` table with indexes

### 8. E2E Tests

#### RBAC Tests
- **File**: `test/rbac.e2e-spec.ts`
- **Coverage**:
  - Admin access to protected endpoints (200 OK)
  - Non-admin access to protected endpoints (403 Forbidden)
  - Unauthenticated access (401 Unauthorized)
  - Guard stacking (JwtAuthGuard + RolesGuard)
  - Role propagation through auth flow

#### Auth Role Tests
- **File**: `test/auth-role.e2e-spec.ts`
- **Coverage**:
  - Token generation includes role
  - Default role assignment
  - Role updates
  - JWT strategy validation

### 9. Unit Tests

#### RolesGuard Tests
- **File**: `src/common/guards/roles.guard.spec.ts`
- **Coverage**:
  - Allow access with correct role
  - Deny access with incorrect role
  - Allow access when no roles required
  - Handle missing user/role

#### JwtStrategy Tests
- **File**: `src/stellar-auth/jwt.strategy.spec.ts`
- **Coverage**:
  - Validate JWT payload
  - Load user from database
  - Include role in user object
  - Throw error for non-existent user

## Usage Examples

### Protecting an Endpoint

```typescript
@Controller('api/v1/admin/resource')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ResourceController {
  @Get()
  async getResources() {
    // Only admins can access
  }
}
```

### Public Endpoint

```typescript
@Controller('api/v1/auth')
export class AuthController {
  @Public()
  @Post('login')
  async login() {
    // Anyone can access
  }
}
```

### Multiple Roles

```typescript
@Get('moderator-or-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'moderator')
async getResource() {
  // Admins or moderators can access
}
```

### Accessing Current User

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user) {
  // user contains: { id, walletAddress, role }
  return user;
}
```

## Testing

### Run E2E Tests
```bash
npm run test:e2e -- rbac.e2e-spec.ts
npm run test:e2e -- auth-role.e2e-spec.ts
```

### Run Unit Tests
```bash
npm run test -- roles.guard.spec.ts
npm run test -- jwt.strategy.spec.ts
```

## Environment Variables Required

```env
# JWT Configuration
JWT_PRIVATE_KEY=<RS256 private key>
JWT_PUBLIC_KEY=<RS256 public key>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<HS256 secret>
JWT_REFRESH_EXPIRES_IN=7d

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=ahjoorxmr
NODE_ENV=development
```

## Migration Instructions

1. **Run the migration**:
   ```bash
   npm run migration:run
   ```

2. **Create an admin user** (via database or admin script):
   ```sql
   UPDATE users SET role = 'admin' WHERE wallet_address = 'YOUR_WALLET_ADDRESS';
   ```

3. **Verify RBAC**:
   - Try accessing admin endpoints with regular user token (should get 403)
   - Try accessing admin endpoints with admin token (should get 200)

## Security Considerations

1. **Global JWT Guard**: JwtAuthGuard is applied globally, so all endpoints require authentication by default unless marked with @Public()

2. **Role Propagation**: User role is loaded from database on every request via JwtStrategy, ensuring up-to-date permissions

3. **Token Revocation**: Refresh tokens can be revoked by clearing refreshTokenHash

4. **Audit Logging**: All admin actions should be logged to audit_logs table

5. **Guard Order**: Always use guards in order: `@UseGuards(JwtAuthGuard, RolesGuard)` - JWT must be validated before checking roles

## Acceptance Criteria Status

✅ Non-admin JWT returns 403 Forbidden on admin endpoints
✅ Admin JWT has access to all admin endpoints
✅ RolesGuard is compatible with JwtAuthGuard (both can be stacked)
✅ E2e tests cover both 403 and 200 cases
✅ @Roles decorator created and applied
✅ RolesGuard created and applied
✅ JWT payload includes role
✅ Role is propagated by all guards
✅ Admin endpoints protected:
  - GET /api/v1/admin/queue/stats
  - GET /api/v1/admin/queue/dead-letter
  - POST /api/v1/admin/queue/retry
  - GET /api/v1/audit
  - DELETE /api/v1/groups/:id
