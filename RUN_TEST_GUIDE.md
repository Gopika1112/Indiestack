# IndieStack — Run & Manual Test Guide

This document explains how to run the IndieStack application locally and perform basic manual smoke tests.

---

## 1. Prerequisites

- **Docker Engine / Docker Desktop** installed and running.
- **Docker Compose** (the `docker-compose` CLI or `docker compose` plugin) installed.
- Git client (for cloning / pulling the repo).
- Optional but useful: `curl` on Linux/macOS or `Invoke-WebRequest` on Windows PowerShell.

No manual PostgreSQL, Redis, or NATS installation is required — everything runs inside Docker.

---

## 2. Quick Start

### 2.1 Clone the repository

```bash
git clone https://github.com/CyberScythe1/Indiestack.git
cd Indiestack
```

### 2.2 Create the environment file

```bash
cp .env.example .env
```

The project is configured with local development defaults, so you normally do **not** need to edit `.env` for a first run.  
For production deployments you must set strong secrets for `JWT_SECRET`, `MEILI_MASTER_KEY`, database passwords, etc.

### 2.3 Build and start the stack

```bash
docker-compose up -d --build
```

First build can take several minutes because the frontend, Go backend, and workers all compile from source.  
Once the command returns, wait another 30–60 seconds for the database migrations and service healthchecks to settle.

### 2.4 Verify all containers are running

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

You should see the following containers in a healthy state:

| Container | Purpose | Exposed on host |
|-----------|---------|-----------------|
| `indiestack-postgres` | PostgreSQL + TimescaleDB | `5432` |
| `indiestack-redis` | Cache / pub-sub | `6379` |
| `indiestack-nats` | Message queue (JetStream) | `4222`, `8222` |
| `indiestack-meilisearch` | Search engine | `7700` |
| `indiestack-api` | Go REST API | `3001` |
| `indiestack-nextjs` | Next.js frontend | `3000` |
| `indiestack-worker` | Email worker | internal |
| `indiestack-feedworker` | Feed aggregation worker | internal |
| `indiestack-caddy` | Reverse proxy / static file server | `8080`, `80` |

### 2.5 View logs

```bash
# All services
docker-compose logs -f

# Individual services
docker-compose logs -f nextjs
docker-compose logs -f api
docker-compose logs -f feedworker
```

---

## 3. Service URLs

Use the Caddy gateway (`8080`) for normal access.  Direct backend ports are useful for debugging only.

| Endpoint | URL | Notes |
|----------|-----|-------|
| Frontend home / feed | `http://localhost:8080/feed` | Root `/` redirects here (HTTP 307). |
| Login page | `http://localhost:8080/login` | |
| API health | `http://localhost:8080/health` | Returns `{ "status": "ok" }`. |
| API base | `http://localhost:8080/api/v1` | All API routes are prefixed with `/api/v1`. |
| Direct API | `http://localhost:3001/health` | Bypasses Caddy. |
| MeiliSearch dashboard | `http://localhost:7700` | Requires API key in production. |

---

## 4. Test Credentials

The local database is seeded with demo users for manual testing:

| Email | Password | Role |
|-------|----------|------|
| `alice@example.com` | `password` | Regular user |
| `bob@example.com` | `password` | Regular user |

> ⚠️ These are **local development credentials only**. Never commit production secrets or the `.env` file containing real passwords.

---

## 5. Manual Smoke Tests

### 5.1 Frontend pages

Open a browser and navigate to:

1. `http://localhost:8080/login` — should render the login form.
2. `http://localhost:8080/feed` — should render the public feed.
3. `http://localhost:8080/` — should redirect (HTTP 307) to `/feed`.

### 5.2 API health check

```bash
curl -i http://localhost:8080/health
```

Expected result:

```text
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok"}
```

On Windows PowerShell use:

```powershell
Invoke-WebRequest -Uri http://localhost:8080/health | Select-Object StatusCode,Content
```

### 5.3 Public feed endpoint

```bash
curl -i http://localhost:8080/api/v1/feed/latest
```

Expected result: `HTTP/1.1 200 OK` with a JSON array of feed items.

### 5.4 Login

```bash
curl -i -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password"}'
```

Expected result: `HTTP/1.1 200 OK` with a JSON body containing `token` and `user` fields.

You can save the token for subsequent authenticated requests:

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password"}' \
  | jq -r '.token' > token.txt

# Use the token for a protected endpoint
curl -i http://localhost:8080/api/v1/stats \
  -H "Authorization: Bearer $(cat token.txt)"
```

### 5.5 Protected endpoint

```bash
curl -i http://localhost:8080/api/v1/stats \
  -H "Authorization: Bearer <token-from-login>"
```

Without a valid token this endpoint returns `401 Unauthorized`.

---

## 6. Important Notes

- **Root redirect is intentional.** Visiting `/` returns `307 Temporary Redirect` to `/feed`. This is configured in the frontend and should not be changed.
- **JWT fallbacks are for development only.** The `docker-compose.yml` file sets safe placeholder values for `JWT_SECRET`, `MEILI_MASTER_KEY`, etc. Replace these before any production deployment.
- **Do not commit local test artifacts.** Files such as `login.json`, `login-response.json`, and `token.txt` are generated during manual testing and should remain untracked. The same applies to `PRIVATE_TRACKING.md` and `ADMIN_CREDENTIALS.md` — both are already excluded via `.gitignore`.
- **Module 9 is intentionally untouched.** QA/test automation work is outside the scope of this run/test guide.
- **If the frontend image still reports Next.js 14** in its startup logs, rebuild the `nextjs` service after committing the updated `frontend/package.json`:

  ```bash
  docker-compose up -d --build nextjs
  ```

- **Hot reload** is available for the frontend in development mode. Changes to Next.js pages under `frontend/app/` are reflected automatically inside the container.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `localhost:8080` refuses connection | Caddy container not running | `docker-compose up -d caddy` |
| Login returns `401` even with correct credentials | Database migrations not applied or seed data missing | `docker-compose logs postgres` and `docker-compose logs api` |
| Feed is empty | Feed worker has not run yet | Check `docker-compose logs feedworker`; it runs on a schedule |
| `docker-compose` command not found | Older Docker Desktop or missing plugin | Use `docker compose` instead of `docker-compose` |
| PowerShell `curl` syntax errors | `curl` is aliased to `Invoke-WebRequest` | Use `Invoke-WebRequest` or a real `curl.exe` binary |

---

## 8. Stopping the Stack

```bash
# Stop containers but keep volumes
docker-compose down

# Stop containers and remove all data (volumes, images)
docker-compose down -v --rmi all
```
