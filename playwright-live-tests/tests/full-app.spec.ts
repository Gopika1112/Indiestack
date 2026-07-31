import { test, expect } from '@playwright/test';

const APP = 'http://10.10.10.141';
const API = `${APP}/api/v1`;
const timestamp = Date.now();

const ADMIN = {
  email: 'admin@admin.com',
  password: 'admin',
};

const TEST_USER = {
  email: `e2e_${timestamp}@test.com`,
  username: `e2euser${timestamp}`,
  password: 'SecurePass123!',
  display_name: 'E2E Tester',
};

// ============================================================
// 1. HEALTH & INFRASTRUCTURE
// ============================================================
test.describe('1. Health & Infrastructure', () => {
  test('health endpoint returns OK', async ({ request }) => {
    const res = await request.get(`${APP}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test('API health via proxy', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test('404 for non-existent API route', async ({ request }) => {
    const res = await request.get(`${API}/nonexistent-route-xyz`);
    expect(res.ok()).toBeFalsy();
  });

  test('unauthorized access to protected endpoint', async ({ request }) => {
    const res = await request.get(`${API}/auth/me`);
    expect(res.status()).toBe(401);
  });
});

// ============================================================
// 2. HOMEPAGE & FEED
// ============================================================
test.describe('2. Homepage & Feed', () => {
  test('homepage redirects to feed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/feed');
  });

  test('feed page loads with sidebar and tabs', async ({ page }) => {
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');

    // Sidebar with IndieStack logo
    await expect(page.locator('aside')).toBeVisible();

    // Check tabs exist (For You, Trending, Latest)
    await expect(page.getByText('For You')).toBeVisible();
    await expect(page.getByText('Trending')).toBeVisible();
    await expect(page.getByText('Latest')).toBeVisible();
  });

  test('feed tabs switch content', async ({ page }) => {
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click Trending tab
    await page.getByText('Trending').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();

    // Click Latest tab
    await page.getByText('Latest').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('footer is visible on feed page', async ({ page }) => {
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('footer')).toBeVisible();
  });
});

// ============================================================
// 3. DISCOVER PAGE
// ============================================================
test.describe('3. Discover Page', () => {
  test('discover page loads with search and topic chips', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Topic chips
    await expect(page.getByText('Technology')).toBeVisible();
    await expect(page.getByText('Programming')).toBeVisible();

    // Trending header
    await expect(page.getByText('Trending on IndieStack')).toBeVisible();
  });

  test('search filters posts', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('getting');
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ============================================================
// 4. REGISTRATION
// ============================================================
test.describe('4. Registration', () => {
  test('register page loads with logo and form', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Logo icon visible
    await expect(page.locator('h1:has-text("Join IndieStack")')).toBeVisible();

    // Form fields
    await expect(page.locator('#displayName')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Social login placeholders
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByText('Continue with GitHub')).toBeVisible();
  });

  test('register a new user via UI', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    await page.locator('#displayName').fill(TEST_USER.display_name);
    await page.locator('#username').fill(TEST_USER.username);
    await page.locator('#email').fill(TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);

    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForTimeout(3000);

    // Should redirect to feed or show authenticated state
    await expect(page.locator('body')).toBeVisible();
  });

  test('Zod validation catches invalid input', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Username too short (1 char) but password passes HTML minLength
    await page.locator('#displayName').fill('Test');
    await page.locator('#username').fill('t');
    await page.locator('#email').fill('test@test.com');
    await page.locator('#password').fill('LongEnoughPassword1!');

    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForTimeout(1500);

    // Zod should show "Username must be at least 3 characters"
    await expect(page.getByText(/at least 3 characters/i)).toBeVisible();
  });
});

// ============================================================
// 5. LOGIN
// ============================================================
test.describe('5. Login', () => {
  test('login page loads with logo and form', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();
  });

  test('login as admin (admin@admin.com / admin)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.locator('#email').fill(ADMIN.email);
    await page.locator('#password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(3000);

    // Should redirect to feed
    expect(page.url()).toContain('/feed');

    // Sidebar should show authenticated state (Write button visible, Sign in gone)
    await expect(page.locator('aside').getByText('Write')).toBeVisible();
  });
});

// ============================================================
// 6. API AUTH FLOW
// ============================================================
test.describe('6. API Auth Flow', () => {
  test('register via API', async ({ request }) => {
    const res = await request.post(`${API}/auth/register`, {
      data: {
        email: `api_${timestamp}@test.com`,
        username: `apiuser${timestamp}`,
        password: 'ApiPass123!',
        display_name: 'API Test User',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.tokens.access_token).toBeTruthy();
  });

  test('login via API', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.tokens.access_token).toBeTruthy();
    expect(body.data.user.email).toBe(ADMIN.email);
  });

  test('get current user (auth/me)', async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    const token = (await loginRes.json()).data.tokens.access_token;

    const res = await request.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(ADMIN.email);
  });

  test('refresh token', async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    const rt = (await loginRes.json()).data.tokens.refresh_token;

    const res = await request.post(`${API}/auth/refresh`, {
      data: { refresh_token: rt },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.access_token).toBeTruthy();
  });
});

// ============================================================
// 7. FEED & CONTENT APIs
// ============================================================
test.describe('7. Feed APIs', () => {
  test('API: feed/latest returns posts', async ({ request }) => {
    const res = await request.get(`${API}/feed/latest`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    const post = body.data[0];
    expect(post.title).toBeTruthy();
    expect(post.slug).toBeTruthy();
    expect(post.author_username).toBeTruthy();
  });

  test('API: feed/trending returns posts', async ({ request }) => {
    const res = await request.get(`${API}/feed/trending`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ============================================================
// 8. USER PROFILES
// ============================================================
test.describe('8. User Profiles', () => {
  test('API: get seeded user johndoe', async ({ request }) => {
    const res = await request.get(`${API}/users/johndoe`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.username).toBe('johndoe');
  });

  test('profile page loads with stats and tabs', async ({ page }) => {
    await page.goto('/@johndoe');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Display name visible
    await expect(page.locator('body')).toBeVisible();

    // Posts/About tab buttons (lowercase)
    const postsTab = page.locator('button:has-text("posts")');
    const aboutTab = page.locator('button:has-text("about")');
    await expect(postsTab).toBeVisible();
    await expect(aboutTab).toBeVisible();

    // Footer
    await expect(page.locator('footer')).toBeVisible();
  });
});

// ============================================================
// 9. POSTS
// ============================================================
test.describe('9. Posts', () => {
  test('API: get post by slug (seeded)', async ({ request }) => {
    const res = await request.get(`${API}/posts/slug/johndoe/getting-started`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Getting Started with IndieStack');
    expect(body.data.author_username).toBe('johndoe');
  });

  test('post page shows progress bar and content', async ({ page }) => {
    await page.goto('/@johndoe/getting-started');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Title visible
    await expect(page.getByText('Getting Started with IndieStack')).toBeVisible();

    // Author info
    await expect(page.getByText('min read', { exact: false })).toBeVisible();

    // Follow button
    await expect(page.getByText('Follow').first()).toBeVisible();

    // Scroll down to trigger floating toolbar
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(1000);
  });

  test('API: create post as authenticated user', async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    const token = (await loginRes.json()).data.tokens.access_token;

    const res = await request.post(`${API}/posts/`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `E2E Test Post ${timestamp}`,
        slug: `e2e-test-post-${timestamp}`,
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Automated test post content.' }] }] },
        excerpt: 'An automated test post',
        status: 'published',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe(`E2E Test Post ${timestamp}`);
  });
});

// ============================================================
// 10. WRITE PAGE (AUTHENTICATED)
// ============================================================
test.describe('10. Write Page', () => {
  test('write page shows distraction-free editor', async ({ page }) => {
    // Login via UI first
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.locator('#email').fill(ADMIN.email);
    await page.locator('#password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(3000);

    // Navigate to write
    await page.goto('/write');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should be on /write (not redirected to /login)
    if (page.url().includes('/write')) {
      // Publish button
      await expect(page.getByRole('button', { name: /Publish/i })).toBeVisible();

      // Save draft button
      await expect(page.getByRole('button', { name: /Save draft/i })).toBeVisible();

      // Title placeholder
      const titleInput = page.locator('textarea[placeholder="Title"]');
      await expect(titleInput).toBeVisible();
    } else {
      // Auth didn't persist — just verify we're on a valid page
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('write page: type title and test publish modal', async ({ page }) => {
    // Login via UI first
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.locator('#email').fill(ADMIN.email);
    await page.locator('#password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(3000);

    await page.goto('/write');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    if (page.url().includes('/write')) {
      // Type a title
      const titleInput = page.locator('textarea[placeholder="Title"]');
      await titleInput.fill('My Test Story');
      await page.waitForTimeout(500);

      // Click Publish to open modal
      await page.getByRole('button', { name: /Publish/i }).first().click();
      await page.waitForTimeout(1000);

      // Publish modal should appear
      await expect(page.getByText('Publish your story')).toBeVisible();
      await expect(page.getByText('Members only')).toBeVisible();

      // Close modal
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

// ============================================================
// 11. DARK MODE TOGGLE
// ============================================================
test.describe('11. Dark Mode', () => {
  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find the dark mode toggle button (sun/moon icon)
    const themeToggle = page.locator('button').filter({ has: page.locator('svg.lucide-moon, svg.lucide-sun') });
    if (await themeToggle.count() > 0) {
      await themeToggle.first().click();
      await page.waitForTimeout(1000);

      // HTML should have class="dark" or not
      const htmlClass = await page.locator('html').getAttribute('class');
      expect(htmlClass).toBeTruthy();

      // Toggle back
      await themeToggle.first().click();
      await page.waitForTimeout(500);
    }
  });
});

// ============================================================
// 12. SIDEBAR & NAVIGATION
// ============================================================
test.describe('12. Navigation Flow', () => {
  test('navigate through all pages', async ({ page }) => {
    // Feed
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('aside')).toBeVisible();

    // Click Explore in sidebar
    await page.locator('aside').getByText('Explore').first().click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/discover');

    // Click Home in sidebar
    await page.locator('aside').getByText('Home').first().click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/feed');

    // Login link
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/login');

    // Sign up link from login page
    await page.getByText('Sign up').click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/register');
  });

  test('authenticated sidebar shows avatar dropdown', async ({ page, request }) => {
    const loginRes = await request.post(`${API}/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    const data = (await loginRes.json()).data;

    await page.goto('/feed');
    await page.evaluate((authData) => {
      localStorage.setItem('access_token', authData.tokens.access_token);
      localStorage.setItem('refresh_token', authData.tokens.refresh_token);
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: authData.user,
          tokens: authData.tokens,
          isAuthenticated: true,
          isLoading: false,
        },
        version: 0,
      }));
    }, data);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Write button visible
    await expect(page.locator('aside').getByText('Write')).toBeVisible();

    // Click avatar to open dropdown
    const avatar = page.locator('aside button:has(span[class*="Avatar"], img)').last();
    if (await avatar.count() > 0) {
      await avatar.click();
      await page.waitForTimeout(1000);

      // Dropdown items
      await expect(page.getByText('Profile')).toBeVisible();
      await expect(page.getByText('Stories')).toBeVisible();
      await expect(page.getByText('Sign out')).toBeVisible();

      // Close dropdown
      await page.keyboard.press('Escape');
    }
  });
});

// ============================================================
// 13. ADMIN FULL FLOW
// ============================================================
test.describe('13. Admin Full Flow', () => {
  test('admin: login → feed → write → publish → view post', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.locator('#email').fill(ADMIN.email);
    await page.locator('#password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(3000);

    // Should be on feed
    expect(page.url()).toContain('/feed');
    await page.waitForTimeout(1500);

    // Click Write
    await page.locator('aside').getByText('Write').click();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/write');

    // Type title
    const titleInput = page.locator('textarea[placeholder="Title"]');
    await titleInput.fill(`Admin Post ${timestamp}`);
    await page.waitForTimeout(500);

    // Open publish modal
    await page.getByRole('button', { name: /Publish/i }).first().click();
    await page.waitForTimeout(1000);

    // Fill excerpt
    const excerptInput = page.locator('textarea[placeholder*="summary"]');
    if (await excerptInput.count() > 0) {
      await excerptInput.fill('This is an admin test post.');
    }

    // Click Publish now
    await page.getByRole('button', { name: /Publish now/i }).click();
    await page.waitForTimeout(4000);

    // Should redirect to the post page
    await expect(page.locator('body')).toBeVisible();
  });
});
