// Test script to verify timestamp fix
const { GameLogic } = require('./dist/game/gameLogic');

const gameLogic = new GameLogic();

// Create a test room
const room = gameLogic.createRoom('test-socket', 'TestPlayer');
console.log('Created room:', room.roomId);

// Add a chat message
const message = gameLogic.addChatMessage(
  room.roomId,
  'test-player-id',
  'TestPlayer',
  'Test message',
  'CHAT',
  'CHAT_MESSAGE'
);

if (message) {
  console.log('Message timestamp:', message.timestamp);
  console.log('Message date:', new Date(message.timestamp));
  console.log('Formatted time:', new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
} else {
  console.log('Failed to create message');
}
