import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Test rate limiting effectiveness
const rateLimitHit = new Rate('rate_limit_hit');
const rateLimitBypassed = new Rate('rate_limit_bypassed');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Normal load
    { duration: '2m', target: 100 },  // Increased load
    { duration: '2m', target: 200 },  // Heavy load - should trigger rate limits
    { duration: '1m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.2'], // Expect some 429s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  // Test login rate limiting (5 attempts per minute)
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: 'test@example.com',
      password: 'wrongpassword',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `192.168.1.${__VU % 50}`, // Simulate different IPs
      },
    }
  );

  // Check for rate limit headers
  check(loginRes, {
    'has rate limit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
    'has remaining count': (r) => r.headers['X-Ratelimit-Remaining'] !== undefined,
  });

  // Track rate limiting effectiveness
  if (loginRes.status === 429) {
    rateLimitHit.add(1);
    check(loginRes, {
      'rate limit returns 429': (r) => r.status === 429,
      'has retry-after header': (r) => r.headers['Retry-After'] !== undefined,
    });
  } else if (loginRes.status === 200) {
    // Shouldn't happen with wrong password, but track if rate limit was bypassed
    rateLimitBypassed.add(1);
  }

  // Test API rate limiting
  const apiRes = http.get(`${BASE_URL}/api/v1/feed/trending`);
  
  check(apiRes, {
    'API has rate limit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
  });

  sleep(0.1); // Fast requests to trigger limits
}

export function handleSummary(data) {
  return {
    'rate-limit-results.json': JSON.stringify({
      rate_limit_effectiveness: data.metrics.rate_limit_hit.values.rate,
      bypass_rate: data.metrics.rate_limit_bypassed.values.rate,
    }),
  };
}
