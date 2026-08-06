import { test, expect } from '@playwright/test';

// Base URL for the API under test. The Go API is reached through Caddy on :8080
// (its internal :3001 port is not exposed). Override with PLAYWRIGHT_BASE_URL.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';

test.describe('Health Checks', () => {
  test('API health endpoint returns success', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });
});
