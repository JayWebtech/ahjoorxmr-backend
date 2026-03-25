# RBAC Setup Instructions

## Quick Start

### 1. Install Dependencies (if needed)
```bash
npm install @nestjs/passport passport passport-jwt
npm install @types/passport-jwt --save-dev
```

### 2. Run Database Migration
```bash
npm run migration:run
```

This will:
- Add `walletAddress`, `role`, and `refreshTokenHash` columns to users table
- Create `audit_logs` table
- Set up necessary indexes

### 3. Configure Environment Variables

Add to your `.env` file:

```env
# JWT Configuration (RS256 for access tokens)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...your private key...
-----END RSA PRIVATE KEY-----"

JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
...your public key...
-----END PUBLIC KEY-----"

JWT_ACCESS_EXPIRES_IN=15m

# JWT Refresh Token (HS256)
JWT_REFRESH_SECRET=your-secure-random-secret-here
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=ahjoorxmr
NODE_ENV=development
```

### 4. Generate RSA Keys (if you don't have them)

```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# View keys (copy to .env)
cat private.pem
cat public.pem
```

### 5. Create Your First Admin User

After a user authenticates for the first time, promote them to admin:

```sql
-- Find your user
SELECT id, wallet_address, role FROM users;

-- Promote to admin
UPDATE users SET role = 'admin' WHERE wallet_address = 'YOUR_WALLET_ADDRESS';
```

Or use the UsersService programmatically:

```typescript
await usersService.updateRole(userId, UserRole.ADMIN);
```

### 6. Test the Implementation

```bash
# Run unit tests
npm run test -- roles.guard.spec
npm run test -- jwt.strategy.spec

# Run e2e tests
npm run test:e2e -- rbac.e2e-spec
npm run test:e2e -- auth-role.e2e-spec
```

### 7. Verify RBAC is Working

#### Test with cURL:

```bash
# 1. Get a challenge
curl -X POST http://localhost:3000/api/v1/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "YOUR_WALLET_ADDRESS"}'

# 2. Sign the challenge with your Stellar wallet and verify
curl -X POST http://localhost:3000/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YOUR_WALLET_ADDRESS",
    "signature": "BASE64_SIGNATURE",
    "challenge": "CHALLENGE_MESSAGE"
  }'

# 3. Use the access token to test admin endpoints
# As regular user (should get 403)
curl -X GET http://localhost:3000/api/v1/admin/queue/stats \
  -H "Authorization: Bearer YOUR_USER_TOKEN"

# As admin (should get 200)
curl -X GET http://localhost:3000/api/v1/admin/queue/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Protected Endpoints

All these endpoints now require admin role:

### Queue Management
- `GET /api/v1/admin/queue/stats` - View queue statistics
- `GET /api/v1/admin/queue/dead-letter` - View dead letter queue
- `POST /api/v1/admin/queue/retry` - Retry failed jobs

### Audit Logs
- `GET /api/v1/audit` - View audit logs (with pagination/filtering)

### Group Management
- `DELETE /api/v1/groups/:id` - Delete a group

## Troubleshooting

### Issue: "User not found" error
**Solution**: Make sure the user exists in the database. Users are created automatically on first authentication via `upsertByWalletAddress`.

### Issue: "Insufficient permissions" (403)
**Solution**: Check the user's role in the database:
```sql
SELECT id, wallet_address, role FROM users WHERE wallet_address = 'YOUR_WALLET';
```

### Issue: "Invalid or expired token" (401)
**Solution**: 
- Verify JWT_PUBLIC_KEY matches JWT_PRIVATE_KEY
- Check token hasn't expired (default: 15 minutes)
- Use refresh token to get new access token

### Issue: Guards not working
**Solution**: 
- Ensure JwtAuthGuard is registered globally in AppModule
- Verify guards are in correct order: `@UseGuards(JwtAuthGuard, RolesGuard)`
- Check that StellarAuthModule is imported in AppModule

### Issue: Migration fails
**Solution**:
- Ensure PostgreSQL is running
- Check database credentials in .env
- Verify uuid-ossp extension is enabled: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

## Architecture Overview

```
Request Flow:
1. Client sends JWT in Authorization header
2. JwtAuthGuard validates JWT signature
3. JwtStrategy.validate() loads user from database
4. User object (with role) attached to request
5. RolesGuard checks if user.role matches required roles
6. If authorized, controller method executes
7. If not authorized, 403 Forbidden returned
```

## Role Hierarchy

Currently implemented roles:
- `admin` - Full access to all admin endpoints
- `moderator` - Can be used for future moderation features
- `user` - Default role, no admin access

## Security Best Practices

1. **Never expose JWT_PRIVATE_KEY** - Keep it secret and secure
2. **Use strong JWT_REFRESH_SECRET** - Generate with: `openssl rand -base64 64`
3. **Rotate keys periodically** - Especially if compromised
4. **Monitor audit logs** - Track admin actions
5. **Use HTTPS in production** - Protect tokens in transit
6. **Set appropriate token expiry** - Balance security vs UX
7. **Implement rate limiting** - Prevent brute force attacks

## Next Steps

1. **Add audit logging to admin actions**:
   ```typescript
   await auditService.createLog('DELETE_GROUP', 'group', groupId, user.id);
   ```

2. **Create admin management endpoints**:
   - Promote/demote users
   - List all admins
   - View admin activity

3. **Add more granular permissions**:
   - Create permission system beyond roles
   - Implement resource-based access control

4. **Set up monitoring**:
   - Alert on failed auth attempts
   - Track admin endpoint usage
   - Monitor role changes

## Support

For issues or questions:
1. Check the RBAC_IMPLEMENTATION.md for detailed documentation
2. Review the e2e tests for usage examples
3. Check application logs for error details
