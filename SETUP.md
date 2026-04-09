# Bunker Game - Setup Guide

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

## Quick Start

```bash
# Copy environment file
cp .env.dev .env

# Start services
docker compose up -d
```

Access:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Zitadel Console**: http://localhost:8080/ui/console

## Zitadel Configuration

1. Login to Zitadel Console at `http://localhost:8080/ui/console`
   - Username: `zitadel-admin@zitadel.localhost`
   - Password: `Admin123!`

2. Create OIDC Client:
   - **Projects** → Select default project
   - **Applications** → **Web** → **New**
   - **Name**: bunker-frontend
   - **Redirect URIs**: `http://localhost:3000/auth/callback`
   - **Post Logout URIs**: `http://localhost:3000/`
   - **Authentication Method**: PKCE (none)
   - **Grant Types**: Authorization Code

3. Update `.env` with Client ID and Secret:
   ```bash
   ZITADEL_CLIENT_ID=<your-client-id>
   ZITADEL_CLIENT_SECRET=<your-client-secret>
   ZITADEL_PROJECT_ID=<your-project-id>
   ```

4. Restart backend: `docker compose restart backend`

## Production with Traefik

1. Copy and customize `.env`:
   ```bash
   cp .env.dev .env
   # Edit with production values
   ```

2. Add Traefik labels to docker-compose.yml:
   ```yaml
   services:
     frontend:
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.frontend.rule=Host(`your-domain.com`)"
         - "traefik.http.services.frontend.loadbalancer.server.port=3000"

     backend:
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.backend.rule=Host(`your-domain.com`) && PathPrefix(`/socket.io/`)"
         - "traefik.http.services.backend.loadbalancer.server.port=3001"

     zitadel:
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.zitadel.rule=Host(`your-domain.com`) && PathPrefix(`/auth/`)"
         - "traefik.http.services.zitadel.loadbalancer.server.port=8080"
   ```

3. Start services: `docker compose up -d`

4. Configure Zitadel with production redirect URIs

## Local Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

All configuration via environment variables. See `.env.example` for all options.

Key variables:
- `NODE_ENV`: development or production
- `BACKEND_DOMAIN`: Backend URL
- `FRONTEND_DOMAIN`: Frontend URL
- `ZITADEL_DOMAIN`: Zitadel URL
- `ZITADEL_CLIENT_ID`: OAuth client ID
- `ZITADEL_CLIENT_SECRET`: OAuth client secret
- `DATABASE_URL`: PostgreSQL connection string

## Troubleshooting

**Zitadel not accessible**: `docker compose ps zitadel` and check logs
**OAuth redirect errors**: Verify redirect URI matches Zitadel configuration
**Database connection errors**: Check DATABASE_URL in .env
**Services not using env vars**: Restart with `docker compose down && docker compose up -d`

## Guest Account Upgrade

To enable guest account promotion:

1. Create service account in Zitadel Console
2. Create service key (JSON format)
3. Grant PROJECT_OWNER role
4. Update `.env` with service account credentials
5. Change frontend to use `/auth/shadow-user` endpoint
6. Restart services
