# Architecture Documentation

This document contains technical details about the application's architecture, data models, and communication protocols.

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

### Design System

- **Layout**: Grid-based with strict modular design
- **Borders**: 2px solid black, no rounded corners
- **Typography**: Monospace for data, bold sans-serif for headers
- **Colors**: Base (#f5f5f5), Contrast (#000000), Accent (#ff6600)
- **Cursor**: Crosshair throughout
- **Transitions**: Instant (0ms duration)
- **Aesthetic**: Technical, utilitarian interface

### Component Guidelines

- All interactive elements use crosshair cursor
- No rounded corners on any elements
- 2px black borders for all containers
- Instant state transitions for snappy feel
- Monospace fonts for data display
