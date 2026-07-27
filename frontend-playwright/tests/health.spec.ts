import { test, expect } from '@playwright/test';

test.describe('Health Checks', () => {
  test('API health endpoint returns success', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });
});
