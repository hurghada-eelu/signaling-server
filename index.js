// server.js
const { WebSocketServer } = require('ws');

// Use the port provided by the hosting environment (e.g., Render), or fallback to 8080 locally
const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Store active rooms: { roomCode: { host: ws, client: ws } }
const rooms = {};

wss.on('connection', (ws) => {
  let currentRoom = null;
  let role = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      // Handle room joining
      if (msg.type === 'join') {
        currentRoom = msg.room;
        role = msg.role;
        
        if (!rooms[currentRoom]) {
          rooms[currentRoom] = {};
        }
        rooms[currentRoom][role] = ws;

        console.log(`Peer joined room [${currentRoom}] as [${role}]`);

        // Notify host when the mobile client connects
        if (role === 'client' && rooms[currentRoom].host) {
          rooms[currentRoom].host.send(JSON.stringify({ type: 'peer-joined' }));
        }
        return;
      }

      // Relay WebRTC signaling payloads (offer, answer, ice-candidate) to the opposite peer
      const targetRole = role === 'host' ? 'client' : 'host';
      const targetSocket = rooms[currentRoom]?.[targetRole];
      
      if (targetSocket && targetSocket.readyState === ws.OPEN) {
        targetSocket.send(data.toString());
      }
    } catch (e) {
      console.error("Signaling message handling error:", e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom][role];
      console.log(`Peer left room [${currentRoom}] from role [${role}]`);
      
      // Clean up empty rooms
      if (!rooms[currentRoom].host && !rooms[currentRoom].client) {
        delete rooms[currentRoom];
      }
    }
  });
});

console.log(`Signaling server running successfully on port ${PORT}`);