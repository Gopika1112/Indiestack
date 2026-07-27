# IndieStack

A self-hosted, high-performance Substack/Medium-like content platform optimized for the Indian market with SEO, newsletters, and monetization.

## 🚀 Features

- **Modern Stack**: Next.js 14 (App Router) + Go Fiber + PostgreSQL with TimescaleDB
- **SEO Optimized**: ISR, dynamic metadata, sitemap generation, OpenGraph tags
- **Rich Editor**: TipTap editor with markdown support, images, and embeds
- **Social Features**: Follow system, user profiles, public feeds
- **Hybrid Feed**: Push feed for small creators, pull feed for large creators
- **Performance**: Redis caching, CDN-ready, sub-100ms API responses
- **Security**: JWT authentication, rate limiting, input sanitization
- **Monetization**: Razorpay integration for paid subscriptions (India-focused)

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Caddy     │────▶│  Next.js    │────▶│  Go API     │
│   (Proxy)   │     │  (Frontend) │     │  (Backend)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                   ┌─────────────┬──────────────┼─────────────┐
                   │             │              │             │
                   ▼             ▼              ▼             ▼
              ┌─────────┐  ┌─────────┐   ┌─────────┐  ┌─────────┐
              │PostgreSQL│  │  Redis  │   │  NATS   │  │ Meili-  │
              │+Timescale│  │ (Cache) │   │(Queue)  │  │ search  │
              └─────────┘  └─────────┘   └─────────┘  └─────────┘
```

## 📁 Project Structure

```
indiestack/
├── backend/           # Go Fiber API
│   ├── cmd/api/       # Main entry point
│   ├── internal/      # Internal packages
│   │   ├── handlers/  # HTTP handlers
│   │   ├── middleware/# Auth, rate limiting
│   │   ├── models/    # Domain models
│   │   ├── repository/# sqlc generated
│   │   └── services/  # Business logic
│   ├── pkg/           # Shared packages
│   │   ├── database/  # PostgreSQL connection
│   │   ├── cache/     # Redis client
│   │   └── queue/     # NATS client
│   └── sql/           # Migrations & queries
├── frontend/          # Next.js 14 App Router
│   ├── app/           # App router pages
│   ├── components/    # React components
│   └── lib/           # Utilities, API client
├── docker-compose.yml # Infrastructure setup
└── Caddyfile          # Reverse proxy config
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.21+ (for local development)
- Node.js 20+ (for local development)

### Using Docker Compose

1. Clone the repository:
```bash
git clone https://github.com/yourusername/indiestack.git
cd indiestack
```

2. Copy environment file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start all services:
```bash
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost:8080
- API: http://localhost:8080/api/v1
- MeiliSearch: http://localhost:7700

### Local Development

**Backend:**
```bash
cd backend
cp .env.example .env
go mod download

# Run migrations
cd sql/migrations
goose postgres "postgres://indiestack:indiestack_secret@localhost:5432/indiestack?sslmode=disable" up

# Generate sqlc code
sqlc generate

# Run server
go run cmd/api/main.go
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🗄️ Database Schema

### Core Tables

- **users**: User accounts with OAuth support
- **posts**: Blog posts with draft/published states
- **follows**: User follow relationships
- **newsletter_subscriptions**: Email subscriptions
- **payments**: Razorpay payment records

### Time-Series Tables (TimescaleDB)

- **post_analytics**: Views, likes, shares (compressed after 7 days)
- **email_events**: Email delivery tracking

## 🔌 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh tokens
- `GET /api/v1/auth/me` - Get current user

### Users
- `GET /api/v1/users/:username` - Get user profile
- `PUT /api/v1/users/me` - Update profile
- `POST /api/v1/users/:username/follow` - Follow user

### Posts
- `GET /api/v1/posts/slug/:username/:slug` - Get post
- `POST /api/v1/posts` - Create post
- `PUT /api/v1/posts/:id` - Update post
- `POST /api/v1/posts/:id/publish` - Publish post

### Feed
- `GET /api/v1/feed` - Personalized feed
- `GET /api/v1/feed/trending` - Trending posts
- `GET /api/v1/feed/latest` - Latest posts

## ⚡ Performance Features

| Feature | Implementation |
|---------|----------------|
| API Latency | < 100ms p95 via Fiber + sqlc |
| Feed Generation | Hybrid push/pull with Redis caching |
| Database | Connection pooling, prepared statements, partial indexes |
| Frontend | Next.js ISR, image optimization, code splitting |
| Caching | Redis for sessions, feeds, rate limiting |
| CDN | Ready for Cloudflare/R2 integration |

## 🔒 Security

- JWT authentication with short-lived access tokens
- Refresh token rotation
- Rate limiting via Redis
- Input validation with go-playground/validator
- Automatic HTTPS via Caddy
- Security headers (CSP, HSTS, X-Frame-Options)

## 🛣️ Roadmap

### Phase 1: Core Platform ✅
- [x] User authentication (JWT + OAuth)
- [x] Post creation and publishing
- [x] Rich text editor (TipTap)
- [x] Follow system
- [x] Feed system (hybrid push/pull)

### Phase 2: Growth
- [ ] Newsletter system with email delivery
- [ ] Search with Meilisearch
- [ ] RSS feed generation
- [ ] Sitemap auto-generation
- [ ] Social sharing optimization

### Phase 3: Monetization
- [ ] Razorpay integration
- [ ] Premium posts
- [ ] Subscription management
- [ ] Payout system

### Phase 4: Scale
- [ ] Kubernetes deployment
- [ ] Read replicas for PostgreSQL
- [ ] CDN optimization
- [ ] Analytics dashboard

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.

## 🙏 Acknowledgments

- [Fiber](https://gofiber.io/) - Web framework
- [Next.js](https://nextjs.org/) - React framework
- [TipTap](https://tiptap.dev/) - Rich text editor
- [TimescaleDB](https://www.timescale.com/) - Time-series database
- [Meilisearch](https://www.meilisearch.com/) - Search engine
