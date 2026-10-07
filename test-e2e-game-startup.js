import { io } from "socket.io-client";

const API_BASE = "http://localhost:3001";
const SOCKET_URL = "http://localhost:3001";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let testCount = 0;
let passedCount = 0;

function assert(condition, message) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS [${testCount}]: ${message}`);
  } else {
    console.error(`  ✗ FAIL [${testCount}]: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runE2EDiagnostic() {
  console.log("\n========================================================");
  console.log("  QUIZ CROREPATI — END-TO-END GAME STARTUP DIAGNOSTIC");
  console.log("========================================================\n");

  const ts = Date.now();
  const u1Email = `tester1_${ts}@crorepati.test`;
  const u2Email = `tester2_${ts}@crorepati.test`;

  // 1. Register User 1 & User 2
  console.log("--- 1. Auth REST API Diagnostics ---");
  const reg1Res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Player One",
      email: u1Email,
      password: "password123",
    }),
  });
  const reg1Data = await reg1Res.json();
  assert(reg1Res.status === 201 && reg1Data.success && reg1Data.token, "User 1 registered successfully");

  const reg2Res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Player Two",
      email: u2Email,
      password: "password123",
    }),
  });
  const reg2Data = await reg2Res.json();
  assert(reg2Res.status === 201 && reg2Data.success && reg2Data.token, "User 2 registered successfully");

  // 2. Verify Auth Token via /api/auth/me
  const meRes = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${reg1Data.token}` },
  });
  const meData = await meRes.json();
  assert(meRes.ok && meData.success && meData.user.name === "Player One", "Auth session verification passed");

  // 3. Connect Socket 1 & Socket 2
  console.log("\n--- 2. Socket Connection & Room Creation ---");
  const socket1 = io(SOCKET_URL, {
    transports: ["websocket"],
    auth: { token: reg1Data.token },
  });
  const socket2 = io(SOCKET_URL, {
    transports: ["websocket"],
    auth: { token: reg2Data.token },
  });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    socket1.on("connect", check);
    socket2.on("connect", check);
  });
  assert(socket1.connected && socket2.connected, "Both player sockets connected");

  // 4. Create Room as Math mode
  let roomCode = null;
  await new Promise((resolve) => {
    socket1.emit(
      "room:create",
      { playerName: "Player One", mode: "math", token: reg1Data.token },
      (res) => {
        assert(res.success && res.roomCode, `Room created with code ${res.roomCode}`);
        assert(res.room.mode === "math", "Room mode is 'math'");
        assert(res.room.players.length === 1, "Room has 1 player (Host)");
        assert(res.room.players[0].isReady === true, "Host player starts in ready state");
        roomCode = res.roomCode;
        resolve();
      }
    );
  });

  // 5. Join Room with Socket 2
  console.log("\n--- 3. Player 2 Joining & Ready System ---");
  await new Promise((resolve) => {
    socket2.emit(
      "room:join",
      { roomCode, playerName: "Player Two", token: reg2Data.token },
      (res) => {
        assert(res.success, "Player 2 joined the room successfully");
        assert(res.room.players.length === 2, "Room now has 2 players");
        assert(res.player.isReady === false, "Player 2 starts as not ready");
        resolve();
      }
    );
  });

  await sleep(100);

  // 6. Player 2 toggles ready
  await new Promise((resolve) => {
    const handler = (room) => {
      const p2 = room.players?.find((p) => p.name === "Player Two");
      if (p2 && p2.isReady) {
        socket1.off("room:updated", handler);
        assert(p2.isReady === true, "Player 2 is confirmed ready in room state");
        resolve();
      }
    };
    socket1.on("room:updated", handler);
    socket2.emit("player:ready", { roomCode, isReady: true });
  });

  // 7. Host starts game
  console.log("\n--- 4. Game Start & Round Execution ---");
  let gameStartedReceived1 = false;
  let gameStartedReceived2 = false;

  socket1.on("game:started", () => {
    gameStartedReceived1 = true;
  });
  socket2.on("game:started", () => {
    gameStartedReceived2 = true;
  });

  await new Promise((resolve) => {
    socket1.emit("game:start", { roomCode }, (res) => {
      assert(res.success, "Host game:start callback returned success");
      resolve();
    });
  });

  await sleep(200);
  assert(gameStartedReceived1 && gameStartedReceived2, "Both clients received 'game:started'");

  // 8. Play through all 6 rounds
  for (let r = 1; r <= 6; r++) {
    const questionData = await new Promise((resolve) => {
      const qHandler = (data) => {
        if (data.round === r || data.question?.round === r) {
          socket1.off("game:question", qHandler);
          resolve(data);
        }
      };
      socket1.on("game:question", qHandler);
    });

    assert(questionData.question.round === r, `Round ${r} question received`);
    assert(questionData.question.options.length === 4, `Round ${r} has exactly 4 options`);
    assert(questionData.question.correctAnswer === undefined, `Round ${r} question payload omits correctAnswer`);

    // Simulate answering: User 1 answers first option in rounds 1-4, User 2 in rounds 5-6
    const chosenOption = questionData.question.options[0];
    const answeringSocket = r <= 4 ? socket1 : socket2;

    await new Promise((resolve) => {
      answeringSocket.emit(
        "answer:submit",
        { roomCode, round: r, answer: chosenOption },
        (res) => {
          assert(res.success, `Round ${r} answer submission processed`);
          resolve();
        }
      );
    });

    // Wait for round:result
    await new Promise((resolve) => {
      socket1.once("round:result", () => {
        resolve();
      });
    });

    await sleep(2100); // Wait for round transition delay
  }

  // 9. Match Completion & Game Over
  console.log("\n--- 5. Game Over & Rewards Breakdown ---");
  const gameOverData = await new Promise((resolve) => {
    socket1.once("game:over", (data) => {
      resolve(data);
    });
  });

  assert(gameOverData.leaderboard.length === 2, "Game Over leaderboard has 2 players");
  assert(gameOverData.rewards.length === 2, "Rewards breakdown generated for both players");
  assert(gameOverData.winner !== undefined, "Winner data present");
  console.log(`  ✓ Match Winner: ${gameOverData.winner.winnerName}`);

  // 10. Clean disconnect
  socket1.disconnect();
  socket2.disconnect();

  console.log(`\n========================================================`);
  console.log(`  ALL ${passedCount}/${testCount} DIAGNOSTIC TESTS PASSED!`);
  console.log(`========================================================\n`);
}

runE2EDiagnostic().catch((err) => {
  console.error("DIAGNOSTIC TEST FAILED:", err);
  process.exit(1);
});
