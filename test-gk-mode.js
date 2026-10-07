/**
 * GK Mode Test Suite
 * Tests Math and GK room creation, question generation, synchronization,
 * scoring, timer, rounds, and rematch flow.
 */

import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createClient() {
  return io(SERVER_URL, {
    transports: ["websocket"],
    forceNew: true,
  });
}

async function runGKModeTests() {
  console.log("=========================================================");
  console.log("=== Math Battle - GK Mode Comprehensive Test Suite ===");
  console.log("=========================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Math Room vs GK Room Creation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("1. Testing Mode Room Creation (Math vs GK)...");
  {
    const mathHost = createClient();
    const gkHost = createClient();

    await Promise.all([
      new Promise((res) => mathHost.on("connect", res)),
      new Promise((res) => gkHost.on("connect", res)),
    ]);

    let mathRes = null;
    await new Promise((res) => {
      mathHost.emit("room:create", { playerName: "MathHost", mode: "math" }, (r) => {
        mathRes = r;
        res();
      });
    });

    let gkRes = null;
    await new Promise((res) => {
      gkHost.emit("room:create", { playerName: "GKHost", mode: "gk" }, (r) => {
        gkRes = r;
        res();
      });
    });

    assert(mathRes?.success === true, "Math room created successfully");
    assert(mathRes?.room?.mode === "math", "Math room has mode: 'math'");

    assert(gkRes?.success === true, "GK room created successfully");
    assert(gkRes?.room?.mode === "gk", "GK room has mode: 'gk'");

    mathHost.disconnect();
    gkHost.disconnect();
    await sleep(200);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. GK Mode 3-Player Match & Synchronization
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n2. Testing 3-Player GK Match Synchronization & Question Format...");
  {
    const p1 = createClient();
    const p2 = createClient();
    const p3 = createClient();

    await Promise.all([
      new Promise((res) => p1.on("connect", res)),
      new Promise((res) => p2.on("connect", res)),
      new Promise((res) => p3.on("connect", res)),
    ]);

    let roomCode = "";
    await new Promise((res) => {
      p1.emit("room:create", { playerName: "Player 1", mode: "gk" }, (r) => {
        roomCode = r.roomCode;
        res();
      });
    });

    let p2Join = null;
    await new Promise((res) => {
      p2.emit("room:join", { roomCode, playerName: "Player 2" }, (r) => {
        p2Join = r;
        res();
      });
    });

    let p3Join = null;
    await new Promise((res) => {
      p3.emit("room:join", { roomCode, playerName: "Player 3" }, (r) => {
        p3Join = r;
        res();
      });
    });

    assert(p2Join?.room?.mode === "gk", "Player 2 sees GK mode on join");
    assert(p3Join?.room?.mode === "gk", "Player 3 sees GK mode on join");

    p2.emit("player:ready", { roomCode, isReady: true });
    p3.emit("player:ready", { roomCode, isReady: true });
    await sleep(200);

    const questionsP1 = [];
    const questionsP2 = [];
    const questionsP3 = [];

    p1.on("game:question", (d) => questionsP1.push(d));
    p2.on("game:question", (d) => questionsP2.push(d));
    p3.on("game:question", (d) => questionsP3.push(d));

    let round1Res = null;
    p1.on("round:result", (d) => {
      if (!round1Res) round1Res = d;
    });

    let gameOverRes = null;
    p1.on("game:over", (d) => {
      gameOverRes = d;
    });

    // Start GK match
    await new Promise((res) => p1.emit("game:start", { roomCode }, res));
    await sleep(400);

    // Verify Round 1 question received by all
    assert(questionsP1.length === 1, "P1 received round 1 question");
    assert(questionsP2.length === 1, "P2 received round 1 question");
    assert(questionsP3.length === 1, "P3 received round 1 question");

    const q1 = questionsP1[0].question;
    const q2 = questionsP2[0].question;
    const q3 = questionsP3[0].question;

    assert(q1.text === q2.text && q2.text === q3.text, "All players receive identical GK question text");
    assert(q1.options.length === 4, "GK question has exactly 4 options");
    assert(q1.mode === "gk", "Question payload contains mode: 'gk'");
    assert(q1.correct === undefined && q1.correctAnswer === undefined, "Secret answer is hidden on server during round");

    // Test answering in GK mode: Player 2 submits first option
    const answerSubmitted = q1.options[0];
    let answerAck = null;
    await new Promise((res) => {
      p2.emit("answer:submit", { roomCode, round: 1, answer: answerSubmitted }, (r) => {
        answerAck = r;
        res();
      });
    });

    assert(answerAck?.success === true, "GK string answer submitted successfully");
    console.log(`  -> Player 2 submitted: "${answerSubmitted}" (isCorrect: ${answerAck.isCorrect})`);

    // Wait for round 1 to complete (either by timeout or win)
    while (!round1Res) {
      await sleep(200);
    }
    assert(round1Res !== null, "Round 1 result received");
    assert(round1Res.correctAnswer !== undefined, `Correct answer revealed after round: "${round1Res.correctAnswer}"`);

    // Let rounds 2 to 6 play out to game over
    console.log("  -> Playing through remaining rounds...");
    while (!gameOverRes) {
      await sleep(200);
    }

    assert(gameOverRes !== null, "Game Over received after 6 GK rounds");
    assert(gameOverRes.mode === "gk", "Game over payload confirms mode: 'gk'");
    assert(gameOverRes.leaderboard.length === 3, "Leaderboard contains all 3 players");

    // Test Rematch in GK mode
    p1.emit("player:rematchReady", { roomCode, isReady: true });
    p2.emit("player:rematchReady", { roomCode, isReady: true });
    p3.emit("player:rematchReady", { roomCode, isReady: true });
    await sleep(200);

    let rematchQuestion = null;
    p2.on("game:question", (d) => {
      if (d.round === 1) rematchQuestion = d;
    });

    await new Promise((res) => p1.emit("game:start", { roomCode }, res));
    await sleep(400);

    assert(rematchQuestion !== null, "Rematch started at round 1");
    assert(rematchQuestion?.mode === "gk", "Rematch retained mode: 'gk'");
    assert(rematchQuestion?.question?.options?.length === 4, "Rematch generated fresh GK question");

    p1.disconnect();
    p2.disconnect();
    p3.disconnect();
    await sleep(200);
  }

  console.log("\n=========================================================");
  console.log(`GK Mode Test Results: ${passedTests} passed, ${totalTests - passedTests} failed`);
  console.log("=========================================================");

  if (totalTests !== passedTests) {
    process.exit(1);
  }
}

runGKModeTests().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
