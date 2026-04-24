import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Ramp up to 10 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users (100 RPS)
    { duration: '20s', target: 100 }, // Stay at 100 users
    { duration: '10s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // p95 < 500ms, p99 < 1000ms
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Setup: Create test user, group, and membership
export function setup() {
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

  const accessToken = registerRes.json('accessToken');

  // Create group
  const groupPayload = JSON.stringify({
    name: `Load Test Group ${Date.now()}`,
    contributionAmount: '100',
    token: 'XLM',
    roundDuration: 7,
    totalRounds: 12,
    minMembers: 2,
    maxMembers: 10,
  });

  const groupRes = http.post(`${BASE_URL}/api/v1/groups`, groupPayload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const groupId = groupRes.json('id');

  return {
    accessToken,
    groupId,
    walletAddress,
  };
}

export default function (data) {
  const { accessToken, groupId, walletAddress } = data;

  // Submit contribution
  const contributionPayload = JSON.stringify({
    amount: '100',
    transactionHash: `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    roundNumber: 1,
  });

  const params = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(
    `${BASE_URL}/api/v1/groups/${groupId}/contributions`,
    contributionPayload,
    params,
  );

  check(res, {
    'contribution status is 201 or 400': (r) => r.status === 201 || r.status === 400, // 400 if already contributed
    'contribution response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
