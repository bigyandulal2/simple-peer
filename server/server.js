// // server/index.js
// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const { Server } = require("socket.io");

// const app = express();
// app.use(cors());
// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: "*", // In dev: allow all
//     methods: ["GET", "POST"],
//   },
// });

// io.on("connection", (socket) => {
//   console.log("New client connected:", socket.id);
//   socket.on("peerId", (data) => {
//     socket.broadcast.emit("peerId", data);
//   });
// });

// server.listen(4000, () => {
//   console.log("Server listening on http://localhost:4000");
// });

// server/index.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // In dev: allow all
    methods: ["GET", "POST"],
  },
});

// A Map to store socket.id to peerId mappings
const socketToPeerIdMap = new Map();
// A Set to store all active Peer IDs
const activePeerIds = new Set();

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("peerId", (peerId) => {
    console.log(`Socket ${socket.id} registered with Peer ID: ${peerId}`);
    socketToPeerIdMap.set(socket.id, peerId); // Store the mapping
    activePeerIds.add(peerId); // Add to the set of active peer IDs

    // 1. Send the newly connected peer's ID to all *other* clients
    // This allows existing clients to discover the new one.
    socket.broadcast.emit("peerIdAvailable", peerId);

    // 2. Send all *currently active* peer IDs to the *newly connected* client
    // This allows the new client to discover all existing clients.
    // Filter out the client's own peerId
    const otherActiveIds = Array.from(activePeerIds).filter(
      (id) => id !== peerId
    );
    if (otherActiveIds.length > 0) {
      socket.emit("activePeerIds", otherActiveIds);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    const disconnectedPeerId = socketToPeerIdMap.get(socket.id);

    if (disconnectedPeerId) {
      activePeerIds.delete(disconnectedPeerId); // Remove from active list
      socketToPeerIdMap.delete(socket.id); // Remove mapping

      // Notify all remaining clients that this peer ID is no longer available
      io.emit("peerIdUnavailable", disconnectedPeerId);
      console.log(`Peer ID ${disconnectedPeerId} disconnected.`);
    }
  });

  // Optional: A client can request the list of active peers at any time
  socket.on("requestActivePeers", () => {
    const currentPeerId = socketToPeerIdMap.get(socket.id);
    const others = Array.from(activePeerIds).filter(
      (id) => id !== currentPeerId
    );
    socket.emit("activePeerIds", others);
  });
});

server.listen(4000, () => {
  console.log("Server listening on http://localhost:4000");
});
