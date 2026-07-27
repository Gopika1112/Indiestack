import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test('User registration returns user data', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/v1/auth/register', {
      data: {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        display_name: 'Test User'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.user).toBeDefined();
    expect(body.data.user.username).toBe('testuser');
  });

  test('User login returns user and tokens', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/v1/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.user).toBeDefined();
    expect(body.data.tokens).toBeDefined();
    expect(body.data.tokens.access_token).toBeDefined();
  });

  test('Get user by username returns user data', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/users/testuser');
    
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.username).toBe('testuser');
  });

  test('Get post by slug returns post data', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/posts/slug/testuser/my-first-post');
    
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('My First Blog Post');
    expect(body.data.author_username).toBe('testuser');
  });

  test('Feed latest returns posts array', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/feed/latest');
    
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
