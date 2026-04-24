import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 }, // Ramp up to 100 users
    { duration: '30s', target: 1000 }, // Ramp up to 1000 users (1000 RPS)
    { duration: '20s', target: 1000 }, // Stay at 1000 users
    { duration: '10s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // p95 < 500ms, p99 < 1000ms
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test data
  const walletAddress = `GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIBTCRHQCW74W7NIUML4TJJLQ${Math.floor(Math.random() * 1000000)}`;
  const email = `user${Math.floor(Math.random() * 1000000)}@example.com`;
  const password = 'TestPassword123!';

  // Register user
  const registerPayload = JSON.stringify({
    walletAddress,
    email,
    password,
  });

  const registerRes = http.post(`${BASE_URL}/api/v1/auth/register`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(registerRes, {
    'register status is 201': (r) => r.status === 201,
    'register has access token': (r) => r.json('accessToken') !== undefined,
  });

  // Extract token
  const accessToken = registerRes.json('accessToken');

  // Login
  const loginPayload = JSON.stringify({
    email,
    password,
  });

  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has access token': (r) => r.json('accessToken') !== undefined,
    'login response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
