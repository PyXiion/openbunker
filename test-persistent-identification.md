# Persistent Player Identification with Host TTL Test

## Test Scenario

1. **Setup**: Multiple players join a room, host starts the game
2. **Action**: Host reloads the page (Cmd+R or F5)
3. **Expected Result**: 
   - Host retains ownership for 30 seconds after disconnect
   - Host automatically rejoins and retains host status
   - Other players see host reconnect without losing host
   - Room state is preserved for everyone

## Implementation Details

### Backend Changes

✅ **Player Interface** (`types.ts`):
- Added `persistentId: string` field for unique identification
- Added `hostOwnershipExpiry?: number` to GameRoom for TTL

✅ **Game Logic** (`gameLogic.ts`):
- Added `generatePersistentId()` method using UUID
- Updated `joinRoom()` to use persistent ID instead of name
- Updated `removePlayer()` to set 30-second TTL for host ownership
- Added `checkHostOwnershipTTL()` method to handle expiry
- Enhanced reconnection logic to preserve host status

✅ **Socket Handlers** (`socket/handlers.ts`):
- Updated `JOIN_ROOM` to accept persistent ID parameter
- Added TTL checking when players join
- Enhanced disconnect handling with delay

### Frontend Changes

✅ **Game Store** (`stores/game.ts`):
- Added `persistentId` to state
- Added `getOrCreatePersistentId()` method
- Enhanced localStorage persistence
- Updated reset to clear persistent ID

✅ **Socket Composable** (`composables/useSocket.ts`):
- Updated `joinRoom()` to include persistent ID
- Enhanced auto-rejoin with persistent ID

✅ **Room Page** (`pages/room/[roomId].vue`):
- Updated rejoin logic to use persistent ID

## Test Steps

1. Create a room with 2+ players
2. Start the game
3. Verify host has host status
4. Host reloads the page (within 30 seconds)
5. Verify:
   - Host automatically rejoins with same persistent ID
   - Host retains host ownership
   - Other players see host reconnect
   - Game continues normally

6. Test TTL expiration:
   - Host leaves and doesn't reconnect for 35+ seconds
   - Verify host ownership transfers to next player
   - Original host rejoins after TTL expired
   - Verify original host doesn't get host status back

## Expected Behavior

- **Host Reloads Within 30s**: Host retains ownership automatically
- **Host Reloads After 30s**: Host loses ownership, transfers to next player
- **Unique Identification**: Players consistently identified across sessions
- **No Name Conflicts**: Duplicate names don't cause identification issues
- **Grace Period**: Host has 30 seconds to reconnect before losing ownership

## Technical Details

- **Persistent ID Generation**: UUID v4 format stored in localStorage
- **TTL Duration**: 30 seconds (30000ms)
- **Identification Method**: Persistent ID > Socket ID > Name
- **Storage**: localStorage for frontend persistence, in-memory for backend
