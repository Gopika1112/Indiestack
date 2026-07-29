# IndieStack Architecture

## System Overview

IndieStack is a modular monolith that ships as a Docker Compose stack. It currently operates as a **working MVP/prototype**: the Next.js frontend and the Go backend API are wired together and backed by PostgreSQL. Redis, NATS, MeiliSearch, and TimescaleDB time-series features are provided as containers but are **not yet integrated into the backend code**. The document below describes the real architecture today, with planned capabilities clearly marked as *future*.

---

## Components

### 1. Frontend (Next.js 14)

**Responsibilities:**

- Server-side rendering (SSR) for SEO
- Incremental Static Regeneration (ISR) for public blog pages
- Client-side interactivity
- Static site generation for public content

**Key Features:**

- App Router with dynamic routes `/:username/:slug`
- React Server Components for data fetching
- TipTap editor for rich text editing
- Zustand for client state management
- Tailwind CSS for styling

> Note: The route convention is `/:username/:slug`, not `/@username/post-slug`.

---

### 2. Backend API (Go + Standard Library `net/http`)

**Responsibilities:**

- REST API endpoints
- Authentication & authorization
- Business logic
- Direct database access via `database/sql` with the `pgx` driver

**Key Features:**

- Stateless design
- Plain `net/http` custom mux (not Fiber, not sqlc)
- JWT authentication (HS256, access + refresh tokens)
- In-memory IP-based rate limiting
- bcrypt password hashing
- Handlers split between `main.go` (core auth/posts/feeds/users/API keys) and `penmark_handlers.go` (social features, jobs, newsletter, etc.)

**Important:** The project does **not** currently use Go Fiber, sqlc, `pgbouncer`, or prepared-statement generation. The earlier documentation incorrectly described these as implemented; this file has been corrected.

---

### 3. Database (PostgreSQL + TimescaleDB extension available)

**Core Tables:**

- `users`: user accounts, bcrypt password hashes, profile metadata, cached follower/following counts
- `posts`: blog posts, JSONB content, status (draft/published/archived), cached engagement counts
- `follows`: many-to-many follower relationships
- `likes`: post likes
- `comments`: threaded comments (with `parent_id`)
- `bookmarks`: saved posts
- `reading_history`: per-user read tracking
- `notifications`: in-app notifications
- `api_keys`: scoped, hashed programmatic keys with prefix lookup
- `profiles`: extended professional profile data
- `jobs`: job board listings
- `companies`: job company metadata
- `newsletter_subscriptions`: email subscribers
- `tips`: one-time creator support
- `post_analytics`: planned time-series table (regular table today)
- `email_events`: planned time-series table (regular table today)
- `refresh_tokens`: not currently used; refresh tokens are stateless JWTs today

**Optimizations:**

- Connection pooling configured in `main.go` (`MaxOpenConns=25`, `MaxIdleConns=5`, `ConnMaxLifetime=5m`)
- Partial indexes on hot paths (e.g., published posts, slugs, API key prefixes)
- Separate transactional and analytics tables (analytics not yet populated)

**TimescaleDB:**

The PostgreSQL image includes the TimescaleDB extension, but no hypertables or compression policies are created. `post_analytics` and `email_events` exist as regular tables until the analytics/tracking features are built.

---

### 4. Cache (Redis — container only, not wired)

**Container provided:** `redis:7-alpine` on port 6379.

**Planned usage:**

- Session storage
- Feed caching (5 min TTL)
- Rate limiting counters
- Top posts cache

**Current state:** The backend uses an **in-memory** `rateLimiter` for IP-based rate limiting. Redis is not imported or connected in the Go code.

---

### 5. Queue (NATS JetStream — container only, not wired)

**Container provided:** `nats:latest` with JetStream enabled on port 4222 (monitoring on 8222).

**Planned streams:**

- `emails`: async email delivery
- `notifications`: user notifications
- `feed-updates`: feed fanout events
- `analytics`: analytics ingestion

**Current state:** The backend includes a small `internal/queue` package and publishes a `FeedEvent` when a post is published, but there is no running consumer, no `cmd/worker`, and no NATS publisher implementation. The `email-worker` and `feed-worker` services in `docker-compose.yml` reference Dockerfiles that have no runnable code.

---

### 6. Search (MeiliSearch — container only, not wired)

**Container provided:** `getmeili/meilisearch:latest` on port 7700.

**Planned indexes:**

- `posts`: full-text search, autocomplete
- `users`: user search

**Current state:** Search endpoints use plain SQL `LIKE` against `posts.title` and `posts.excerpt`. No documents are indexed in MeiliSearch.

---

### 7. Storage (Cloudflare R2 — not implemented)

**Planned usage:**

- Image uploads
- Static assets
- Direct client upload via signed URLs

**Current state:** Env vars exist (`R2_*`) but no upload implementation is present. Cover images are stored as plain URLs.

---

### 8. Proxy (Caddy)

**Features:**

- Reverse proxy to services
- Gzip compression
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy)
- `auto_https off` for local development

**Not yet implemented:**

- HTTP/3
- Brotli compression
- `/rss/*`, `/sitemap.xml`, `/robots.txt` routes (commented out in `Caddyfile` because backend handlers do not exist)
- Automatic HTTPS (disabled locally; must be enabled for production)

---

## Data Flow

### Publishing a Post (current)

```
User -> Next.js -> Go API -> PostgreSQL
```

A `FeedEvent` is also published to the local `queue.Client` stub, but no worker processes it yet. Future flow:

```
User -> Next.js -> Go API -> PostgreSQL
                    |
                    v
               NATS (feed-update)
                    |
                    v
              Feed Worker -> Redis (push to followers)
                    |
                    v
              Meilisearch (index post)
```

### Reading Feed (current)

```
User -> Next.js -> Go API -> PostgreSQL (ORDER BY published_at DESC)
```

Future planned flow:

```
User -> Next.js -> Go API -> Redis (cached?)
                              |
                              ├─ Yes -> Return cached
                              |
                              └─ No  -> PostgreSQL (pull feed)
                                        Redis (small creators)
                                        Merge & Cache
```

### Email Delivery (not implemented)

Planned flow once workers exist:

```
API -> NATS (email) -> Email Worker -> SMTP Server
         |
         └─ Retry (3x) -> Dead Letter Queue
```

---

## Performance Strategy

### Database

- Use connection pooling (`pgx` via `database/sql`)
- Partial indexes for published posts
- Avoid N+1 queries where practical
- `sqlc` and `pgbouncer` are *not* currently used

### Caching

| Data | Store | TTL | Strategy | Status |
|------|-------|-----|----------|--------|
| User sessions | Redis | 7 days | Write-through | Planned |
| User feeds | Redis | 5 min | Write-behind | Planned |
| Top posts | Redis | 10 min | Cache-aside | Planned |
| Post content | Redis | 1 hour | Cache-aside | Planned |
| HTML pages | CDN | 1 min | ISR | Partial |

### Feed Algorithm (planned)

**Small Creators (< 10k followers):**

- Push feed: on publish, fan out post IDs to each follower's Redis list
- Fast reads: O(1) LPOP from Redis

**Large Creators (≥ 10k followers):**

- Pull feed: query database on feed request
- Cached for 5 minutes

**Hybrid Merge:**

1. Get push feed items from Redis
2. Get pull feed items from DB
3. Merge and sort by `published_at`
4. Return top N, cache result

**Current implementation:** all feeds are SQL `ORDER BY` queries with no Redis fanout.

---

## Scaling Roadmap

### Phase 1: Single Server (1–10K users)

- Docker Compose on a single machine
- All services on one host
- PostgreSQL with default configuration
- In-memory rate limiting

### Phase 2: Separated Services (10K–100K users)

- Separate DB server
- Redis cluster for caching + rate limiting
- CDN for static assets
- Horizontal API scaling

### Phase 3: Distributed (100K–1M users)

- Kubernetes deployment
- PostgreSQL read replicas
- NATS cluster
- Meilisearch cluster
- Regional deployment

### Phase 4: Global Scale (1M+ users)

- Multi-region PostgreSQL
- Edge caching (Cloudflare Workers)
- Service mesh
- ML-based feed ranking

---

## Security

### Authentication (current)

- JWT with HS256 (symmetric signing)
- Access tokens: 24 hours
- Refresh tokens: 7 days
- Separate `JWT_SECRET` and `JWT_REFRESH_SECRET` environment variables
- bcrypt password hashing

**Not yet implemented:**

- RS256 asymmetric signing
- Refresh token rotation or persistence
- OAuth 2.0 social login
- OAuth state validation

### Authorization

- JWT-based authentication + optional API key authentication with scoped permissions
- API key management is JWT-only (you cannot manage API keys with an API key)
- Resource ownership checks for posts, profiles, and API keys
- `profile:read`, `profile:write`, `posts:read`, `posts:write`, `feed:read` scopes for API keys

**Not yet implemented:**

- Role-based access control
- Premium content gating
- Subscription authorization checks

### Infrastructure

- Caddy security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- `auto_https off` in local Caddyfile (must be enabled for production)
- Non-root Docker containers where possible

**Not yet implemented:**

- Content-Security-Policy (CSP) headers
- HSTS enforcement
- Distributed rate limiting
- Input/output sanitization beyond basic validation
- Audit logging for sensitive operations

---

## Monitoring

### Metrics (planned)

- Request latency (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Cache hit/miss rates
- Queue depth

### Logging (current)

- Basic Go `log` output for startup and errors
- No structured JSON logs or request ID correlation yet

### Health Checks (current)

- `/health`: basic liveness (always returns `{"status":"healthy"}`)
- `/ready`: database ping check
- `/metrics`: Prometheus metrics endpoint is **not** implemented

---

## Implementation Notes

- The backend is **not** using Fiber, sqlc, or `go-playground/validator`. It is a single-package `net/http` application with manual SQL and validation.
- Redis, NATS, and MeiliSearch containers start with Docker Compose but are not used by the backend code. They are placeholders for future Phase 2/3 work.
- `docker-compose.yml` includes `email-worker` and `feed-worker` services, but the corresponding `cmd/worker` and `cmd/feedworker` packages do not exist.
- The `queue` package publishes a `FeedEvent` but no consumer processes it; the event is effectively a no-op today.
- The `Caddyfile` has RSS/sitemap/robots routes commented out because no backend handlers exist.
- TimescaleDB hypertables are not created; the extension is available but unused.

