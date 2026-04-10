# Bunker Style Guide

A comprehensive guide for maintaining code quality, consistency, and the technical aesthetic across the Bunker codebase.

## Table of Contents

- [Code Style](#code-style)
- [UI/UX Standards](#uiux-standards)
- [File Organization](#file-organization)
- [Naming Conventions](#naming-conventions)
- [TypeScript Guidelines](#typescript-guidelines)
- [Component Patterns](#component-patterns)
- [State Management](#state-management)
- [Socket Events](#socket-events)

---

## Code Style

### General Principles

- **Explicit over implicit**: Prefer clear, verbose code over clever shortcuts
- **DRY (Don't Repeat Yourself)**: Extract shared logic into composables/utilities
- **Single Responsibility**: Each function/component should do one thing well
- **Fail Fast**: Validate inputs early, throw meaningful errors

### Formatting

- **Indentation**: 2 spaces (no tabs)
- **Max Line Length**: 100 characters
- **Semicolons**: Required
- **Quotes**: Single quotes for strings
- **Trailing Commas**: Always in multi-line objects/arrays

```typescript
// Good
const player = {
  id: 'abc123',
  name: 'Player One',
  isHost: true,
};

// Bad
const player = { id: "abc123", name: "Player One", isHost: true }
```

### Comments

- Use JSDoc for public functions and complex logic
- Avoid obvious comments (`// increment i`)
- Explain the "why", not the "what"

```typescript
/**
 * Calculates bunker capacity based on player count.
 * Capacity is set to 60% of players to ensure tension.
 * @param playerCount - Number of active players
 * @returns Maximum survivors allowed
 */
function calculateCapacity(playerCount: number): number {
  return Math.floor(playerCount * 0.6);
}
```

---

## UI/UX Standards

### Design System

Bunker uses a **technical/utilitarian** aesthetic inspired by terminal interfaces and industrial control panels.

#### Colors

| Name | Value | Usage |
|------|-------|-------|
| `base` | `#f5f5f5` | Background, cards |
| `contrast` | `#000000` | Text, borders, primary actions |
| `accent` | `#ff6600` | Highlights, warnings, active states |
| `gray-300` | `#d1d5db` | Hidden/locked content background |

#### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Headers | Arial, sans-serif | Bold (700) | `text-xl` to `text-2xl` |
| Body Text | Courier New, monospace | Normal (400) | `text-base` |
| Data/Numbers | Courier New, monospace | Bold (700) | `text-sm` to `text-base` |
| Buttons | Arial, sans-serif | Bold (700) | `text-sm` (uppercase) |

#### Spacing

- **Base unit**: 4px (Tailwind default)
- **Component padding**: `p-4` (16px)
- **Grid gaps**: `gap-4` (16px) or `gap-2` (8px) for tight layouts
- **Section margins**: `mb-4` to `mb-6`

### CSS/Tailwind Rules

#### Borders

- **Always** 2px solid black: `border-2 border-contrast`
- **No rounded corners** anywhere: `rounded-none` (default)

#### Components

Use the predefined component classes in `assets/css/main.css`:

```vue
<!-- Good -->
<button class="tech-button">Reveal Card</button>
<div class="tech-tile">
  <div class="tech-tile-header">Bunker Status</div>
  <!-- content -->
</div>

<!-- Bad -->
<button class="border-2 border-black bg-gray-100 px-4 py-2 font-bold">
  Reveal Card
</button>
```

#### Transitions

- **No animations**: `transition-duration: 0ms` globally
- **Instant state changes**: Hover effects are immediate
- **No opacity transitions**: Use color changes only

#### Cursor

- **Always** crosshair: Applied globally in CSS

```css
body {
  cursor: crosshair;
}
```

### Component Patterns

#### Vue Components

```vue
<template>
  <!-- Template first -->
</template>

<script setup lang="ts">
// Imports alphabetically
import { computed, ref } from 'vue';
import type { Player } from '~/types';

// Props with defaults
interface Props {
  player: Player;
  isHost?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isHost: false,
});

// Emits
const emit = defineEmits<{
  (e: 'vote', playerId: string): void;
}>();

// Composables
const gameStore = useGameStore();

// Reactive state
const isRevealed = ref(false);

// Computed
const canVote = computed(() => {
  return gameStore.room?.status === 'VOTING' && !props.player.isExiled;
});

// Methods
function handleVote() {
  if (!canVote.value) return;
  emit('vote', props.player.id);
}
</script>
```

#### Template Structure

```vue
<template>
  <div class="tech-tile">
    <!-- Header section -->
    <div class="tech-tile-header">
      {{ player.name }}
    </div>
    
    <!-- Content section -->
    <div class="tech-grid">
      <!-- Cards grid -->
    </div>
    
    <!-- Actions section -->
    <div class="mt-4 flex gap-2">
      <button class="tech-button" @click="handleAction">
        Action
      </button>
    </div>
  </div>
</template>
```

---

## File Organization

### Backend (`/backend/src/`)

```
src/
├── server.ts           # Entry point - minimal, only wiring
├── socket/
│   └── handlers.ts     # All Socket.io event handlers
└── game/
    ├── types.ts        # TypeScript interfaces (pure types)
    ├── constants.ts    # Game constants (as const)
    ├── gameLogic.ts    # Core game logic class
    └── data/           # JSON game data
```

### Frontend (`/frontend/`)

```
components/          # Vue components (flat structure)
  ├── *.vue         # Component files (PascalCase)
composables/         # Vue composables
  └── useSocket.ts  # Socket.io integration
pages/              # Nuxt file-based routing
  ├── index.vue     # Landing page
  └── room/
      └── [id].vue  # Room page
stores/             # Pinia stores
  └── game.ts       # Game state management
assets/css/         # Global styles
  └── main.css      # Tailwind + custom components
locales/            # i18n translations
  ├── en.json
  └── ru.json
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PlayerCard.vue`, `GameLobby.vue` |
| Composables | camelCase with `use` prefix | `useSocket`, `useGameStore` |
| Stores | camelCase with `Store` suffix | `gameStore`, `userStore` |
| Types/Interfaces | PascalCase | `Player`, `GameRoom`, `TraitType` |
| Constants | UPPER_SNAKE_CASE | `MIN_PLAYERS`, `GAME_CONSTANTS` |
| Functions | camelCase | `calculateCapacity`, `handleVote` |
| Variables | camelCase | `currentPlayer`, `isRevealed` |
| CSS Classes | kebab-case | `tech-button`, `tech-tile-header` |
| File names | Match default export | `gameLogic.ts` exports `GameLogic` |

---

## TypeScript Guidelines

### Types vs Interfaces

- **Interfaces** for object shapes that will be implemented/extended:
  ```typescript
  interface Player {
    id: string;
    name: string;
  }
  ```

- **Type aliases** for unions, complex types:
  ```typescript
  type GameStatus = 'LOBBY' | 'PLAYING' | 'VOTING' | 'FINISHED';
  type TraitType = 'profession' | 'biology' | 'hobby' | 'phobia' | 'baggage' | 'fact';
  ```

### Strict Typing

- **No `any`**: Use `unknown` when type is truly unknown
- **Explicit return types** on public functions
- **Type guards** for runtime validation

```typescript
// Good
function isPlayer(obj: unknown): obj is Player {
  return obj !== null && 
         typeof obj === 'object' && 
         'id' in obj && 
         'name' in obj;
}

// Bad
function processData(data: any): any {
  return data.value;
}
```

### Enums

Use `as const` objects instead of TypeScript enums:

```typescript
// Preferred
export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 12,
} as const;

// Avoid
enum GameStatus {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
}
```

---

## State Management

### Pinia Stores

```typescript
// stores/game.ts
export const useGameStore = defineStore('game', {
  state: () => ({
    room: null as GameRoom | null,
    playerId: null as string | null,
    // ... other state
  }),

  getters: {
    // Computed state
    isMyTurn: (state) => {
      // ... logic
    },
    
    // No side effects in getters
    activePlayers: (state) => {
      return Object.values(state.room?.players || {})
        .filter(p => !p.isExiled);
    },
  },

  actions: {
    // State mutations
    setRoom(room: GameRoom) {
      this.room = room;
      // Persistence logic
      if (room) {
        localStorage.setItem('gameRoom', JSON.stringify(room));
      }
    },
    
    // Async operations in actions
    async reconnect() {
      // ... async logic
    },
  },
});
```

### State Persistence Rules

| Data | Persistence | Key |
|------|-------------|-----|
| Room state | localStorage | `gameRoom` |
| Player ID | localStorage | `playerId` |
| Player name | localStorage | `playerName` |
| Connection status | In-memory only | - |

---

## Socket Events

### Naming Convention

- **Client → Server**: `UPPER_SNAKE_CASE` (e.g., `JOIN_ROOM`, `REVEAL_CARD`)
- **Server → Client**: `UPPER_SNAKE_CASE` (e.g., `ROOM_STATE_UPDATE`, `PLAYER_EXILED`)

### Payload Structure

```typescript
// Always use objects, never positional arguments
socket.emit('JOIN_ROOM', { 
  roomId: 'ABC123',
  playerName: 'John'
});

// Never do this
socket.emit('JOIN_ROOM', 'ABC123', 'John', 'uuid-here');
```

### Error Handling

```typescript
// Server side
socket.on('JOIN_ROOM', (data) => {
  const room = gameLogic.joinRoom(data.roomId, socket.id, data.playerName);
  
  if (!room) {
    socket.emit('JOIN_ERROR', { message: 'Room not found or full' });
    return;
  }
  
  // Success handling
});

// Client side (in composable)
socket.on('JOIN_ERROR', (data) => {
  gameStore.setError(data.message);
});
```

---

## Testing Standards

### Unit Tests

```typescript
describe('GameLogic', () => {
  describe('createRoom', () => {
    it('should create a room with 6-character ID', () => {
      const logic = new GameLogic();
      const room = logic.createRoom('socket-1', 'Host');
      
      expect(room.roomId).toHaveLength(6);
      expect(room.status).toBe('LOBBY');
    });
  });
});
```

### Test File Location

- Co-locate tests with source files: `gameLogic.ts` + `gameLogic.test.ts`
- Or use `__tests__/` directory adjacent to source

---

## Documentation

### README Updates

Update README.md when:
- Adding new environment variables
- Changing game rules
- Adding new socket events
- Modifying project structure

### Code Documentation

```typescript
/**
 * Represents a player in the game.
 * @property id - Player socket ID
 * @property socketId - Current Socket.io connection ID
 * @property traits - All 6 hidden trait cards
 */
export interface Player {
  id: string;
  socketId: string;
  // ...
}
```

---

## Git Conventions

### Commit Messages

```
type(scope): subject

body (optional)
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
- `feat(game): add host transfer on disconnect`
- `fix(socket): prevent duplicate join requests`
- `docs(readme): update environment variables`

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation

---

## Security Guidelines

- **Never** commit `.env` files with real secrets
- Validate all user inputs on both client and server
- Sanitize player names (max length, allowed characters)
- Rate limit room creation and joins
- Use authentication tokens for player identification

---

## Performance Guidelines

- Debounce rapid user actions (clicks, votes)
- Use `computed` for derived state in Vue
- Avoid deep watchers when possible
- Lazy load components for routes
- Minimize socket payload sizes

---

*Last updated: April 2026*
