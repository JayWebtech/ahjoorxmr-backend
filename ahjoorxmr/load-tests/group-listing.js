import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 }, // Ramp up to 50 users
    { duration: '30s', target: 500 }, // Ramp up to 500 users (500 RPS)
    { duration: '20s', target: 500 }, // Stay at 500 users
    { duration: '10s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // p95 < 500ms, p99 < 1000ms
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Setup: Create a test user and get auth token
export function setup() {
  const walletAddress = `GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIBTCRHQCW74W7NIUML4TJJLQ${Math.floor(Math.random() * 1000000)}`;
  const email = `user${Math.floor(Math.random() * 1000000)}@example.com`;
  const password = 'TestPassword123!';

  const registerPayload = JSON.stringify({
    walletAddress,
    email,
    password,
  });

  const registerRes = http.post(`${BASE_URL}/api/v1/auth/register`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  return {
    accessToken: registerRes.json('accessToken'),
  };
}

export default function (data) {
  const accessToken = data.accessToken;

  // List groups with pagination
  const params = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  const page = Math.floor(Math.random() * 10) + 1;
  const limit = 20;

  const res = http.get(`${BASE_URL}/api/v1/groups?page=${page}&limit=${limit}`, params);

  check(res, {
    'list groups status is 200': (r) => r.status === 200,
    'list groups has data': (r) => r.json('data') !== undefined,
    'list groups response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
