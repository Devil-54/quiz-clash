import { io } from "socket.io-client";
import { GK_QUESTIONS } from "./src/data/gkQuestions.js";

const BASE_URL = "http://localhost:3001";
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function getCorrectAnswer(question) {
  if (question.mode === "gk") {
    const matched = GK_QUESTIONS.find((item) => item.text === question.text);
    if (matched) return matched.correct;
  }
  // Math mode: "a op b = ?"
  const clean = question.text.replace("= ?", "").replace("=", "").trim();
  const parts = clean.split(" ");
  if (parts.length === 3) {
    const a = parseInt(parts[0], 10);
    const op = parts[1];
    const b = parseInt(parts[2], 10);
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "×" || op === "*") return a * b;
    if (op === "÷" || op === "/") return Math.floor(a / b);
  }
  return question.options[0];
}

async function runQuizCrorepatiTests() {
  console.log("\n============================================================");
  console.log("🏆 QUIZ CROREPATI — COINS & REWARDS SYSTEM TEST SUITE");
  console.log("============================================================\n");

  const timestamp = Date.now();
  const player1Data = {
    name: "Deepak",
    email: `deepak_${timestamp}@crorepati.test`,
    password: "password123",
  };
  const player2Data = {
    name: "Rahul",
    email: `rahul_${timestamp}@crorepati.test`,
    password: "password123",
  };

  // 1. Register new user starts with 0 coins
  console.log("--- 1. Testing Registration Starting Coins ---");
  const reg1Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(player1Data),
  });
  const reg1 = await reg1Res.json();
  assert(reg1.success === true, "User Deepak registered successfully");
  assert(reg1.user.coins === 0, "New user starts with exactly 0 coins");
  assert(reg1.user.gamesPlayed === 0, "New user starts with 0 gamesPlayed");
  assert(reg1.user.gamesWon === 0, "New user starts with 0 gamesWon");

  const reg2Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(player2Data),
  });
  const reg2 = await reg2Res.json();
  assert(reg2.user.coins === 0, "New user Rahul starts with 0 coins");

  const token1 = reg1.token;
  const token2 = reg2.token;

  // 2. Test Math Mode Match with Coin Accumulation
  console.log("\n--- 2. Testing Math Mode Coins (+10/round, +20 winner) ---");
  await runLiveMatchTest({
    mode: "math",
    tokenHost: token1,
    tokenGuest: token2,
    hostRoundsToWin: [1, 2, 3, 4], // Host wins 4 rounds (40 coins) + match winner (20 coins) = 60 coins
    guestRoundsToWin: [5, 6],       // Guest wins 2 rounds (20 coins) = 20 coins
  });

  // Verify server-side coin balances after Match 1
  const me1Res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const me1 = await me1Res.json();
  assert(me1.user.coins === 60, `Deepak has 60 coins after 4 round wins + match winner (got: ${me1.user.coins})`);
  assert(me1.user.gamesPlayed === 1, `Deepak gamesPlayed is 1 (got: ${me1.user.gamesPlayed})`);
  assert(me1.user.gamesWon === 1, `Deepak gamesWon is 1 (got: ${me1.user.gamesWon})`);

  const me2Res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const me2 = await me2Res.json();
  assert(me2.user.coins === 20, `Rahul has 20 coins after 2 round wins (got: ${me2.user.coins})`);
  assert(me2.user.gamesPlayed === 1, `Rahul gamesPlayed is 1 (got: ${me2.user.gamesPlayed})`);
  assert(me2.user.gamesWon === 0, `Rahul gamesWon is 0 (got: ${me2.user.gamesWon})`);

  // 3. Test Rematch in GK Mode (Score resets, coins accumulate on top)
  console.log("\n--- 3. Testing Rematch Continuity in GK Mode (Coins Cumulative) ---");
  await runLiveMatchTest({
    mode: "gk",
    tokenHost: token1,
    tokenGuest: token2,
    hostRoundsToWin: [1, 2],       // Host wins 2 rounds (20 coins)
    guestRoundsToWin: [3, 4, 5, 6], // Guest wins 4 rounds (40 coins) + match winner (20 coins) = 60 coins
  });

  const me1AfterRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const me1After = await me1AfterRes.json();
  // 60 previous + 20 round wins = 80 coins
  assert(me1After.user.coins === 80, `Deepak cumulative coins: 80 (60 prev + 20 new) (got: ${me1After.user.coins})`);
  assert(me1After.user.gamesPlayed === 2, "Deepak gamesPlayed incremented to 2");
  assert(me1After.user.gamesWon === 1, "Deepak gamesWon remains 1");

  const me2AfterRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const me2After = await me2AfterRes.json();
  // 20 previous + 40 round wins + 20 winner bonus = 80 coins
  assert(me2After.user.coins === 80, `Rahul cumulative coins: 80 (20 prev + 60 new) (got: ${me2After.user.coins})`);
  assert(me2After.user.gamesPlayed === 2, "Rahul gamesPlayed incremented to 2");
  assert(me2After.user.gamesWon === 1, "Rahul gamesWon incremented to 1");

  // 4. Test Logout & Login Persistence
  console.log("\n--- 4. Testing Login Persistence of Coins ---");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: player1Data.email, password: player1Data.password }),
  });
  const login = await loginRes.json();
  assert(login.user.coins === 80, `Deepak coin balance is 80 upon fresh login (got: ${login.user.coins})`);
  assert(login.user.gamesPlayed === 2, `Deepak gamesPlayed is 2 upon fresh login`);

  console.log("\n============================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

function runLiveMatchTest({ mode, tokenHost, tokenGuest, hostRoundsToWin, guestRoundsToWin }) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Match test timed out"));
    }, 25000);

    const s1 = io(BASE_URL, { transports: ["websocket"], auth: { token: tokenHost } });
    const s2 = io(BASE_URL, { transports: ["websocket"], auth: { token: tokenGuest } });

    let roomCode = null;

    s1.on("connect", () => {
      s1.emit("room:create", { mode, token: tokenHost }, (res) => {
        assert(res.success === true, `Created ${mode} room: ${res.roomCode}`);
        roomCode = res.roomCode;

        s2.emit("room:join", { roomCode, token: tokenGuest }, (res2) => {
          assert(res2.success === true, "Guest joined room");

          s2.emit("player:ready", { roomCode, isReady: true });
          setTimeout(() => {
            s1.emit("game:start", { roomCode }, (startRes) => {
              assert(startRes.success === true, "Match started");
            });
          }, 200);
        });
      });
    });

    s1.on("game:question", (data) => {
      const q = data.question;
      const round = q.round;
      const correctAns = getCorrectAnswer(q);
      const wrongAns = q.options.find((opt) => String(opt) !== String(correctAns)) || q.options[1];

      if (hostRoundsToWin.includes(round)) {
        // Host submits the winning answer first
        s1.emit("answer:submit", { roomCode, round, answer: correctAns });
        setTimeout(() => {
          s2.emit("answer:submit", { roomCode, round, answer: wrongAns });
        }, 80);
      } else if (guestRoundsToWin.includes(round)) {
        // Guest submits the winning answer first
        s2.emit("answer:submit", { roomCode, round, answer: correctAns });
        setTimeout(() => {
          s1.emit("answer:submit", { roomCode, round, answer: wrongAns });
        }, 80);
      }
    });

    s1.on("round:result", (data) => {
      if (data.status === "won") {
        assert(data.coinsAwarded === 10, "Round win broadcast awards +10 coins");
      }
    });

    s1.on("game:over", (data) => {
      assert(data.rewards && data.rewards.length === 2, "Rewards breakdown received for both players");
      assert(Boolean(data.winner), `Match winner declared: ${data.winner.winnerName}`);

      clearTimeout(timeout);
      s1.disconnect();
      s2.disconnect();
      resolve();
    });
  });
}

runQuizCrorepatiTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
