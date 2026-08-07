# Build the Astro static site, then serve it with a lightweight static file server.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Serve the static output. Astro's `preview` is dev-oriented; use a minimal static server.
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=builder /app/dist ./dist
EXPOSE 4321
# serve the static dist on port 4321. NOTE: no `-s` (single-page-app) flag — we want
# real file serving with proper 404s, not an index.html fallback for every path.
CMD ["serve", "dist", "-l", "4321", "--no-clipboard"]
