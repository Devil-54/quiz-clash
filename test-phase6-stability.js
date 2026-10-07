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

function solveText(text) {
  const cleaned = text.replace(" = ?", "").trim();
  const parts = cleaned.split(" ");
  const a = parseInt(parts[0], 10);
  const op = parts[1];
  const b = parseInt(parts[2], 10);
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  if (op === "÷") return a / b;
  return a + b;
}

async function runPhase6StabilityTests() {
  console.log("=== Testing Math Battle Phase 6 Stability, Rematch & Edge Cases ===\n");

  // ─── Test 1: Lobby Disconnect & Slot Freeing ──────────────────────────────
  console.log("1. Testing Lobby Disconnect & Slot Freeing...");
  const s1 = io(SERVER_URL, { transports: ["websocket"] });
  const s2 = io(SERVER_URL, { transports: ["websocket"] });
  const s3 = io(SERVER_URL, { transports: ["websocket"] });

  await delay(300);

  let roomCode = null;
  await new Promise((resolve) => {
    s1.emit("room:create", { playerName: "Rahul" }, (res) => {
      roomCode = res.roomCode;
      resolve();
    });
  });

  await new Promise((resolve) => s2.emit("room:join", { roomCode, playerName: "Amit" }, () => resolve()));
  await new Promise((resolve) => s3.emit("room:join", { roomCode, playerName: "Jay" }, () => resolve()));

  // Jay disconnects in lobby
  const leavePromise = new Promise((resolve) => {
    const handler = (data) => {
      assert(data.playerName === "Jay", "player:left event received for 'Jay'");
      s1.off("player:left", handler);
      resolve();
    };
    s1.on("player:left", handler);
  });

  s3.disconnect();
  await leavePromise;
  await delay(200);

  // Re-join with a new socket to verify 3rd slot is freed and accessible
  const s3New = io(SERVER_URL, { transports: ["websocket"] });
  await delay(200);
  let joinSuccess = false;
  await new Promise((resolve) => {
    s3New.emit("room:join", { roomCode, playerName: "Jay2" }, (res) => {
      joinSuccess = res.success;
      assert(res.player.playerNumber === 3, `Slot freed and reassigned to Player Number ${res.player.playerNumber}`);
      resolve();
    });
  });
  assert(joinSuccess === true, "New player successfully joined into freed slot");

  // ─── Test 2: Minimum Player Rule (1 player cannot start) ──────────────────
  console.log("\n2. Testing Minimum Player Rule (< 2 players)...");
  s2.disconnect();
  s3New.disconnect();
  await delay(300);

  let startError = null;
  await new Promise((resolve) => {
    s1.emit("game:start", { roomCode }, (res) => {
      startError = res?.error;
      resolve();
    });
  });
  assert(startError !== null && startError.includes("1 more player"), `Prevented starting game with 1 player: "${startError}"`);

  // ─── Test 3: 4-Player Match, In-Game Disconnect & Host Migration ───────────
  console.log("\n3. Testing 4-Player Match, In-Game Disconnect & Host Reassignment...");
  const p1 = io(SERVER_URL, { transports: ["websocket"] }); // Host: Rahul
  const p2 = io(SERVER_URL, { transports: ["websocket"] }); // Amit
  const p3 = io(SERVER_URL, { transports: ["websocket"] }); // Jay
  const p4 = io(SERVER_URL, { transports: ["websocket"] }); // Rohit

  await delay(400);

  let matchRoomCode = null;
  await new Promise((resolve) => {
    p1.emit("room:create", { playerName: "Rahul" }, (res) => {
      matchRoomCode = res.roomCode;
      resolve();
    });
  });

  await new Promise((resolve) => p2.emit("room:join", { roomCode: matchRoomCode, playerName: "Amit" }, () => resolve()));
  await new Promise((resolve) => p3.emit("room:join", { roomCode: matchRoomCode, playerName: "Jay" }, () => resolve()));
  await new Promise((resolve) => p4.emit("room:join", { roomCode: matchRoomCode, playerName: "Rohit" }, () => resolve()));

  // Ready players
  p2.emit("player:ready", { roomCode: matchRoomCode, isReady: true });
  p3.emit("player:ready", { roomCode: matchRoomCode, isReady: true });
  p4.emit("player:ready", { roomCode: matchRoomCode, isReady: true });
  await delay(300);

  let currentQuestion = null;
  let qResolve = null;
  let roundResultResolve = null;

  p2.on("game:question", (data) => {
    currentQuestion = data.question;
    if (qResolve) { qResolve(data); qResolve = null; }
  });

  p2.on("round:result", (data) => {
    if (roundResultResolve) { roundResultResolve(data); roundResultResolve = null; }
  });

  // Start game
  const q1Promise = new Promise((r) => { qResolve = r; });
  p1.emit("game:start", { roomCode: matchRoomCode });
  await q1Promise;

  assert(currentQuestion.round === 1, "Round 1 started");

  // Round 1 answer
  const ans1 = solveText(currentQuestion.text);
  const r1Promise = new Promise((r) => { roundResultResolve = r; });
  p1.emit("answer:submit", { roomCode: matchRoomCode, round: 1, answer: ans1 });
  await r1Promise;

  // Round 2 start
  const q2Promise = new Promise((r) => { qResolve = r; });
  await q2Promise;
  assert(currentQuestion.round === 2, "Round 2 started");

  // Host (Rahul - p1) disconnects during active game!
  console.log("  -> Host (Rahul) disconnects during match...");
  let hostMigrationNotif = null;
  const hostMigratePromise = new Promise((resolve) => {
    const handler = (data) => {
      hostMigrationNotif = data;
      p2.off("player:left", handler);
      resolve();
    };
    p2.on("player:left", handler);
  });

  p1.disconnect();
  await hostMigratePromise;

  assert(hostMigrationNotif !== null, "player:left notification received by remaining players");
  assert(hostMigrationNotif.wasHost === true, "Notification confirmed leaving player was host");
  assert(hostMigrationNotif.newHostName === "Amit", `New host promoted to lowest available player number: ${hostMigrationNotif.newHostName}`);

  // Game continues smoothly without freeze!
  const ans2 = solveText(currentQuestion.text);
  const r2Promise = new Promise((r) => { roundResultResolve = r; });
  p2.emit("answer:submit", { roomCode: matchRoomCode, round: 2, answer: ans2 });
  const r2Result = await r2Promise;
  assert(r2Result.winnerName === "Amit", "Amit successfully won point in Round 2 after host left");

  // ─── Test 4: Complete Remaining Rounds and Verify Rematch Flow ─────────────
  console.log("\n4. Completing Match and Testing Rematch Ready Flow...");
  let gameOverResolve = null;
  let gameOverData = null;
  p2.on("game:over", (data) => {
    gameOverData = data;
    if (gameOverResolve) { gameOverResolve(data); gameOverResolve = null; }
  });

  for (let r = 3; r <= 6; r++) {
    const qPromise = new Promise((resolve) => { qResolve = resolve; });
    await qPromise;

    const ans = solveText(currentQuestion.text);
    const roundPromise = new Promise((resolve) => { roundResultResolve = resolve; });
    p2.emit("answer:submit", { roomCode: matchRoomCode, round: r, answer: ans });
    await roundPromise;
  }

  if (!gameOverData) {
    const goPromise = new Promise((r) => { gameOverResolve = r; });
    await goPromise;
  }

  assert(gameOverData !== null, "Game Over reached after Round 6");

  // ─── Test 5: Rematch Ready & Rematch Start ─────────────────────────────────
  console.log("\n5. Testing Rematch Ready Status and Host Rematch Start...");
  // p2 is new Host, p3, p4 are players
  p2.emit("player:rematchReady", { roomCode: matchRoomCode, isReady: true });
  p3.emit("player:rematchReady", { roomCode: matchRoomCode, isReady: true });
  p4.emit("player:rematchReady", { roomCode: matchRoomCode, isReady: true });
  await delay(300);

  // New Host (p2) starts rematch
  const rematchQ1Promise = new Promise((r) => { qResolve = r; });
  p2.emit("game:start", { roomCode: matchRoomCode });
  const rematchQ1 = await rematchQ1Promise;

  assert(rematchQ1.round === 1, "Rematch started successfully at Round 1 with fresh questions!");

  // Cleanup all sockets
  s1.disconnect();
  p2.disconnect();
  p3.disconnect();
  p4.disconnect();

  console.log("\n==========================================");
  console.log(`Phase 6 Stability Tests: ${passed} passed, ${failed} failed`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6StabilityTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
