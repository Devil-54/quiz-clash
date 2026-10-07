import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMultiplayerTests() {
  console.log("=== Testing Math Battle Real-Time Multiplayer Server (Phase 4) ===\n");

  // Create 4 test sockets
  const socket1 = io(SERVER_URL, { transports: ["websocket"] });
  const socket2 = io(SERVER_URL, { transports: ["websocket"] });
  const socket3 = io(SERVER_URL, { transports: ["websocket"] });
  const socket4 = io(SERVER_URL, { transports: ["websocket"] });
  const socket5 = io(SERVER_URL, { transports: ["websocket"] });

  await delay(500);

  assert(socket1.connected, `Socket 1 (Host) connected`);
  assert(socket2.connected, `Socket 2 connected`);
  assert(socket3.connected, `Socket 3 connected`);
  assert(socket4.connected, `Socket 4 connected`);
  assert(socket5.connected, `Socket 5 connected`);

  let roomCode = null;

  // 1. Player 1 creates room
  console.log("\n1. Testing Room Creation...");
  await new Promise((resolve) => {
    socket1.emit("room:create", { playerName: "Rahul" }, (res) => {
      assert(res.success === true, "Room creation succeeded");
      assert(typeof res.roomCode === "string" && res.roomCode.length === 6, `Valid 6-char room code generated: ${res.roomCode}`);
      assert(res.player.name === "Rahul", "Host name matches 'Rahul'");
      assert(res.player.playerNumber === 1, "Host is Player 1");
      assert(res.player.isReady === true, "Host starts ready");
      roomCode = res.roomCode;
      resolve();
    });
  });

  // 2. Player 2 joins room
  console.log("\n2. Testing Player 2 Join...");
  await new Promise((resolve) => {
    socket2.emit("room:join", { roomCode, playerName: "Amit" }, (res) => {
      assert(res.success === true, "Player 2 joined room");
      assert(res.player.name === "Amit", "Player 2 name is 'Amit'");
      assert(res.player.playerNumber === 2, "Assigned Player Number 2");
      assert(res.room.players.length === 2, "Room now has 2 players");
      resolve();
    });
  });

  // 3. Player 3 joins room
  console.log("\n3. Testing Player 3 Join...");
  await new Promise((resolve) => {
    socket3.emit("room:join", { roomCode, playerName: "Jay" }, (res) => {
      assert(res.success === true, "Player 3 joined room");
      assert(res.player.name === "Jay", "Player 3 name is 'Jay'");
      assert(res.player.playerNumber === 3, "Assigned Player Number 3");
      assert(res.room.players.length === 3, "Room now has 3 players");
      resolve();
    });
  });

  // 4. Player 4 joins room (Room becomes full with 4 players)
  console.log("\n4. Testing Player 4 Join (Maximum 4 players)...");
  await new Promise((resolve) => {
    socket4.emit("room:join", { roomCode, playerName: "Rohit" }, (res) => {
      assert(res.success === true, "Player 4 joined room");
      assert(res.player.name === "Rohit", "Player 4 name is 'Rohit'");
      assert(res.player.playerNumber === 4, "Assigned Player Number 4");
      assert(res.room.players.length === 4, "Room has exactly 4 players");
      resolve();
    });
  });

  // 5. Player 5 attempts to join full room
  console.log("\n5. Testing 5th Player Join Prevention...");
  await new Promise((resolve) => {
    socket5.emit("room:join", { roomCode, playerName: "Karan" }, (res) => {
      assert(res.success === false, "5th player join rejected");
      assert(res.error.includes("Room is full"), `Expected room full error message: "${res.error}"`);
      resolve();
    });
  });

  // 6. Non-existent room test
  console.log("\n6. Testing Invalid / Non-Existent Room Code...");
  await new Promise((resolve) => {
    socket5.emit("room:join", { roomCode: "INVALID", playerName: "Karan" }, (res) => {
      assert(res.success === false, "Invalid room join rejected");
      assert(res.error.includes("Room not found"), `Expected 'Room not found' error: "${res.error}"`);
      resolve();
    });
  });

  // 7. Test Ready System
  console.log("\n7. Testing Ready System...");
  socket2.emit("player:ready", { roomCode, isReady: true });
  socket3.emit("player:ready", { roomCode, isReady: true });
  socket4.emit("player:ready", { roomCode, isReady: true });
  await delay(300);

  // 8. Non-host start game prevention
  console.log("\n8. Testing Non-Host Start Game Prevention...");
  await new Promise((resolve) => {
    socket2.emit("game:start", { roomCode }, (res) => {
      assert(res.success === false, "Non-host start game rejected");
      assert(res.error.includes("Only the room host"), `Expected host authorization error: "${res.error}"`);
      resolve();
    });
  });

  // 9. Host starts game
  console.log("\n9. Testing Host Start Game & Synchronized Question Broadcast...");
  let startBroadcastCount = 0;
  let receivedQuestions = [];

  const checkStarted = (socketName, data) => {
    startBroadcastCount++;
    assert(data.roomCode === roomCode, `${socketName} received matching roomCode in game:started`);
    assert(data.rounds.length === 6, `${socketName} received exactly 6 rounds`);
    assert(data.totalRounds === 6, `${socketName} received totalRounds = 6`);
    receivedQuestions.push(data.rounds.map(r => r.question.text));
  };

  socket1.on("game:started", (data) => checkStarted("Socket 1 (Host)", data));
  socket2.on("game:started", (data) => checkStarted("Socket 2", data));
  socket3.on("game:started", (data) => checkStarted("Socket 3", data));
  socket4.on("game:started", (data) => checkStarted("Socket 4", data));

  await new Promise((resolve) => {
    socket1.emit("game:start", { roomCode }, (res) => {
      assert(res.success === true, "Host start game succeeded");
      resolve();
    });
  });

  await delay(500);

  assert(startBroadcastCount === 4, `All 4 connected sockets received game:started broadcast (got ${startBroadcastCount})`);

  // Verify all 4 players received identical synchronized questions
  const q1Str = JSON.stringify(receivedQuestions[0]);
  const q2Str = JSON.stringify(receivedQuestions[1]);
  const q3Str = JSON.stringify(receivedQuestions[2]);
  const q4Str = JSON.stringify(receivedQuestions[3]);

  assert(q1Str === q2Str && q2Str === q3Str && q3Str === q4Str, "All 4 clients received 100% identical synchronized math questions");

  // 10. Disconnect / Player Leave Test & Host Reassignment
  console.log("\n10. Testing Player Disconnection & Host Reassignment...");
  socket1.disconnect(); // Host disconnects
  await delay(500);

  // Remaining sockets should receive room update with new host
  await new Promise((resolve) => {
    socket2.emit("room:leave", { roomCode });
    resolve();
  });

  socket2.disconnect();
  socket3.disconnect();
  socket4.disconnect();
  socket5.disconnect();

  console.log("\n==========================================");
  console.log(`Multiplayer E2E Tests: ${passed} passed, ${failed} failed`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runMultiplayerTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
