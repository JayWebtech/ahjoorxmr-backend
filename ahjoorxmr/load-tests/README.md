# Load Testing Suite

This directory contains k6 load testing scripts and infrastructure for performance testing the Ahjoorxmr API.

## Quick Start

```bash
# Start infrastructure
docker-compose up -d

# Wait for app to be healthy
sleep 30

# Run a load test
k6 run auth-login.js

# View results
docker-compose logs app

# Cleanup
docker-compose down -v
```

## Test Scripts

### auth-login.js

Tests authentication and login endpoints under high load (1000 RPS).

**Endpoints tested**:

- POST /api/v1/auth/register
- POST /api/v1/auth/login

**SLO**: p95 < 500ms, error rate < 1%

### group-listing.js

Tests group listing endpoint with pagination (500 RPS).

**Endpoints tested**:

- GET /api/v1/groups?page=X&limit=20

**SLO**: p95 < 500ms, error rate < 1%

### contribution-submit.js

Tests contribution submission endpoint (100 RPS).

**Endpoints tested**:

- POST /api/v1/groups/:id/contributions

**SLO**: p95 < 500ms, error rate < 1%

## Infrastructure

The `docker-compose.yml` file spins up:

- **PostgreSQL 16**: Primary database
- **Redis 7**: Cache and session store
- **WireMock 3.0.1**: Mocks Stellar API for deterministic testing
- **App**: Ahjoorxmr backend service

All services are configured with health checks and automatic restart.

## Configuration

### Environment Variables

Set via `docker-compose.yml`:

- `BASE_URL`: API base URL (default: http://localhost:3000)
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`: Database config
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Redis config
- `STELLAR_RPC_URL`: Points to WireMock for mocking

### k6 Options

Each script defines:

- **Stages**: Ramp-up, sustained load, ramp-down profile
- **Thresholds**: SLO definitions (latency, error rate)
- **Checks**: Assertions on response status, timing, content

## Running Tests

### Single Test

```bash
k6 run auth-login.js
```

### With Custom Base URL

```bash
BASE_URL=http://staging.example.com k6 run auth-login.js
```

### With Custom VUs and Duration

```bash
k6 run --vus 500 --duration 120s auth-login.js
```

### All Tests Sequentially

```bash
k6 run auth-login.js && k6 run group-listing.js && k6 run contribution-submit.js
```

### All Tests in Parallel (requires multiple terminals)

```bash
# Terminal 1
k6 run auth-login.js

# Terminal 2
k6 run group-listing.js

# Terminal 3
k6 run contribution-submit.js
```

## Interpreting Results

k6 outputs:

- **http_req_duration**: Response time distribution (min, avg, max, p95, p99)
- **http_req_failed**: Percentage of failed requests
- **http_reqs**: Total requests completed
- **vus**: Virtual users active during test

Example output:

```
     data_received..................: 2.5 MB   41 kB/s
     data_sent.......................: 1.2 MB   20 kB/s
     http_req_duration...............: avg=245ms  p(95)=480ms  p(99)=890ms
     http_req_failed.................: 0.5%
     http_reqs.......................: 12000
     vus............................: 0
     vus_max.........................: 1000
```

**Interpretation**:

- ✅ p95 (480ms) < 500ms threshold → PASS
- ✅ Error rate (0.5%) < 1% threshold → PASS
- ✅ Throughput: 12,000 requests in 60s = 200 RPS average

## Troubleshooting

### App fails to start

```bash
# Check logs
docker-compose logs app

# Verify database is ready
docker-compose logs postgres

# Restart app
docker-compose restart app
```

### Tests fail with connection errors

```bash
# Ensure app is healthy
curl http://localhost:3000/health

# Check firewall/port conflicts
lsof -i :3000
```

### High latency or errors

1. Check app logs: `docker-compose logs app`
2. Check database performance: `docker-compose exec postgres psql -U postgres -d ahjoorxmr -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"`
3. Check Redis: `docker-compose exec redis redis-cli INFO stats`
4. Monitor resources: `docker stats`

## CI/CD Integration

To run load tests in CI/CD:

```yaml
# Example GitHub Actions
- name: Run Load Tests
  run: |
    cd load-tests
    docker-compose up -d
    sleep 30
    k6 run auth-login.js
    k6 run group-listing.js
    k6 run contribution-submit.js
    docker-compose down -v
```

## Performance Baselines

See `../docs/performance-baselines.md` for:

- Baseline metrics from initial run
- SLO thresholds
- Historical performance trends
- Regression detection procedures

## References

- [k6 Documentation](https://k6.io/docs/)
- [WireMock Documentation](https://wiremock.org/docs/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/load-testing/)
