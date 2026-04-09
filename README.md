# Bunker - Social Deduction Web Game

> ⚠️ **Warning**: This project was vibe coded. Proceed with caution.

A multiplayer social deduction game where players debate their usefulness to survive in a bunker during a catastrophe. Players are dealt hidden trait cards and must strategically reveal them to prove their worth for bunker survival. Through discussion and voting, players decide who to exile until the remaining group matches the bunker capacity.

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Nuxt 3 + Vue 3 + TailwindCSS + Pinia |
| **Backend** | Node.js + Express + Socket.io + TypeScript |
| **Database** | PostgreSQL |
| **Authentication** | Casdoor (SSO/OIDC) |
| **Deployment** | Docker + Docker Compose |
| **State Management** | Pinia (Frontend) + PostgreSQL (Backend) |
| **Real-time Communication** | Socket.io (WebSocket) |

## Project Structure

```
openbunker/
├── backend/               # Node.js + Socket.io server
│   ├── src/
│   │   ├── server.ts           # Express server & Socket.io setup
│   │   ├── socket/
│   │   │   └── handlers.ts     # Socket event handlers
│   │   ├── auth/               # Authentication middleware & routes
│   │   ├── game/               # Game logic
│   │   │   ├── gameLogic.ts    # Core game logic
│   │   │   ├── types.ts        # TypeScript interfaces
│   │   │   ├── constants.ts    # Game constants
│   │   │   └── data/           # JSON data (catastrophes, traits, bunker)
│   │   └── utils/              # Utility functions (logger, delta, contentFilter)
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/              # Nuxt 3 application
│   ├── components/        # Vue components
│   ├── composables/       # Vue composables (useSocket, useAuth, useHotkeys, useToast)
│   ├── pages/             # Nuxt pages (login, profile, game rooms)
│   ├── stores/            # Pinia stores (game state)
│   ├── services/          # API services
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── plugins/           # Nuxt plugins
│   ├── assets/css/        # Global styles
│   ├── i18n/locales/      # i18n translations
│   ├── app.vue
│   ├── nuxt.config.ts
│   ├── tailwind.config.js
│   ├── package.json
│   └── Dockerfile
├── database/              # Database migrations and initialization
│   ├── migrations/        # SQL migration files
│   └── init-db.sh         # Database initialization script
├── casdoor/               # Casdoor SSO configuration
│   └── conf/              # Casdoor app and service account configs
├── docker-compose.yml
├── SETUP.md               # Detailed setup guide
└── README.md
```

## Development

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### Quick Start (Docker)

For detailed setup instructions, see [SETUP.md](SETUP.md).

```bash
# Copy environment file
cp .env.dev .env

# Start all services (frontend, backend, database, Casdoor)
docker-compose up -d
```

Access:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Casdoor**: http://localhost:8000

### Development Mode (Individual Services)

```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

## Game Rules

1. **Lobby Phase**: Players join with a 6-character room code. Host can start game with minimum 2 players.

2. **Playing Phase**: Players take turns revealing cards:
   - Profession must be revealed first
   - Each turn, reveal at least 1 card (profession counts as the first)
   - Hidden traits remain secret until revealed

3. **Voting Phase**: After all players take a turn, voting begins:
   - Each active player votes for someone to exile
   - Player with most votes is exiled
   - All votes are public

4. **Repeat**: Rounds continue, revealing new bunker rooms each round, until bunker capacity is reached.

5. **Finale**: All remaining cards are revealed. Winners are the survivors who made it into the bunker.

## Authentication

The application uses **Casdoor** for Single Sign-On (SSO) authentication:

- **OAuth 2.0 / OIDC** flow for secure authentication
- **User profiles** with persistent identification across sessions
- **Login/logout** functionality with session management
- **Guest mode** support for quick game access
- See [SETUP.md](SETUP.md) for Casdoor configuration details

## Key Features

### Multiplayer Architecture
- **Real-time WebSocket Communication**: Live game state synchronization via Socket.io
- **4-12 Player Support**: Configurable player limits with minimum 4 to start
- **Room-Based Sessions**: 6-character alphanumeric room codes for easy joining

### Game Phases
- **Lobby Phase**: Pre-game waiting room with player management
  - Host can kick players or regenerate room codes
  - Adjustable game settings
- **Playing Phase**: Turn-based card revelation
  - Progressive card reveals per turn (configurable count)
  - Bunker rooms revealed each round
- **Voting Phase**: Democratic exile system
  - Public voting with visible vote counts
  - Automatic transition back to playing phase after exile
- **Finale**: Winner announcement with full card reveals

### Player System
- **Reconnection Support**: 5-second grace period allows reconnect without losing seat
- **Host Transfer**: Automatic reassignment on disconnect (30s TTL) or immediate on leave
- **6 Hidden Trait Cards** per player:
  - **Profession**: 20+ cards (Doctors, Engineers, Influencers, Mall Santas, etc.)
  - **Biology**: Age, gender, health conditions
  - **Hobby**: Skills and interests
  - **Phobia**: Fears affecting survival
  - **Baggage**: Items brought to bunker
  - **Fact**: Additional character details
- **Card Reveal Rules**: Profession must be revealed first; minimum cards per turn enforced

### Host Controls
- Start game (when minimum players reached)
- Kick unwanted players
- Regenerate room codes (lobby only)
- Configure bunker capacity (auto or manual)

### Game Content
- **20 Catastrophe Scenarios**: Nuclear war, pandemic, AI uprising, zombie outbreak, etc.
- **100+ Profession Cards**: Mix of useful (Doctor, Engineer) and useless (NFT Trader, Influencer)
- **10 Bunker Rooms**: Medical bay, armory, hydroponics, server room, etc.
- **Localized Content**: Full English and Russian translations

### UI/UX
- **Technical Aesthetic**: Grid-based utilitarian interface
- **Strict Visual Design**: 2px black borders, no rounded corners, monospace typography
- **Instant Transitions**: 0ms animation duration for snappy feel
- **Crosshair Cursor**: Consistent throughout interface
- **Responsive Layout**: Works on desktop and mobile
- **State Persistence**: LocalStorage saves player name and game state

### Security & Fairness
- **Authentication**: Casdoor SSO with OAuth 2.0/OIDC
- **Masked Game State**: Each player only sees their own hidden cards
- **Host Validation**: Server-side verification of host actions
- **Anti-Cheating**: All game logic runs server-side
- **Data Persistence**: PostgreSQL database for user data and game history

## Socket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `CREATE_ROOM` | `{ playerName, persistentId?, language? }` | Create new room |
| `JOIN_ROOM` | `{ roomId, playerName, persistentId? }` | Join existing room |
| `START_GAME` | `{ roomId }` | Host starts game |
| `REVEAL_CARD` | `{ roomId, traitType }` | Reveal a trait card |
| `END_TURN` | `{ roomId }` | End current turn |
| `SUBMIT_VOTE` | `{ roomId, targetId }` | Vote to exile player |
| `LEAVE_ROOM` | `{ roomId }` | Voluntarily leave room |
| `KICK_PLAYER` | `{ roomId, targetId }` | Host kicks player |
| `REGENERATE_ROOM_CODE` | `{ roomId }` | Generate new room code |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `ROOM_CREATED` | `{ roomId, persistentId }` | Room created successfully |
| `ROOM_STATE_UPDATE` | `GameRoom` | Full game state (masked per player) |
| `JOIN_ERROR` | `{ message }` | Failed to join room |
| `ERROR` | `{ message }` | General error |
| `PLAYER_EXILED` | `{ playerId }` | Player was exiled |
| `PLAYER_LEFT` | `{ playerId, playerName }` | Player left room |
| `KICKED` | `{ roomId, reason }` | You were kicked |
| `ROOM_CODE_REGENERATED` | `{ oldRoomId, newRoomId }` | Room code changed |

## Data Models

### Player Traits
Each player has 6 hidden trait cards:
- **Profession** - Must reveal first
- **Biology** - Age, gender, health condition
- **Hobby** - Skills and interests
- **Phobia** - Fears that may affect survival
- **Baggage** - Items brought to the bunker
- **Fact** - Additional character detail

### Bunker Stats
- **Capacity** - Survivors that can fit (60% of player count)
- **Food/Water/Medicine** - Resources per person
- **Rooms** - Special bunker rooms revealed each round

## UI Specification

- **Layout**: Grid-based with strict modular design
- **Borders**: 2px solid black, no rounded corners
- **Typography**: Monospace for data, bold sans-serif for headers
- **Colors**: Base (#f5f5f5), Contrast (#000000), Accent (#ff6600)
- **Cursor**: Crosshair throughout
- **Transitions**: Instant (0ms duration)
- **Aesthetic**: Technical, utilitarian interface

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

## TODO

- [ ] Create special action cards for players

## License

MIT
