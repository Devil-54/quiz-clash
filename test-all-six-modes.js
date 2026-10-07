import http from "http";
import { io as ioClient } from "socket.io-client";

const BASE_URL = "http://localhost:3001";

async function post(endpoint, body, token) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function get(endpoint, token) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("==================================================");
  console.log("   QUIZ CROREPATI — ALL 6 MODES VERIFICATION TEST  ");
  console.log("==================================================\n");

  // 1. Auth check: Register & Login test user
  const testEmail = `tester_${Date.now()}@example.com`;
  const reg = await post("/api/auth/register", {
    name: "GrammarTester",
    email: testEmail,
    password: "Password123!",
  });

  if (!reg.ok || !reg.data.token) {
    throw new Error(`Failed to register test user: ${JSON.stringify(reg.data)}`);
  }
  const token = reg.data.token;
  console.log(`✓ User Registered & Authenticated: ${reg.data.user.name} (Coins: ${reg.data.user.coins})`);

  // Helper for single player full match test
  async function testSinglePlayer(modeName) {
    console.log(`\n--- Testing [${modeName.toUpperCase()} + SINGLE PLAYER] ---`);
    const startRes = await post("/api/singleplayer/start", { mode: modeName }, token);
    if (!startRes.ok || !startRes.data.success) {
      throw new Error(`Failed to start singleplayer ${modeName}: ${JSON.stringify(startRes.data)}`);
    }

    const { sessionId, question } = startRes.data;
    console.log(`  Round 1 Question: "${question.text}" (Category: ${question.category}, Mode: ${question.mode})`);
    if (!question.options || question.options.length !== 4) {
      throw new Error(`Question does not have exactly 4 options: ${JSON.stringify(question.options)}`);
    }

    let currentQ = question;
    let totalScore = 0;
    let earnedCoins = 0;

    for (let r = 1; r <= 6; r++) {
      // Pick first option as answer
      const chosenOption = currentQ.options[0];
      const ansRes = await post("/api/singleplayer/answer", {
        sessionId,
        round: r,
        answer: chosenOption,
      }, token);

      if (!ansRes.ok || !ansRes.data.success) {
        throw new Error(`Failed to answer round ${r}: ${JSON.stringify(ansRes.data)}`);
      }

      const isCorrect = ansRes.data.isCorrect;
      if (isCorrect) {
        totalScore += 1;
        earnedCoins += 10;
      }
      console.log(`  Round ${r}: Submitted "${chosenOption}" -> ${isCorrect ? "CORRECT (+10🪙)" : "WRONG (0🪙)"} (Correct was: "${ansRes.data.correctAnswer}")`);

      if (r < 6) {
        if (!ansRes.data.nextQuestion) {
          throw new Error(`Expected nextQuestion for round ${r + 1}`);
        }
        currentQ = ansRes.data.nextQuestion;
      } else {
        if (!ansRes.data.isGameOver) {
          throw new Error(`Expected isGameOver true at round 6`);
        }
      }
    }

    console.log(`✓ Completed 6 Rounds of [${modeName.toUpperCase()} + Single Player]. Final Score: ${totalScore}/6, Coins Earned: ${earnedCoins}`);
  }

  // Helper for multiplayer full match test
  async function testMultiplayer(modeName) {
    console.log(`\n--- Testing [${modeName.toUpperCase()} + MULTIPLAYER] ---`);

    return new Promise((resolve, reject) => {
      const socket1 = ioClient(BASE_URL, { auth: { token } });
      const socket2 = ioClient(BASE_URL);

      let roomCode = "";
      let roundCount = 0;

      socket1.on("connect", () => {
        socket1.emit("room:create", { playerName: "HostPlayer", mode: modeName, token }, (res) => {
          if (!res.success) return reject(new Error(`Failed to create room: ${res.error}`));
          roomCode = res.roomCode;
          console.log(`  Room created: ${roomCode} (Mode: ${res.room.mode})`);

          // Socket 2 joins
          socket2.emit("room:join", { roomCode, playerName: "PlayerTwo" }, (joinRes) => {
            if (!joinRes.success) return reject(new Error(`Player 2 join failed: ${joinRes.error}`));
            console.log(`  Player 2 joined room ${roomCode}`);

            // Player 2 readies up
            socket2.emit("player:ready", { roomCode, isReady: true });
          });
        });
      });

      socket1.on("room:updated", (room) => {
        if (room.gameStatus === "lobby" && room.players.length === 2 && room.players.every((p) => p.isReady)) {
          // Host starts game
          socket1.emit("game:start", { roomCode }, (startRes) => {
            if (!startRes.success) return reject(new Error(`Failed to start multiplayer game: ${startRes.error}`));
            console.log(`  Multiplayer game started for room ${roomCode}`);
          });
        }
      });

      socket1.on("game:question", (data) => {
        roundCount += 1;
        const q = data.question;
        console.log(`  Multiplayer Round ${roundCount}/6 Question: "${q.text}" (Mode: ${q.mode}, Category: ${q.category})`);

        if (!q.options || q.options.length !== 4) {
          return reject(new Error(`Multiplayer question missing 4 options: ${JSON.stringify(q)}`));
        }

        // Host submits first option immediately
        setTimeout(() => {
          socket1.emit("answer:submit", {
            roomCode,
            round: q.round,
            answer: q.options[0],
          });
        }, 50);
      });

      socket1.on("game:over", (gameOverData) => {
        console.log(`  Game Over received! Leaderboard:`, gameOverData.leaderboard.map(p => `${p.name}: ${p.score}pts`));
        console.log(`  Winner: ${gameOverData.winner.winnerName}`);
        socket1.disconnect();
        socket2.disconnect();
        console.log(`✓ Completed 6 Rounds of [${modeName.toUpperCase()} + Multiplayer]!`);
        resolve();
      });

      setTimeout(() => {
        socket1.disconnect();
        socket2.disconnect();
        reject(new Error(`Timeout waiting for multiplayer ${modeName} match completion.`));
      }, 90000);
    });
  }

  // Execute all 6 combinations sequentially
  await testSinglePlayer("math");
  await testSinglePlayer("gk");
  await testSinglePlayer("grammar");

  await testMultiplayer("math");
  await testMultiplayer("gk");
  await testMultiplayer("grammar");

  // Final check: user profile & coin balance
  const meRes = await get("/api/auth/me", token);
  console.log(`\n✓ Final User Coins in DB: ${meRes.data.user.coins} (Matches Played: ${meRes.data.user.stats?.matchesPlayed || 0})`);
  console.log("\n==================================================");
  console.log("   🎉 ALL 6 COMBINATIONS VERIFIED SUCCESSFULLY!   ");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ Test Failed:", err);
  process.exit(1);
});
