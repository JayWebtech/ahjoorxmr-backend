# Performance Baselines

This document records performance baselines for the Ahjoorxmr API. Baselines are established on initial deployment and updated on each major release to detect performance regressions.

## Baseline Establishment Date

**Date**: April 24, 2026  
**Environment**: Docker Compose (PostgreSQL 16, Redis 7, Node.js 20)  
**Test Duration**: 60 seconds per scenario

## Load Test Scenarios

### 1. Authentication & Login (auth-login.js)

**Target Load**: 1000 RPS (requests per second)  
**Ramp Profile**: 0 → 100 → 1000 → 0 users over 70 seconds

**SLO Thresholds**:

- p95 latency: < 500ms
- p99 latency: < 1000ms
- Error rate: < 1%

**Baseline Results** (to be populated after first run):

- p95 latency: _pending_
- p99 latency: _pending_
- Error rate: _pending_
- Throughput: _pending_ RPS

### 2. Group Listing (group-listing.js)

**Target Load**: 500 RPS  
**Ramp Profile**: 0 → 50 → 500 → 0 users over 70 seconds

**SLO Thresholds**:

- p95 latency: < 500ms
- p99 latency: < 1000ms
- Error rate: < 1%

**Baseline Results** (to be populated after first run):

- p95 latency: _pending_
- p99 latency: _pending_
- Error rate: _pending_
- Throughput: _pending_ RPS

### 3. Contribution Submission (contribution-submit.js)

**Target Load**: 100 RPS  
**Ramp Profile**: 0 → 10 → 100 → 0 users over 70 seconds

**SLO Thresholds**:

- p95 latency: < 500ms
- p99 latency: < 1000ms
- Error rate: < 1%

**Baseline Results** (to be populated after first run):

- p95 latency: _pending_
- p99 latency: _pending_
- Error rate: _pending_
- Throughput: _pending_ RPS

## Running Load Tests

### Prerequisites

- Docker and Docker Compose installed
- k6 CLI installed (https://k6.io/docs/getting-started/installation/)
- Node.js 20+ and npm

### Setup

```bash
cd load-tests

# Start infrastructure (PostgreSQL, Redis, WireMock, App)
docker-compose up -d

# Wait for app to be healthy
docker-compose logs -f app | grep "Listening on"
```

### Run Individual Tests

```bash
# Auth/Login test
k6 run --vus 100 --duration 60s auth-login.js

# Group listing test
k6 run --vus 50 --duration 60s group-listing.js

# Contribution submission test
k6 run --vus 10 --duration 60s contribution-submit.js
```

### Run All Tests with Custom Base URL

```bash
BASE_URL=http://localhost:3000 k6 run auth-login.js
BASE_URL=http://localhost:3000 k6 run group-listing.js
BASE_URL=http://localhost:3000 k6 run contribution-submit.js
```

### Cleanup

```bash
docker-compose down -v
```

## Regression Detection

If any test fails to meet SLO thresholds:

1. **Investigate**: Check application logs, database query performance, and resource utilization
2. **Profile**: Use Prometheus metrics and OpenTelemetry traces to identify bottlenecks
3. **Optimize**: Address the root cause (query optimization, caching, connection pooling, etc.)
4. **Re-test**: Verify the fix meets SLO thresholds
5. **Document**: Update this baseline if the regression is intentional (e.g., new feature adds latency)

## Historical Baselines

| Date       | Version | p95 Latency (Auth) | p95 Latency (Groups) | p95 Latency (Contributions) | Notes            |
| ---------- | ------- | ------------------ | -------------------- | --------------------------- | ---------------- |
| 2026-04-24 | 0.0.1   | _pending_          | _pending_            | _pending_                   | Initial baseline |

## Infrastructure Specifications

- **Database**: PostgreSQL 16 Alpine
- **Cache**: Redis 7 Alpine
- **API Mocking**: WireMock 3.0.1
- **Load Generator**: k6 (latest)
- **Node.js**: 20.x LTS

## Notes

- Tests use WireMock to mock Stellar API calls for deterministic results
- Each test creates its own test data to avoid state pollution
- Tests run sequentially; run them in parallel for full-stack load testing
- Baseline thresholds are conservative; adjust based on production requirements
