import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const feedLoadTime = new Trend('feed_load_time');
const postLoadTime = new Trend('post_load_time');
const errorRate = new Rate('error_rate');
const apiCalls = new Counter('api_calls');

// Test configuration
export const options = {
  stages: [
    { duration: '5m', target: 100 },   // Ramp up to 100 users
    { duration: '10m', target: 500 },  // Ramp up to 500 users
    { duration: '30m', target: 500 },  // Steady state at 500 users
    { duration: '10m', target: 100 },  // Ramp down
    { duration: '5m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
    feed_load_time: ['p(95)<100'],
    post_load_time: ['p(95)<200'],
    error_rate: ['rate<0.05'],
  },
  ext: {
    loadimpact: {
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'amazon:ie:dublin': { loadZone: 'amazon:ie:dublin', percent: 50 },
      },
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Test data
const testUsers = [
  { username: 'user1', email: 'user1@test.com' },
  { username: 'user2', email: 'user2@test.com' },
  { username: 'user3', email: 'user3@test.com' },
];

export function setup() {
  // Setup: Create test data, authenticate if needed
  console.log('Starting load test against:', BASE_URL);
  return { startTime: Date.now() };
}

export default function (data) {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  group('Feed Operations (70% of traffic)', () => {
    // Get personalized feed
    const feedStart = Date.now();
    const feedRes = http.get(`${BASE_URL}/api/v1/feed?limit=20`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    });
    
    feedLoadTime.add(Date.now() - feedStart);
    apiCalls.add(1);
    
    const feedSuccess = check(feedRes, {
      'feed status is 200': (r) => r.status === 200,
      'feed response time < 100ms': (r) => r.timings.duration < 100,
      'feed has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true && Array.isArray(body.data);
        } catch (e) {
          return false;
        }
      },
    });
    
    errorRate.add(!feedSuccess);
    
    // Get trending feed (30% of feed requests)
    if (Math.random() < 0.3) {
      const trendingRes = http.get(`${BASE_URL}/api/v1/feed/trending?limit=20`);
      check(trendingRes, {
        'trending status is 200': (r) => r.status === 200,
      });
      apiCalls.add(1);
    }
    
    // Get latest feed (20% of feed requests)
    if (Math.random() < 0.2) {
      const latestRes = http.get(`${BASE_URL}/api/v1/feed/latest?limit=20`);
      check(latestRes, {
        'latest status is 200': (r) => r.status === 200,
      });
      apiCalls.add(1);
    }
  });
  
  group('Post Reading (50% of traffic)', () => {
    const postStart = Date.now();
    const postRes = http.get(`${BASE_URL}/api/v1/posts/slug/${user.username}/test-post`);
    
    postLoadTime.add(Date.now() - postStart);
    apiCalls.add(1);
    
    check(postRes, {
      'post status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'post response time < 200ms': (r) => r.timings.duration < 200,
    });
  });
  
  group('Profile Views (30% of traffic)', () => {
    const profileRes = http.get(`${BASE_URL}/api/v1/users/${user.username}`);
    apiCalls.add(1);
    
    check(profileRes, {
      'profile status is 200': (r) => r.status === 200,
      'profile response time < 150ms': (r) => r.timings.duration < 150,
    });
  });
  
  group('Content Creation (5% of traffic)', () => {
    if (Math.random() < 0.05 && AUTH_TOKEN) {
      const createRes = http.post(
        `${BASE_URL}/api/v1/posts`,
        JSON.stringify({
          title: `Load Test Post ${Date.now()}`,
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'This is load test content' },
                ],
              },
            ],
          },
          excerpt: 'Load test excerpt',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTH_TOKEN}`,
          },
        }
      );
      
      apiCalls.add(1);
      
      check(createRes, {
        'create post status is 201': (r) => r.status === 201,
        'create post time < 500ms': (r) => r.timings.duration < 500,
      });
    }
  });
  
  group('Social Actions (10% of traffic)', () => {
    if (Math.random() < 0.1 && AUTH_TOKEN) {
      const followRes = http.post(
        `${BASE_URL}/api/v1/users/${testUsers[Math.floor(Math.random() * testUsers.length)].username}/follow`,
        null,
        {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
          },
        }
      );
      
      apiCalls.add(1);
      
      check(followRes, {
        'follow status is 200': (r) => r.status === 200,
      });
    }
  });
  
  // Think time between requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration} seconds`);
}
