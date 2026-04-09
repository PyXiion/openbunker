# Configuration Guide

This document covers the application configuration options and environment variables.

## TOML Configuration

The application uses a TOML configuration file (`config.toml`) to manage magic constants and application settings. This provides a centralized way to configure game parameters, server timeouts, and other settings without modifying code.

### Setting Up Configuration

1. Copy the example configuration:
```bash
cp config.example.toml config.toml
```

2. Customize `config.toml` as needed for your environment.

3. Set the `BUNKER_CONFIG` environment variable to point to your config file:
```bash
export BUNKER_CONFIG=./config.toml
```

If `BUNKER_CONFIG` is not set, the application will use default values.

### Configuration Sections

#### Server Configuration

Controls WebSocket compression, rate limiting, and server timeouts:

```toml
[server]
compression_threshold = 1024
compression_level = 3
compression_mem_level = 7
rate_limit_window_ms = 900000
rate_limit_max = 100
health_check_timeout_ms = 3000
server_timeout_ms = 30000
keep_alive_timeout_ms = 65000
headers_timeout_ms = 66000
graceful_shutdown_timeout_ms = 10000
```

#### Database Configuration

Controls database connection timeouts and cleanup settings:

```toml
[database]
idle_timeout_ms = 30000
connection_timeout_ms = 2000
guest_profile_cleanup_days = 30
```

#### Content Filter Configuration

Controls profanity filter cache behavior:

```toml
[content_filter]
cache_max = 1000
cache_ttl_ms = 3600000
```

#### Game Configuration

Controls game mechanics and resource values:

```toml
[game]
min_players = 2
max_players = 12
bunker_capacity_ratio = 0.4
food_per_person = 30
water_per_person = 30
medicine_per_person = 10
default_power = 100
```

#### Social Configuration

Controls social media links displayed in the footer:

```toml
[social]
telegram_url = "https://t.me/PyXiion_channel"
discord_url = "https://discord.gg/KpAMMCdcrJ"
```

### Docker Configuration

When using Docker Compose, mount your `config.toml` file as a volume:

```yaml
volumes:
  - ./config.toml:/app/config.toml:ro
```

The configuration is loaded at build time for the frontend and at runtime for the backend.

## Environment Variables

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `BACKEND_DOMAIN` | `http://localhost:3001` | Backend URL |
| `FRONTEND_DOMAIN` | `http://localhost:3000` | Frontend URL |
| `CASDOOR_DOMAIN` | `http://localhost:8000` | Casdoor SSO URL |

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `3001` | Server port |
| `WS_PATH` | `/socket.io/` | WebSocket path |

### Casdoor Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `CASDOOR_URL` | `http://localhost:8000` | Casdoor instance URL |
| `CASDOOR_ENDPOINT` | `http://casdoor:8000` | Casdoor endpoint (Docker) |
| `CASDOOR_CLIENT_ID` | - | OAuth client ID |
| `CASDOOR_CLIENT_SECRET` | - | OAuth client secret |
| `CASDOOR_APP_NAME` | "Open Bunker" | Casdoor application name |
| `CASDOOR_ORG_NAME` | "Open Bunker" | Casdoor organization name |
| `CASDOOR_CERT` | - | Casdoor certificate for token verification |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@postgres:5432/bunker` | PostgreSQL connection string |
| `DATABASE_HOST` | `postgres` | Database host |
| `DATABASE_PORT` | `5432` | Database port |
| `DATABASE_NAME` | `bunker` | Database name |
| `DATABASE_USER` | `postgres` | Database user |
| `DATABASE_PASSWORD` | `postgres` | Database password |
| `DATABASE_SSL` | `false` | Enable SSL for database |
