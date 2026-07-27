# IndieStack Architecture

## System Overview

IndieStack is a modular monolith with async services, designed for high performance and scalability.

## Components

### 1. Frontend (Next.js 14)

**Responsibilities:**
- Server-side rendering (SSR) for SEO
- Incremental Static Regeneration (ISR) for blog pages
- Client-side interactivity
- Static site generation for public content

**Key Features:**
- App Router with dynamic routes `/@username/post-slug`
- React Server Components for data fetching
- TipTap editor for rich text editing
- Zustand for client state management
- Tailwind CSS for styling

### 2. Backend API (Go + Fiber)

**Responsibilities:**
- REST API endpoints
- Authentication & authorization
- Business logic
- Database access via sqlc

**Key Features:**
- Stateless design
- Fiber framework for low latency
- sqlc for type-safe SQL
- JWT authentication
- Rate limiting middleware

### 3. Database (PostgreSQL + TimescaleDB)

**Core Tables:**
- `users`: User accounts, OAuth IDs, follower counts
- `posts`: Blog posts, content (JSONB), metadata
- `follows`: Many-to-many follower relationships
- `newsletter_subscriptions`: Email subscriptions
- `payments`: Razorpay payment records
- `refresh_tokens`: JWT refresh token storage

**Time-Series Tables (TimescaleDB):**
- `post_analytics`: Views, likes, shares
- `email_events`: Email delivery tracking

**Optimizations:**
- Connection pooling (pgx)
- Prepared statements (sqlc)
- Partial indexes on hot paths
- Separate transactional and analytics tables

### 4. Cache (Redis)

**Usage:**
- Session storage
- Feed caching (5 min TTL)
- Rate limiting counters
- Top posts cache

### 5. Queue (NATS JetStream)

**Streams:**
- `emails`: Async email delivery
- `notifications`: User notifications
- `feed-updates`: Feed fanout events
- `analytics`: Analytics ingestion

### 6. Search (Meilisearch)

**Indexes:**
- `posts`: Full-text search, autocomplete
- `users`: User search

### 7. Storage (Cloudflare R2)

**Usage:**
- Image uploads
- Static assets
- Direct client upload via signed URLs

### 8. Proxy (Caddy)

**Features:**
- Automatic HTTPS
- HTTP/3 support
- Brotli compression
- Reverse proxy to services

## Data Flow

### Publishing a Post

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

### Reading Feed

```
User -> Next.js -> Go API -> Redis (cached?)
                              |
                              ├─ Yes -> Return cached
                              |
                              └─ No  -> PostgreSQL (pull feed)
                                        Redis (small creators)
                                        Merge & Cache
```

### Email Delivery

```
API -> NATS (email) -> Email Worker -> SMTP Server
         |
         └─ Retry (3x) -> Dead Letter Queue
```

## Performance Strategy

### Database
- Use connection pooling (pgx + pgbouncer)
- sqlc generates prepared statements
- Partial indexes for published posts
- Avoid N+1 queries

### Caching
| Data | Store | TTL | Strategy |
|------|-------|-----|----------|
| User sessions | Redis | 7 days | Write-through |
| User feeds | Redis | 5 min | Write-behind |
| Top posts | Redis | 10 min | Cache-aside |
| Post content | Redis | 1 hour | Cache-aside |
| HTML pages | CDN | 1 min | ISR |

### Feed Algorithm

**Small Creators (< 10k followers):**
- Push feed: On publish, fan out to each follower's Redis list
- Fast reads: O(1) LPOP from Redis

**Large Creators (≥ 10k followers):**
- Pull feed: Query database on feed request
- Cached for 5 minutes

**Hybrid Merge:**
1. Get push feed items from Redis
2. Get pull feed items from DB
3. Merge and sort by published_at
4. Return top N, cache result

## Scaling Roadmap

### Phase 1: Single Server (1-10K users)
- Docker Compose on single machine
- All services on one host
- Database with default configuration

### Phase 2: Separated Services (10K-100K users)
- Separate DB server
- Redis cluster
- CDN for static assets
- Horizontal API scaling

### Phase 3: Distributed (100K-1M users)
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

## Security

### Authentication
- JWT with RS256 (asymmetric signing)
- Short-lived access tokens (15 min)
- Refresh tokens with rotation
- OAuth 2.0 for social login

### Authorization
- Role-based access control
- Resource-level permissions
- Premium content gating

### Infrastructure
- Automatic HTTPS
- Security headers (CSP, HSTS)
- Rate limiting per IP/user
- Input validation and sanitization
- Non-root Docker containers

## Monitoring

### Metrics
- Request latency (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Cache hit/miss rates
- Queue depth

### Logging
- Structured JSON logs
- Request ID correlation
- Error tracking
- Audit logs for sensitive operations

### Health Checks
- `/health`: Basic liveness
- `/ready`: Dependency checks
- `/metrics`: Prometheus metrics
