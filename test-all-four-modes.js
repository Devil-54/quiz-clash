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

function getCorrectMathAnswer(question) {
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

function getCorrectGKAnswer(question) {
  const matched = GK_QUESTIONS.find((item) => item.text === question.text);
  return matched ? matched.correct : question.options[0];
}

function getCorrectAnswer(question) {
  if (question.mode === "gk") {
    return getCorrectGKAnswer(question);
  }
  return getCorrectMathAnswer(question);
}

function runLiveMultiplayerMatch({ mode, tokenHost, tokenGuest, hostRoundsToWin, guestRoundsToWin }) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Multiplayer match ${mode} timed out`));
    }, 25000);

    const s1 = io(BASE_URL, { transports: ["websocket"], auth: { token: tokenHost } });
    const s2 = io(BASE_URL, { transports: ["websocket"], auth: { token: tokenGuest } });

    let roomCode = null;

    s1.on("connect", () => {
      s1.emit("room:create", { mode, token: tokenHost }, (res) => {
        assert(res.success === true, `Created ${mode} room: ${res.roomCode}`);
        roomCode = res.roomCode;

        s2.emit("room:join", { roomCode, token: tokenGuest }, (res2) => {
          assert(res2.success === true, `Guest joined ${mode} room`);

          s2.emit("player:ready", { roomCode, isReady: true });
          setTimeout(() => {
            s1.emit("game:start", { roomCode }, (startRes) => {
              assert(startRes.success === true, `Multiplayer ${mode} match started`);
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
        s1.emit("answer:submit", { roomCode, round, answer: correctAns });
        setTimeout(() => {
          s2.emit("answer:submit", { roomCode, round, answer: wrongAns });
        }, 60);
      } else if (guestRoundsToWin.includes(round)) {
        s2.emit("answer:submit", { roomCode, round, answer: correctAns });
        setTimeout(() => {
          s1.emit("answer:submit", { roomCode, round, answer: wrongAns });
        }, 60);
      }
    });

    s1.on("round:result", (data) => {
      if (data.status === "won") {
        assert(data.coinsAwarded === 10, `Round win awards +10 coins (${mode})`);
      }
    });

    s1.on("game:over", (data) => {
      assert(data.rewards && data.rewards.length === 2, `Rewards breakdown received for both players (${mode})`);
      assert(Boolean(data.winner), `Match winner declared: ${data.winner.winnerName}`);

      clearTimeout(timeout);
      s1.disconnect();
      s2.disconnect();
      resolve(data);
    });
  });
}

async function runAllFourModesTestSuite() {
  console.log("\n============================================================");
  console.log("🏆 QUIZ CROREPATI — ALL FOUR MODES & SINGLE PLAYER TEST SUITE");
  console.log("============================================================\n");

  const ts = Date.now();
  const user1Data = {
    name: "Aryan",
    email: `aryan_${ts}@crorepati.test`,
    password: "password123",
  };
  const user2Data = {
    name: "Rohan",
    email: `rohan_${ts}@crorepati.test`,
    password: "password123",
  };

  // Register User 1
  const reg1Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user1Data),
  });
  const reg1 = await reg1Res.json();
  assert(reg1.success && reg1.token, "User Aryan registered");
  const token1 = reg1.token;

  // Register User 2
  const reg2Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user2Data),
  });
  const reg2 = await reg2Res.json();
  assert(reg2.success && reg2.token, "User Rohan registered");
  const token2 = reg2.token;

  // =========================================================================
  // TEST 1: SINGLE PLAYER + MATH
  // =========================================================================
  console.log("\n--- TEST 1: Single Player + Math Mode ---");
  const spMathStartRes = await fetch(`${BASE_URL}/api/singleplayer/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ mode: "math" }),
  });
  const spMath = await spMathStartRes.json();
  assert(spMath.success && spMath.sessionId, "Single Player Math session created");
  assert(spMath.gameMode === "single", "gameMode is 'single'");
  assert(spMath.questionMode === "math", "questionMode is 'math'");
  assert(spMath.round === 1 && spMath.totalRounds === 6, "Starts at Round 1 of 6");
  assert(spMath.question.options.length === 4, "Math question has 4 options");
  assert(spMath.question.correctAnswer === undefined, "Single Player question omits correct answer");

  let spMathSessionId = spMath.sessionId;
  let currentQ = spMath.question;
  let expectedMathCoins = 0;

  // Round 1 to 4: Correct answers (+10 coins each = +40)
  for (let r = 1; r <= 4; r++) {
    const correctAns = getCorrectMathAnswer(currentQ);
    const ansRes = await fetch(`${BASE_URL}/api/singleplayer/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ sessionId: spMathSessionId, round: r, answer: correctAns }),
    });
    const ansData = await ansRes.json();
    assert(ansData.success && ansData.isCorrect === true, `Round ${r} correct answer accepted`);
    assert(ansData.coinsAwarded === 10, `Round ${r} awarded exactly +10 coins`);
    expectedMathCoins += 10;
    assert(ansData.totalCoins === expectedMathCoins, `Total coins is ${expectedMathCoins}`);
    currentQ = ansData.nextQuestion;
  }

  // Round 5: Wrong answer (0 coins)
  const wrongAns = currentQ.options.find((opt) => opt !== getCorrectMathAnswer(currentQ)) || "99999";
  const ans5Res = await fetch(`${BASE_URL}/api/singleplayer/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ sessionId: spMathSessionId, round: 5, answer: wrongAns }),
  });
  const ans5Data = await ans5Res.json();
  assert(ans5Data.success && ans5Data.isCorrect === false, "Round 5 wrong answer processed as 0 pts / 0 coins");
  assert(ans5Data.coinsAwarded === 0, "Round 5 coinsAwarded is 0");
  currentQ = ans5Data.nextQuestion;

  // Round 6: Timeout (0 coins)
  const timeout6Res = await fetch(`${BASE_URL}/api/singleplayer/timeout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ sessionId: spMathSessionId, round: 6 }),
  });
  const timeout6Data = await timeout6Res.json();
  assert(timeout6Data.success && timeout6Data.isGameOver === true, "Round 6 timeout finishes game");
  assert(timeout6Data.score === 4, `Final Single Player Score is 4 / 6 (got: ${timeout6Data.score})`);
  assert(timeout6Data.correctAnswers === 4, "Correct answers count is 4");
  assert(timeout6Data.wrongAnswers === 1, "Wrong answers count is 1");
  assert(timeout6Data.timeouts === 1, "Timeouts count is 1");
  assert(timeout6Data.coinsEarned === 40, "Coins earned in match is 40");
  assert(timeout6Data.totalCoins === 40, "Total user account coins is 40");

  // =========================================================================
  // TEST 2: SINGLE PLAYER + GK & PLAY AGAIN
  // =========================================================================
  console.log("\n--- TEST 2: Single Player + GK Mode & Play Again ---");
  const spGkStartRes = await fetch(`${BASE_URL}/api/singleplayer/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ mode: "gk" }),
  });
  const spGk = await spGkStartRes.json();
  assert(spGk.success && spGk.sessionId, "Single Player GK session created");
  assert(spGk.questionMode === "gk", "questionMode is 'gk'");
  assert(spGk.currentCoins === 40, "Carries previous coin balance of 40");

  let spGkSessionId = spGk.sessionId;
  let currentGkQ = spGk.question;

  // Answer all 6 rounds correctly in GK single player
  for (let r = 1; r <= 6; r++) {
    const correctAns = getCorrectGKAnswer(currentGkQ);
    const ansRes = await fetch(`${BASE_URL}/api/singleplayer/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ sessionId: spGkSessionId, round: r, answer: correctAns }),
    });
    const ansData = await ansRes.json();
    assert(ansData.success && ansData.isCorrect === true, `GK Round ${r} correct answer processed`);
    if (r < 6) {
      currentGkQ = ansData.nextQuestion;
    } else {
      assert(ansData.isGameOver === true, "GK Round 6 completes the game");
      assert(ansData.score === 6, "Perfect score 6 / 6 in GK Single Player");
      assert(ansData.coinsEarned === 60, "Coins earned this game is +60");
      assert(ansData.totalCoins === 100, "Total cumulative coins is 100 (40 + 60)");
    }
  }

  // =========================================================================
  // TEST 3: MULTIPLAYER + MATH
  // =========================================================================
  console.log("\n--- TEST 3: Multiplayer + Math Mode ---");
  await runLiveMultiplayerMatch({
    mode: "math",
    tokenHost: token1,
    tokenGuest: token2,
    hostRoundsToWin: [1, 2, 3, 4], // Aryan wins 4 rounds (+40) + match winner (+20) = +60
    guestRoundsToWin: [5, 6],       // Rohan wins 2 rounds (+20)
  });

  const me1AfterMath = await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token1}` } })).json();
  // 100 prev + 60 = 160 coins
  assert(me1AfterMath.user.coins === 160, `Aryan total coins is 160 (got: ${me1AfterMath.user.coins})`);

  // =========================================================================
  // TEST 4: MULTIPLAYER + GK
  // =========================================================================
  console.log("\n--- TEST 4: Multiplayer + GK Mode ---");
  await runLiveMultiplayerMatch({
    mode: "gk",
    tokenHost: token2,
    tokenGuest: token1,
    hostRoundsToWin: [1, 2, 3, 4, 5], // Rohan wins 5 rounds (+50) + winner (+20) = +70
    guestRoundsToWin: [6],             // Aryan wins 1 round (+10)
  });

  const me1Final = await (await fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token1}` } })).json();
  // 160 + 10 = 170 coins
  assert(me1Final.user.coins === 170, `Aryan final coins is 170 (got: ${me1Final.user.coins})`);

  console.log("\n============================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllFourModesTestSuite().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
