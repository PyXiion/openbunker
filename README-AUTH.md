# Authentication System Implementation

This document describes the authentication system implemented using Casdoor SSO/OIDC with Prisma ORM.

## Overview

The Bunker game supports authentication with:
- **Guest users**: Play without registration (persistent profiles in database)
- **Authenticated users**: Login with Casdoor SSO
- **Account upgrade**: Guests can convert to full accounts
- **Secure sockets**: JWT-based authentication prevents ID spoofing
- **Bidirectional sync**: User data synced between database and Casdoor

## Architecture

### Backend Changes

1. **Casdoor Integration** (`/backend/src/auth/`)
   - `routes.ts`: Casdoor OAuth endpoints and webhook for bidirectional sync
   - `middleware.ts`: Socket.io authentication middleware
   - `database.ts`: Prisma ORM for user management
   - `routes.ts`: Auth API endpoints

2. **Security Improvements**
   - JWT verification in Socket.io handshake (not after connection)
   - Room-level authorization
   - No more persistent ID broadcasting

3. **Database Schema (Prisma)**
   - `Profile`: User profiles with guest/verified status
   - `UserStats`: Game statistics
   - `GameHistory`: Historical game records

### Frontend Changes

1. **Auth Composable** (`/frontend/composables/useAuth.ts`)
   - Casdoor client integration
   - Guest user management
   - Account upgrade flow

2. **Socket Updates** (`/frontend/composables/useSocket.ts`)
   - Secure authentication in handshake
   - Support for both JWT and guest auth

3. **UI Components**
   - `AuthButton.vue`: Login/guest/upgrade interface
   - Auth callback pages

## Infrastructure

### Docker Services

1. **Casdoor**: SSO/OIDC provider (port 8000)
2. **PostgreSQL**: User data and game history
3. **Backend**: Updated with auth middleware and Prisma (port 3001)
4. **Frontend**: Casdoor client integration (port 3000)

### Environment Variables

See `.env.example` for required configuration:
- Casdoor URL and client credentials
- Casdoor certificate for token verification
- Database connection (DATABASE_URL)

### Port Bindings

- **Casdoor**: `8000:8000` (SSO/OIDC)
- **Backend**: `3001:3001` (API and Socket.io)
- **Frontend**: `3000:3000` (Web UI)
- **PostgreSQL**: `5432:5432` (Database)

## Security Features

### Before (Insecure)
- Persistent IDs broadcasted in game data
- Anyone could impersonate any user
- No authentication required

### After (Secure)
- JWT-based authentication with Casdoor
- Secure Socket.io handshake
- Room-level authorization
- Guest user isolation
- Bidirectional Casdoor sync (IdP as source of truth)

## User Flows

### Guest User Flow
1. Click "Play as Guest"
2. Enter username
3. Profile created in database immediately (isGuest=true)
4. Play games with persistent profile
5. Option to upgrade later

### Authenticated User Flow
1. Click "Login"
2. Redirect to Casdoor
3. Login with email/password or social providers
4. Return with JWT token
5. Profile created/synced in database
6. Full access to all features

### Account Upgrade Flow
1. Guest user clicks "Save Account"
2. Redirect to Casdoor
3. Login or register
4. Guest profile linked to real account (isGuest=false)
5. Preserve game history and stats

### Username Update Flow
1. Authenticated user updates username via API
2. Casdoor API called first (IdP as source of truth)
3. Local database updated after Casdoor succeeds
4. Webhook ensures eventual consistency if DB update fails

## API Endpoints

### Authentication
- `POST /api/auth/guest` - Create guest user (persistent profile)
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/callback` - OAuth callback endpoint
- `POST /api/auth/upgrade` - Upgrade guest to real account
- `PUT /api/auth/username` - Update username (syncs with Casdoor first)
- `POST /api/auth/casdoor/webhook` - Casdoor webhook for bidirectional sync

### Game History & Statistics
- `GET /api/auth/game-history?limit=20` - Get user's game history (authenticated only)
- `GET /api/auth/stats` - Get user's aggregate statistics (authenticated only)

### Socket.io Events
- All connections require authentication
- Use `auth.token` or `auth.guest` in handshake
- Room-level authorization enforced

## Database Schema (Prisma)

### Models

**Profile**
- `id`: User ID (primary key)
- `username`: Display name (unique)
- `email`: Email address (nullable)
- `avatarUrl`: Profile picture (nullable)
- `isGuest`: Guest status flag
- `createdAt`: Profile creation timestamp
- `updatedAt`: Last update timestamp (auto-updated)
- `lastLogin`: Last login timestamp (nullable)

**UserStats**
- `profileId`: Reference to Profile (primary key)
- `gamesPlayed`: Total games played
- `gamesWon`: Total games won
- `totalPlaytimeMinutes`: Total playtime in minutes
- `bunkerSurvivalRate`: Survival rate percentage
- `createdAt`: Stats creation timestamp
- `updatedAt`: Last update timestamp (auto-updated)

**GameHistory**
- `id`: Game record ID (UUID)
- `roomId`: Room identifier
- `profileId`: Reference to Profile (nullable, SET NULL on delete)
- `playerName`: Player name at time of game
- `gameStatus`: Game outcome
- `wasExiled`: Whether player was exiled
- `survived`: Whether player survived
- `finalRound`: Final round reached (nullable)
- `playersCount`: Total players in game
- `bunkerCapacity`: Bunker capacity
- `catastropheId`: Catastrophe identifier (nullable)
- `playedAt`: Game timestamp
- `durationMinutes`: Game duration (nullable)

### Migrations

Database migrations are managed by Prisma:
- Schema defined in `backend/prisma/schema.prisma`
- Migrations in `backend/prisma/migrations/`
- Automatic migration on Docker container startup
- Use `npx prisma migrate dev` for development
- Use `npx prisma migrate deploy` for production

## Migration Notes

### Database Migration
- Prisma migrations handle schema changes
- Existing game data preserved during migration
- New user management tables added via Prisma

### Breaking Changes
- Socket.io connections now require authentication
- Persistent ID system removed
- Frontend must use new auth flow
- Database now uses Prisma ORM instead of raw SQL

## Development Setup

1. Copy `.env.example` to `.env` and configure
2. Run `docker-compose up` to start all services
3. Access Casdoor console at `http://localhost:8000`
4. Configure Casdoor application and organization
5. Update environment variables with actual values

## Production Considerations

1. **Security**
   - Use HTTPS in production
   - Configure proper CORS origins
   - Verify webhook signatures for Casdoor sync
   - Use strong Casdoor client secrets

2. **Performance**
   - Prisma connection pooling configured
   - Database indexes for user queries
   - Connection limit configured for horizontal scaling

3. **Monitoring**
   - Log authentication events
   - Monitor failed login attempts
   - Track guest account usage
   - Monitor Casdoor webhook delivery

## Troubleshooting

### Common Issues

1. **Socket connection failed**
   - Check authentication token validity
   - Verify Casdoor is accessible
   - Check CORS configuration

2. **Guest user creation failed**
   - Verify backend service is running
   - Check database connection
   - Review error logs

3. **Casdoor callback errors**
   - Verify redirect URI configuration
   - Check client ID and secret
   - Review Casdoor logs

4. **Prisma migration errors**
   - Verify DATABASE_URL is correct
   - Check PostgreSQL is accessible
   - Run `npx prisma migrate reset` if needed

### Debug Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f casdoor

# Access database
docker-compose exec postgres psql -U postgres -d bunker

# Run Prisma migrations
cd backend
npx prisma migrate dev
```

## Future Enhancements

1. **Social Providers**: Add more Casdoor providers
2. **User Profiles**: Enhanced profile management with avatars
3. **Game Statistics**: Detailed analytics dashboard with leaderboards
4. **Moderation**: User reporting and moderation tools
5. **Multi-tenant**: Support for multiple game instances
6. **Achievements**: Unlockable achievements based on game statistics
