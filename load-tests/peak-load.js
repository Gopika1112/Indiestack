import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Peak load test - simulates viral event or traffic spike
const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '2m', target: 2000 },   // Rapid ramp to 2k users
    { duration: '3m', target: 5000 },   // Continue ramp to 5k
    { duration: '5m', target: 10000 },  // Peak load: 10k users
    { duration: '10m', target: 10000 }, // Sustained peak
    { duration: '5m', target: 5000 },   // Gradual reduction
    { duration: '3m', target: 2000 },   // Continue reduction
    { duration: '2m', target: 0 },      // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    error_rate: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  // Focus on critical paths under peak load
  
  // 1. Feed (highest priority)
  const feedRes = http.get(`${BASE_URL}/api/v1/feed?limit=10`);
  const feedSuccess = check(feedRes, {
    'feed available under peak load': (r) => r.status === 200,
    'feed response < 1s': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!feedSuccess);
  
  // 2. Trending (cached, should be fast)
  const trendingRes = http.get(`${BASE_URL}/api/v1/feed/trending?limit=10`);
  check(trendingRes, {
    'trending available': (r) => r.status === 200,
    'trending cached < 50ms': (r) => r.timings.duration < 50,
  });
  
  // 3. Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check passes': (r) => r.status === 200,
  });
  
  // Minimal think time under peak load
  sleep(0.5);
}
