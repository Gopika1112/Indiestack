# IndieStack

A self-hosted, Substack/Medium-like content publishing platform targeted at the Indian market. It is designed as a modern blogging/newsletter platform with social features, planned monetization, and SEO optimization.

> ⚠️ **Project status**: This is a working MVP/prototype. Core auth, publishing, feeds, and social features are implemented. Several advanced features (Redis caching, NATS queues, MeiliSearch, TimescaleDB time-series analytics, Razorpay, email delivery, CDN uploads) are **declared in the architecture but not yet wired into the backend code**. See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for a detailed feature map.

---

## Features

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS + Radix UI + TipTap rich-text editor
- **Backend API**: Go standard library HTTP server (`net/http`) with JWT authentication, bcrypt password hashing, and `pgx` PostgreSQL driver
- **Database**: PostgreSQL with the TimescaleDB extension available (used as a regular PostgreSQL server; hypertables/analytics not yet implemented)
- **Caching**: Redis container is provided by Docker Compose but is **not currently used by the backend**
- **Queue / Messaging**: NATS JetStream container is provided by Docker Compose but is **not currently used by the backend**
- **Search**: MeiliSearch container is provided by Docker Compose but is **not currently used by the backend**
- **Reverse Proxy**: Caddy (configured in `Caddyfile`)
- **Container Orchestration**: Docker Compose with multiple deployment variants

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Caddy     │────▶│  Next.js    │────▶│  Go API     │
│   (Proxy)   │     │  (Frontend) │     │ (Backend)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                   ┌─────────────┬──────────────┼─────────────┐
                   │             │              │             │
                   ▼             ▼              ▼             ▼
              ┌─────────┐  ┌─────────┐   ┌─────────┐  ┌─────────┐
              │PostgreSQL│  │  Redis  │   │  NATS   │  │ Meili-  │
              │+Timescale│  │ (stub)  │   │ (stub)  │  │ search  │
              │  (live)  │  │         │   │         │  │ (stub)  │
              └─────────┘  └─────────┘   └─────────┘  └─────────┘
```

- The frontend is served by Caddy and talks to the Go API through `/api/v1/*`.
- The Go API connects to PostgreSQL and returns JSON. No Redis/NATS/MeiliSearch client code is currently active in the backend.
- Redis, NATS, and MeiliSearch are present in Docker Compose for future integration.

## Project Structure

```
indiestack/
├── backend/              # Go backend
│   ├── cmd/api/          # Main HTTP server (single-file app: main.go + penmark_handlers.go)
│   ├── internal/queue/   # Queue client stub (publishes events but currently no-op)
│   ├── sql/migrations/   # PostgreSQL schema migrations
│   ├── Dockerfile*       # Several backend image variants
│   ├── go.mod / go.sum
├── frontend/             # Next.js 14 App Router
│   ├── app/              # Pages and routes
│   ├── components/       # React components (editor, feed, post, UI)
│   ├── lib/              # API client, auth store, schemas, utilities
│   ├── package.json
│   ├── Dockerfile
│   └── next.config.js
├── docker-compose*.yml   # Compose variants (full, simple, app, final)
├── Caddyfile             # Reverse proxy configuration
├── seed.sql              # Deprecated legacy seed file (migrations now seed data)
├── .env.example          # Environment variable template
└── README.md / ARCHITECTURE.md / PROJECT_OVERVIEW.md
```

> The backend is intentionally a single-file style server (`backend/cmd/api/main.go`) rather than a Fiber/Chi/Gin application. The README in earlier versions incorrectly claimed the project uses Go Fiber; this has been corrected.

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.23+ (for local backend development)
- Node.js 20+ (for local frontend development)

### Using Docker Compose

1. Clone the repository:

```bash
git clone https://github.com/yourusername/indiestack.git
cd indiestack
```

2. Copy the environment file and set secure values:

```bash
cp .env.example .env
# Edit .env with JWT_SECRET, JWT_REFRESH_SECRET, POSTGRES_PASSWORD, MEILI_MASTER_KEY, etc.
```

3. Build and start the full stack:

```bash
docker-compose up -d --build
```

4. Access the application:

- Frontend: http://localhost:8080
- API via Caddy: http://localhost:8080/api/v1
- API direct: http://localhost:3001

### Local Development

**Backend (Go):**

```bash
cd backend
go mod download
# Run the server. The database migrations are mounted into PostgreSQL by Docker Compose.
# If you already have a PostgreSQL instance running, point DATABASE_URL at it.
export DATABASE_URL="postgres://indiestack:indiestack_secret@localhost:5432/indiestack?sslmode=disable"
export JWT_SECRET="replace-with-a-32-byte-secret"
export JWT_REFRESH_SECRET="replace-with-a-different-32-byte-secret"
go run cmd/api/main.go cmd/api/penmark_handlers.go
```

**Frontend (Next.js):**

```bash
cd frontend
npm install
npm run dev
```

### Database Migrations

The database schema is applied automatically when PostgreSQL starts in Docker Compose, because `docker-compose.yml` mounts `backend/sql/migrations` into `/docker-entrypoint-initdb.d`.

- `backend/sql/migrations/001_init.sql` — base schema for users, posts, follows, likes, comments, bookmarks, API keys, notifications, reading history, profiles, jobs, newsletter subscriptions, tips, etc.
- `backend/sql/migrations/002_schema_patch.sql` — additional tables and columns required by the backend handlers (companies, post_analytics, email_events, missing defaults, indexes).
- `backend/sql/migrations/002_seed_data.sql` — demo users, profiles, and posts for local testing.

> No migration runner such as `goose` or `sqlc` is currently configured in the repository. The backend uses plain SQL through `database/sql`/`pgx`.

## Database Schema

### Core Tables

- **users**: accounts, password hashes, profile metadata, cached follower/following counts
- **posts**: blog posts with JSONB content, draft/published/archived states, cached engagement counts
- **follows**: follower/following relationships
- **likes**: post likes
- **comments**: post comments (threaded via `parent_id`)
- **bookmarks**: saved posts
- **reading_history**: per-user read tracking
- **notifications**: in-app notifications
- **api_keys**: scoped, hashed programmatic keys with prefix lookup
- **profiles**: extended professional profile data
- **jobs**: job board listings
- **companies**: job company metadata
- **newsletter_subscriptions**: email subscribers
- **tips**: one-time creator support

### Time-Series Tables (TimescaleDB — planned)

- **post_analytics**: views, likes, shares
- **email_events**: delivery, opens, clicks, bounces

These tables are created as regular PostgreSQL tables. Converting them to TimescaleDB hypertables is optional and deferred until the analytics features are built.

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` — Register new user
- `POST /api/v1/auth/login` — Login
- `POST /api/v1/auth/refresh` — Refresh access token
- `GET /api/v1/auth/me` — Current authenticated user
- `POST /api/v1/auth/logout` — Stateless logout

### Users

- `GET /api/v1/users/:username` — Public user profile
- `GET /api/v1/users/:username/posts` — User's published posts
- `PUT /api/v1/users/me` — Update own profile (Penmark handler)
- `POST /api/v1/users/:username/follow` — Follow/unfollow user (Penmark handler)

### Posts

- `GET /api/v1/posts/slug/:username/:slug` — Read a published post
- `POST /api/v1/posts` — Create post (requires auth)
- `PUT /api/v1/posts/:id` — Update own post (requires auth)
- `DELETE /api/v1/posts/:id` — Archive own post (requires auth)
- `GET /api/v1/posts/mine` — List current user's posts (requires auth)

### Feeds

- `GET /api/v1/feed` — Default feed (currently identical to latest feed)
- `GET /api/v1/feed/latest` — Latest published posts
- `GET /api/v1/feed/trending` — Trending posts (sorted by `views + likes*2`)

### Social & Engagement

- `POST /api/v1/posts/:id/like` — Like/unlike a post
- `GET /api/v1/posts/:id/comments` — List comments
- `POST /api/v1/posts/:id/comments` — Add a comment
- `POST /api/v1/bookmarks/:id` — Save/unsave a post
- `GET /api/v1/bookmarks` — List bookmarks
- `GET /api/v1/history` — Reading history
- `GET /api/v1/notifications` — Notifications
- `PUT /api/v1/notifications` — Mark all notifications read

### API Keys

- `GET /api/v1/api-keys` — List API keys
- `POST /api/v1/api-keys` — Create scoped API key
- `DELETE /api/v1/api-keys/:id` — Revoke API key

API keys can be used as `Authorization: Bearer isk_...` tokens for protected endpoints that accept them.

### Jobs & Newsletter

- `GET /api/v1/jobs` — List open jobs
- `POST /api/v1/jobs` — Post a job (requires auth)
- `POST /api/v1/newsletter/subscribe` — Subscribe an email
- `GET /api/v1/newsletter/count` — Subscriber count
- `GET /api/v1/writer/earnings` — Total tips received (requires auth)
- `GET /api/v1/writer/stats` — Post/view/like/follower stats (requires auth)

### Health

- `GET /health` — Liveness check
- `GET /ready` — Readiness check (database ping)

## Current Implementation Notes

| Feature | Status | Notes |
|---------|--------|-------|
| Next.js 14 frontend | ✅ Implemented | Builds, renders, has auth/editor/feed pages |
| Go REST API | ✅ Implemented | Plain `net/http` with custom mux |
| PostgreSQL schema | ✅ Implemented | Migrations in `backend/sql/migrations` |
| JWT access + refresh | ✅ Implemented | HS256, 24h access, 7d refresh, separate secrets |
| API key auth | ✅ Implemented | Hashed keys with `isk_` prefix and scoped permissions |
| Post CRUD + feeds | ✅ Implemented | Latest/trending feeds, draft/published/archived states |
| Social features | ✅ Implemented | Follows, likes, comments, bookmarks, history, notifications |
| Redis caching | ⚠️ Not wired | Container exists; backend uses in-memory rate limiting only |
| NATS JetStream | ⚠️ Not wired | Container exists; no backend consumer or publisher besides a stub client |
| MeiliSearch | ⚠️ Not wired | Search endpoints use plain SQL `LIKE` |
| TimescaleDB hypertables | ⚠️ Not created | PostgreSQL with TimescaleDB extension available, but used as regular PG |
| Razorpay payments | ❌ Not implemented | Env vars only |
| Email delivery worker | ❌ Not implemented | `Dockerfile.worker` exists but no `cmd/worker` implementation |
| Feed worker | ❌ Not implemented | `Dockerfile.feed` exists but no `cmd/feedworker` implementation |
| RSS / sitemap / robots.txt | ❌ Not implemented | Caddy routes are commented out |
| CDN / R2 uploads | ❌ Not implemented | Env vars only |
| SMTP email sending | ❌ Not implemented | Env vars only |
| OAuth login | ❌ Not implemented | Planned |

## Performance Features

| Feature | Implementation |
|---------|----------------|
| API Latency | Plain `net/http` + `pgx`; no sub-100ms guarantee without load testing |
| Feed Generation | SQL `ORDER BY` on `posts` table (no Redis/hybrid fanout yet) |
| Database | Connection pooling (`MaxOpenConns=25`, `MaxIdleConns=5`), partial indexes on published posts |
| Frontend | Next.js ISR, image optimization, code splitting |
| Caching | Currently in-memory; Redis available for future integration |
| CDN | Cloudflare/R2 env vars only; no implementation |

## Security

- JWT authentication with short-lived access tokens and separate refresh-token secret
- bcrypt password hashing
- In-memory IP-based rate limiting on registration (10/min) and login (5/min)
- CORS middleware configured for `*` (review for production)
- Security headers via Caddy: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- `auto_https off` in Caddyfile for local development (enable HTTPS for production)

> The project does **not** currently implement refresh-token rotation/persistence, RS256 signing, Redis-backed distributed rate limiting, or CSP headers. These are production-hardening items on the roadmap.

## Roadmap

### Phase 1: Core Platform ✅

- [x] User authentication (JWT)
- [x] Post creation and publishing
- [x] Rich text editor (TipTap)
- [x] Follow system
- [x] Basic latest/trending feed

### Phase 2: Growth

- [ ] Newsletter system with email delivery
- [ ] Search with MeiliSearch
- [ ] RSS feed generation
- [ ] Sitemap auto-generation
- [ ] Social sharing optimization
- [ ] Google/GitHub OAuth

### Phase 3: Monetization

- [ ] Razorpay integration
- [ ] Premium posts
- [ ] Subscription management
- [ ] Payout system

### Phase 4: Scale

- [ ] Kubernetes deployment
- [ ] PostgreSQL read replicas
- [ ] CDN optimization
- [ ] Analytics dashboard
- [ ] Hybrid push/pull feed with Redis

## License

MIT License — see LICENSE file for details.

## Contributing

Contributions are welcome! Please read the pull request template and ensure CI passes before submitting.

## Acknowledgments

- [Next.js](https://nextjs.org/) — React framework
- [TipTap](https://tiptap.dev/) — Rich text editor
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [Radix UI](https://www.radix-ui.com/) — Accessible primitives
- [PostgreSQL](https://www.postgresql.org/) — Relational database
- [TimescaleDB](https://www.timescale.com/) — Time-series extension (planned)
- [MeiliSearch](https://www.meilisearch.com/) — Search engine (planned)
- [Caddy](https://caddyserver.com/) — Reverse proxy
