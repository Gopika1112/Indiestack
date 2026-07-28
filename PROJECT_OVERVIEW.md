# IndieStack — Project Overview

> A self-hosted, high-performance content publishing platform for independent writers, creators, and newsletter publishers.

---

## 1. Executive Summary

**IndieStack** is a Substack/Medium-like content platform optimized for the Indian market and designed to be self-hosted, scalable, and performant. It provides writers with the tools to publish articles, grow an audience through follows and feeds, distribute newsletters, and eventually monetize content through paid subscriptions.

The platform is built as a **modular monolith** with a modern web stack: a Next.js 14 frontend, a Go backend API, PostgreSQL with TimescaleDB for persistence, Redis for caching, NATS JetStream for asynchronous queues, and MeiliSearch for full-text search.

The codebase is production-aware but currently exists as a **working MVP/prototype**. Core publishing and social features are functional; advanced capabilities such as search indexing, email delivery, payment processing, and CDN uploads are scaffolded in the architecture but not yet fully integrated.

---

## 2. Vision & Target Audience

### Vision

Empower independent creators to own their content, audience, and revenue without depending on centralized platforms.

### Target Audience

- Independent journalists and bloggers
- Newsletter authors
- Educators and thought leaders
- Creators in India and emerging markets who need Razorpay integration and local-first features
- Developers/organizations who want a deployable, self-hosted publishing platform

### Value Propositions

- **Ownership**: Self-hosted, open-source codebase under MIT license
- **Performance**: Sub-100ms API responses, ISR/SSR for SEO, Redis caching
- **Growth**: Follow system, hybrid push/pull feed, newsletter subscriptions
- **Monetization**: Paid subscriptions via Razorpay (planned)
- **SEO**: Server-side rendering, dynamic metadata, sitemaps, OpenGraph

---

## 3. Feature Set

### 3.1 Implemented (MVP)

| Feature | Status | Notes |
|---------|--------|-------|
| User registration & login | ✅ | JWT-based auth with access/refresh tokens |
| User profiles | ✅ | Public profiles with bio, avatar, follower/following counts |
| Post creation & publishing | ✅ | Rich content stored as JSONB; draft/published/archived states |
| Public feeds | ✅ | Latest and trending post feeds |
| Follow system | 🟡 | Schema exists; API surface is scaffolded |
| API key management | ✅ | Scoped API keys with prefix/hash storage |
| Dark mode / theming | ✅ | Next.js theme provider |
| Responsive UI | ✅ | Tailwind CSS + Radix UI components |
| Docker Compose deployment | ✅ | Full and simple compose variants |
| E2E tests | ✅ | Playwright test suite |
| Load tests | ✅ | k6 scripts for normal, peak, and rate-limit scenarios |
| CI/CD workflows | ✅ | GitHub Actions for security scans and test suite |

### 3.2 In Progress / Planned

| Feature | Phase | Notes |
|---------|-------|-------|
| Newsletter system | Phase 2 | Email subscriptions, delivery tracking |
| Full-text search | Phase 2 | MeiliSearch integration for posts and users |
| RSS feeds & sitemaps | Phase 2 | Auto-generated SEO artifacts |
| Razorpay payments | Phase 3 | Paid subscriptions and premium content gating |
| File uploads (R2/CDN) | Phase 3 | Image uploads via signed URLs |
| OAuth login (Google/GitHub) | Phase 2 | Social authentication |
| Hybrid push/pull feed | Phase 2 | Redis-based fanout for small creators |
| Analytics dashboard | Phase 4 | Time-series analytics with TimescaleDB |
| Kubernetes deployment | Phase 4 | Production orchestration manifests |

---

## 4. Technical Architecture

### 4.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         End Users                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     Caddy Reverse Proxy                       │
│              (HTTPS, compression, routing)                    │
└─────────────┬─────────────────────────────────┬───────────────┘
              │                                 │
              ▼                                 ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│      Next.js Frontend   │         │      Go API Backend     │
│   (SSR / ISR / React)   │         │  (REST API / business)  │
└─────────────────────────┘         └─────────────┬───────────┘
                                                  │
                        ┌───────────┬─────────────┼───────────┬───────────┐
                        ▼           ▼             ▼           ▼           ▼
                   ┌────────┐  ┌────────┐   ┌────────┐  ┌────────┐  ┌──────────┐
                   │PostgreSQL│  │ Redis  │   │  NATS  │  │MeiliSearch│  │Cloudflare│
                   │+Timescale│  │(cache) │   │(queues)│  │ (search) │  │   R2     │
                   └────────┘  └────────┘   └────────┘  └────────┘  └──────────┘
```

### 4.2 Component Responsibilities

#### Frontend (Next.js 14, App Router)

- Server-side rendering for SEO and fast first paint
- Incremental Static Regeneration (ISR) for public blog pages
- TipTap-based rich text editor
- Client state management with Zustand
- Tailwind CSS + Radix UI component library
- Route groups for auth, blog, and dashboard sections

#### Backend (Go + Standard Library)

- REST API endpoints for auth, users, posts, feeds, API keys
- JWT authentication (HS256) with bcrypt password hashing
- In-memory IP-based rate limiting
- Type-safe request/response models
- Direct PostgreSQL access via `pgx`/`database/sql`
- Graceful shutdown and structured JSON responses

#### Database (PostgreSQL + TimescaleDB)

- Core relational data: users, posts, follows, likes, bookmarks, comments, jobs, API keys
- JSONB post content for flexible rich-text structures
- TimescaleDB extension for time-series analytics (views, likes, email events)
- Partial indexes on hot paths (published posts, slugs, API key prefixes)

#### Cache (Redis)

- Session storage
- Feed caching (5-minute TTL planned)
- Rate limiting counters (current implementation is in-memory)
- Top posts cache

#### Queue (NATS JetStream)

- `emails`: asynchronous email delivery
- `notifications`: user notification fanout
- `feed-updates`: feed fanout events
- `analytics`: analytics ingestion

#### Search (MeiliSearch)

- `posts` index for full-text search and autocomplete
- `users` index for user discovery

#### Storage (Cloudflare R2)

- Image and asset uploads
- Direct client uploads via signed URLs

#### Proxy (Caddy)

- Automatic HTTPS (disabled locally)
- HTTP/3 and Brotli compression
- Reverse proxy routing: `/api/v1/*` → Go, everything else → Next.js
- Security headers

---

## 5. Project Structure

```
Indiestack/
├── backend/
│   ├── cmd/
│   │   └── api/
│   │       ├── main.go                  # Main HTTP server and API handlers
│   │       └── penmark_handlers.go      # Programmatic content endpoints
│   ├── sql/
│   │   └── migrations/
│   │       └── 001_init.sql             # Database schema
│   ├── Dockerfile                       # Production API image
│   ├── Dockerfile.full                  # Full-stack variant image
│   ├── Dockerfile.simple
│   ├── Dockerfile.worker
│   ├── Dockerfile.feed
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── app/                             # Next.js App Router pages
│   │   ├── (auth)/                      # Login / Register route group
│   │   ├── (blog)/                      # Public blog routes
│   │   ├── article/[slug]/
│   │   ├── dashboard/                   # Creator dashboard
│   │   ├── discover/
│   │   ├── feed/
│   │   ├── profile/
│   │   ├── settings/
│   │   ├── write/                       # Rich text editor
│   │   └── ...
│   ├── components/
│   │   ├── editor/                      # TipTap editor wrapper
│   │   ├── feed/                        # Post cards and feed UI
│   │   ├── post/                        # Floating toolbar, post actions
│   │   ├── ui/                          # Reusable Radix/Tailwind components
│   │   ├── navbar.tsx
│   │   └── footer.tsx
│   ├── lib/
│   │   ├── api.ts                       # API client and type definitions
│   │   ├── auth-store.ts                # Zustand auth state
│   │   ├── schemas.ts                   # Zod validation schemas
│   │   └── utils.ts
│   ├── package.json
│   ├── Dockerfile
│   └── next.config.js
├── load-tests/
│   ├── normal-load.js                   # 500-user load test
│   ├── peak-load.js                     # 10,000-user peak test
│   ├── rate-limit-test.js
│   └── image-upload-stress.js
├── playwright-live-tests/
│   ├── tests/
│   │   └── full-app.spec.ts             # Full E2E suite
│   ├── playwright.config.ts
│   └── package.json
├── frontend-playwright/
│   ├── tests/
│   │   ├── api.spec.ts
│   │   └── health.spec.ts
│   ├── Dockerfile
│   └── package.json
├── scripts/
│   ├── setup.sh                         # macOS/Linux setup
│   ├── setup.ps1                        # Windows setup
│   ├── dev-backend.ps1
│   ├── dev-frontend.ps1
│   └── testing/
│       ├── infrastructure-check.sh
│       ├── infrastructure-check.ps1
│       └── run-all-tests.sh
├── k8s/
│   └── namespace.yaml
├── docker-compose.yml                   # Full stack with Caddy
├── docker-compose.full.yml              # Full stack without Caddy
├── docker-compose.simple.yml            # Infrastructure only
├── docker-compose.app.yml
├── docker-compose.final.yml
├── Caddyfile
├── seed.sql
├── .env.example
├── README.md
├── ARCHITECTURE.md
├── FEATURE_DASHBOARD.md
├── TEST_EXECUTION_GUIDE.md
└── PROJECT_OVERVIEW.md                  # This file
```

---

## 6. Data Model

### 6.1 Core Entities

#### `users`
Stores registered accounts and public profile metadata.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | Unique user ID |
| `email` | TEXT UNIQUE | Login email |
| `username` | TEXT UNIQUE | Public handle |
| `password_hash` | TEXT | bcrypt hash |
| `display_name` | TEXT | Public name |
| `bio` | TEXT | Short biography |
| `avatar_url` | TEXT | Profile image URL |
| `website` | TEXT | Personal website |
| `location` | TEXT | Location |
| `is_verified` | BOOLEAN | Verified badge |
| `is_premium` | BOOLEAN | Premium subscriber |
| `follower_count` | INTEGER | Cached follower count |
| `following_count` | INTEGER | Cached following count |

#### `posts`
Stores blog posts with JSONB content and publishing state.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | Unique post ID |
| `author_id` | UUID FK | Post author |
| `slug` | TEXT | URL-safe title |
| `title` | TEXT | Post title |
| `content` | JSONB | TipTap/editor JSON |
| `excerpt` | TEXT | Short summary |
| `cover_image_url` | TEXT | Hero image |
| `reading_time_minutes` | INTEGER | Estimated read time |
| `word_count` | INTEGER | Word count |
| `status` | TEXT | draft / published / archived |
| `published_at` | TIMESTAMPTZ | Publication date |
| `view_count` | INTEGER | Cached views |
| `like_count` | INTEGER | Cached likes |
| `comment_count` | INTEGER | Cached comments |
| `is_premium` | BOOLEAN | Paid content flag |

#### `follows`
Many-to-many follower relationships.

| Field | Type | Description |
|-------|------|-------------|
| `follower_id` | UUID FK | Who follows |
| `following_id` | UUID FK | Who is followed |
| `created_at` | TIMESTAMPTZ | Follow timestamp |

#### `api_keys`
Scoped programmatic access keys.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | Key ID |
| `user_id` | UUID FK | Owner |
| `name` | TEXT | Human-readable label |
| `key_prefix` | TEXT | First 8 chars for lookup |
| `key_hash` | TEXT | bcrypt hash of full key |
| `scopes` | TEXT[] | Permitted scopes |
| `last_used_at` | TIMESTAMPTZ | Usage tracking |
| `expires_at` | TIMESTAMPTZ | Optional expiry |
| `is_active` | BOOLEAN | Revocation flag |

### 6.2 Supporting Entities

- `likes`, `bookmarks`, `comments` — engagement
- `profiles` — extended professional profile
- `jobs` — creator/job board feature
- `newsletter_subscriptions` — email list
- `reading_history` — per-user read tracking
- `notifications` — in-app notifications
- `tips` — one-time creator support

### 6.3 Time-Series Data (TimescaleDB)

Planned hypertables for:

- `post_analytics`: views, likes, shares
- `email_events`: delivery, opens, clicks, bounces

---

## 7. API Overview

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/auth/refresh` | Refresh tokens |
| POST | `/api/v1/auth/logout` | Logout |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/:username` | Public profile |
| GET | `/api/v1/users/:username/posts` | User's published posts |

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/posts/slug/:username/:slug` | Read a post |
| POST | `/api/v1/posts/` | Create post |
| PUT | `/api/v1/posts/:id` | Update post |
| DELETE | `/api/v1/posts/:id` | Archive post |
| GET | `/api/v1/posts/mine` | List current user's posts |

### Feeds

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/feed` | Default feed (latest) |
| GET | `/api/v1/feed/latest` | Latest posts |
| GET | `/api/v1/feed/trending` | Trending posts |

### API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-keys` | List keys |
| POST | `/api/v1/api-keys` | Create key |
| DELETE | `/api/v1/api-keys/:id` | Revoke key |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness (DB check) |

---

## 8. Security Considerations

### Implemented

- **Password hashing**: bcrypt with default cost
- **JWT authentication**: HS256 access tokens (24h) and refresh tokens (7d)
- **Rate limiting**: In-memory per-IP limits on registration (10/min) and login (5/min)
- **Input validation**: Email, username, password, and post title validation
- **CORS middleware**: Configured for wide origins (review for production)
- **Security headers**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy via Caddy

### Production Hardening Needed

- Switch JWT to RS256 asymmetric signing
- Implement refresh token rotation and persistence
- Move rate limiting to Redis for distributed deployments
- Add per-user API rate limiting
- Enforce CSP headers
- Enable HTTPS in Caddy
- Add audit logging for sensitive operations
- Implement OAuth state validation
- Sanitize rich-text output to prevent stored XSS

---

## 9. Performance Strategy

### Backend

- **Connection pooling**: pgx with 25 max open, 5 idle connections
- **Prepared statements**: Used implicitly via `database/sql`
- **Partial indexes**: `idx_posts_status_published_at`, `idx_posts_author_status`
- **Lightweight dependencies**: Standard library HTTP router keeps binary small

### Caching (Planned/Partial)

| Data | Store | TTL | Strategy |
|------|-------|-----|----------|
| User sessions | Redis | 7 days | Write-through |
| User feeds | Redis | 5 min | Write-behind |
| Top posts | Redis | 10 min | Cache-aside |
| Post content | Redis | 1 hour | Cache-aside |
| HTML pages | CDN | 1 min | ISR |

### Feed Algorithm

- **Small creators (< 10k followers)**: Push feed — fan out post IDs to each follower's Redis list
- **Large creators (≥ 10k followers)**: Pull feed — query database on request, cached 5 minutes
- **Hybrid merge**: Combine push and pull results, sort by `published_at`, cache merged result

### Frontend

- Next.js ISR for public pages
- Image optimization via Next.js Image component
- Code splitting by route
- Tailwind purging for small CSS bundles

---

## 10. Testing Strategy

### Test Categories

| Category | Tool | Location | Purpose |
|----------|------|----------|---------|
| Infrastructure health | Shell scripts | `scripts/testing/` | Verify all services are running |
| E2E browser tests | Playwright | `playwright-live-tests/` | Full user journeys |
| API health tests | Playwright | `frontend-playwright/` | API smoke tests |
| Load tests | k6 | `load-tests/` | Performance under 500–10k users |
| Security scans | GitHub Actions | `.github/workflows/security-scan.yml` | Dependency & secret scanning |
| CI/CD | GitHub Actions | `.github/workflows/test-suite.yml` | Automated test runs |

### E2E Scenarios Covered

- Health and infrastructure checks
- Homepage redirect and feed rendering
- User registration and Zod validation
- Login flow and authenticated navbar
- API auth flow (register/login/me/refresh)
- Feed APIs (latest/trending)
- User profiles and post pages
- Post creation via API and UI
- Write page and publish modal
- Dark mode toggle
- Navigation flow

### Performance Targets

| Metric | Target | Current (Documented) |
|--------|--------|----------------------|
| API response time (p95) | < 100 ms | ~10 ms |
| Frontend build time | < 5 min | ~3 min |
| DB connection | < 1 s | < 500 ms |
| Container startup | < 30 s | ~15 s |

---

## 11. Deployment & Operations

### Local Development Options

1. **Full Docker Compose (recommended)**
   ```bash
   cp .env.example .env
   # edit .env with secrets
   docker-compose up -d --build
   # http://localhost:8080
   ```

2. **Simple infrastructure + local services**
   ```bash
   docker-compose -f docker-compose.simple.yml up -d
   # Run backend: go run backend/cmd/api/main.go
   # Run frontend: npm run dev in frontend/
   ```

3. **Development scripts**
   - Windows: `scripts/dev-backend.ps1`, `scripts/dev-frontend.ps1`
   - Setup: `scripts/setup.sh` (Linux/macOS) or `scripts/setup.ps1` (Windows)

### Service URLs (Default Full Stack)

| Service | URL / Endpoint |
|---------|----------------|
| Frontend | http://localhost:8080 |
| API via Caddy | http://localhost:8080/api/v1 |
| API direct | http://localhost:3001 |
| Health | http://localhost:8080/health |
| MeiliSearch | http://localhost:7700 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| NATS | localhost:4222 |

### Scaling Roadmap

| Phase | Scale | Changes |
|-------|-------|---------|
| Phase 1 | 1–10K users | Single-server Docker Compose |
| Phase 2 | 10K–100K | Separate DB server, Redis cluster, CDN |
| Phase 3 | 100K–1M | Kubernetes, read replicas, clustered MeiliSearch |
| Phase 4 | 1M+ | Multi-region PostgreSQL, edge caching, ML feed ranking |

---

## 12. Development Workflow

### Branching

- Default branch: `main`
- Pull requests require review per `CODEOWNERS`
- PR template provided in `.github/PULL_REQUEST_TEMPLATE/`

### Pre-commit Hooks

- `scripts/hooks/pre-commit` runs basic checks
- `detect-secrets` baseline scanning via `.secrets.baseline`
- Dependabot configured for dependency updates

### CI/CD Pipelines

- **Security scan**: secret detection, dependency checks
- **Test suite**: runs on push to `main`, PRs, and scheduled daily runs

### Local Build Commands

**Backend**
```bash
cd backend
go mod download
go run cmd/api/main.go
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Full Docker**
```bash
docker-compose up -d --build
```

---

## 13. Roadmap

### Phase 1: Core Platform ✅
- [x] JWT + OAuth-ready auth
- [x] Post creation and publishing
- [x] TipTap rich editor
- [x] Follow system schema and API scaffolding
- [x] Hybrid feed architecture planning

### Phase 2: Growth
- [ ] Newsletter system with email delivery
- [ ] MeiliSearch search integration
- [ ] RSS feeds and sitemap generation
- [ ] Social sharing optimization
- [ ] Google/GitHub OAuth

### Phase 3: Monetization
- [ ] Razorpay integration
- [ ] Premium post gating
- [ ] Subscription management
- [ ] Payout workflows

### Phase 4: Scale
- [ ] Kubernetes manifests
- [ ] PostgreSQL read replicas
- [ ] CDN and edge caching
- [ ] Analytics dashboard

---

## 14. Current Limitations

1. **Backend service wiring**: Redis, NATS, and MeiliSearch services run in Docker but are not yet connected in the Go API.
2. **Rate limiting**: Currently in-memory only; not suitable for multi-instance deployments.
3. **Search**: MeiliSearch is not indexing posts or users yet.
4. **Email**: SMTP configuration required; newsletter delivery not implemented.
5. **File uploads**: R2/CDN storage not wired to the upload flow.
6. **OAuth**: Social login placeholders exist but are not configured.
7. **Feed**: Hybrid push/pull algorithm is documented but the Redis fanout is not active.
8. **Frontend Tailwind**: Some typography/prose classes may not be fully configured.

---

## 15. Getting Started (Quickstart)

```bash
# 1. Clone and enter the project
cd Indiestack

# 2. Create environment file
cp .env.example .env

# 3. Edit .env with secure values, especially:
#    JWT_SECRET, JWT_REFRESH_SECRET, POSTGRES_PASSWORD, MEILI_MASTER_KEY

# 4. Start the full stack
docker-compose up -d --build

# 5. Wait for services to start (~15–30 seconds)

# 6. Verify health
curl http://localhost:8080/health
curl http://localhost:8080/api/v1/feed/latest

# 7. Open the app
open http://localhost:8080
```

---

## 16. License & Contributing

- **License**: MIT
- **Contributing**: Contributions welcome; follow the PR template and ensure CI passes
- **Acknowledgments**: Built with Fiber/Go, Next.js, TipTap, TimescaleDB, MeiliSearch, and Caddy

---

*This overview is a living document. As the project evolves, update this file to reflect new features, architecture changes, and operational procedures.*
