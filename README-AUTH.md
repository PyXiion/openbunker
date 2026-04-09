# Authentication System Implementation

This document describes the new authentication system implemented using Zitadel OIDC.

## Overview

The Bunker game now supports enterprise-grade authentication with:
- **Guest users**: Play without registration
- **Authenticated users**: Login with email/password or social providers
- **Account upgrade**: Guests can convert to full accounts
- **Secure sockets**: JWT-based authentication prevents ID spoofing

## Architecture

### Backend Changes

1. **Zitadel Integration** (`/backend/src/auth/`)
   - `zitadel.ts`: Zitadel client with JWKS caching
   - `middleware.ts`: Socket.io authentication middleware
   - `database.ts`: PostgreSQL user management
   - `routes.ts`: Auth API endpoints

2. **Security Improvements**
   - JWT verification in Socket.io handshake (not after connection)
   - Room-level authorization
   - No more persistent ID broadcasting

3. **Database Schema**
   - `profiles`: User profiles with guest/verified status
   - `user_stats`: Game statistics
   - `game_history`: Historical game records

### Frontend Changes

1. **Auth Composable** (`/frontend/composables/useAuth.ts`)
   - OIDC client integration
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

1. **Zitadel**: OIDC provider with HTTP/2 support (port 8080)
2. **PostgreSQL**: User data and game history
3. **Backend**: Updated with auth middleware (port 3001)
4. **Frontend**: OIDC client integration (port 3000)
5. **External Reverse Proxy**: Traefik or similar for HTTP/2 and gRPC support

### Environment Variables

See `.env.example` for required configuration:
- Zitadel URL and client credentials
- Service account for shadow user creation
- Database connection

### Port Bindings

- **Zitadel**: `8080:8080` (HTTP/2 with h2c)
- **Backend**: `3001:3001` (API and Socket.io)
- **Frontend**: `3000:80` (Web UI)
- **PostgreSQL**: `5432:5432` (Database)

### External Reverse Proxy Notes

When using Traefik or similar:
- Configure HTTP/2 support for Zitadel gRPC endpoints
- Use h2c for development, https for production
- Ensure proper CORS configuration
- Handle WebSocket upgrade for Socket.io

## Security Features

### Before (Insecure)
- Persistent IDs broadcasted in game data
- Anyone could impersonate any user
- No authentication required

### After (Secure)
- JWT-based authentication
- Secure Socket.io handshake
- Room-level authorization
- Guest user isolation

## User Flows

### Guest User Flow
1. Click "Play as Guest"
2. Enter username
3. Get temporary guest account
4. Play games with limited features
5. Option to upgrade later

### Authenticated User Flow
1. Click "Login"
2. Redirect to Zitadel
3. Login with email/password or social
4. Return with JWT token
5. Full access to all features

### Account Upgrade Flow
1. Guest user clicks "Save Account"
2. Redirect to Zitadel
3. Login or register
4. Shadow user linked to real account
5. Preserve game history and stats

## API Endpoints

### Authentication
- `POST /api/auth/guest` - Create guest user
- `POST /api/auth/shadow-user` - Create shadow user with token
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/upgrade` - Upgrade guest to real account
- `POST /api/auth/callback` - OAuth callback endpoint
- `PUT /api/auth/username` - Update username

### Socket.io Events
- All connections now require authentication
- Use `auth.token` or `auth.guest` in handshake
- Room-level authorization enforced

## Migration Notes

### Database Migration
- Automatic schema creation via Docker init scripts
- Existing game data preserved
- New user management tables added

### Breaking Changes
- Socket.io connections now require authentication
- Persistent ID system removed
- Frontend must use new auth flow

## Development Setup

1. Copy `.env.example` to `.env` and configure
2. Run `docker-compose up` to start all services
3. Access Zitadel console at `http://localhost:8080`
4. Configure OIDC client and service account
5. Update environment variables with actual values

## Production Considerations

1. **Security**
   - Change default masterkey in Zitadel
   - Use HTTPS in production
   - Configure proper CORS origins

2. **Performance**
   - JWKS caching reduces token verification overhead
   - Database indexes for user queries
   - Connection pooling for PostgreSQL

3. **Monitoring**
   - Log authentication events
   - Monitor failed login attempts
   - Track guest account usage

## Troubleshooting

### Common Issues

1. **Socket connection failed**
   - Check authentication token validity
   - Verify Zitadel is accessible
   - Check CORS configuration

2. **Guest user creation failed**
   - Verify backend service is running
   - Check database connection
   - Review error logs

3. **OIDC callback errors**
   - Verify redirect URI configuration
   - Check client ID and secret
   - Review Zitadel logs

### Debug Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f zitadel

# Access database
docker-compose exec postgres psql -U postgres -d bunker
```

## Future Enhancements

1. **Social Providers**: Add Google, GitHub, etc.
2. **User Profiles**: Enhanced profile management
3. **Game Statistics**: Detailed analytics dashboard
4. **Moderation**: User reporting and moderation tools
5. **Multi-tenant**: Support for multiple game instances
