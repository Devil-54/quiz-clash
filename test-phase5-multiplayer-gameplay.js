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

async function runPhase5Tests() {
  console.log("=== Testing Math Battle Phase 5 Synchronized Real-Time Gameplay ===\n");

  const socket1 = io(SERVER_URL, { transports: ["websocket"] });
  const socket2 = io(SERVER_URL, { transports: ["websocket"] });
  const socket3 = io(SERVER_URL, { transports: ["websocket"] });
  const socket4 = io(SERVER_URL, { transports: ["websocket"] });

  await delay(500);

  assert(socket1.connected, "Player 1 (Rahul) connected");
  assert(socket2.connected, "Player 2 (Amit) connected");
  assert(socket3.connected, "Player 3 (Jay) connected");
  assert(socket4.connected, "Player 4 (Rohit) connected");

  let roomCode = null;

  // 1. Create Room and Join 3 additional players
  console.log("\n1. Setting up 4-Player Room...");
  await new Promise((resolve) => {
    socket1.emit("room:create", { playerName: "Rahul" }, (res) => {
      roomCode = res.roomCode;
      resolve();
    });
  });

  await new Promise((resolve) => socket2.emit("room:join", { roomCode, playerName: "Amit" }, () => resolve()));
  await new Promise((resolve) => socket3.emit("room:join", { roomCode, playerName: "Jay" }, () => resolve()));
  await new Promise((resolve) => socket4.emit("room:join", { roomCode, playerName: "Rohit" }, () => resolve()));

  // 2. Ready all players and start match
  console.log("\n2. Readying all players and starting game...");
  socket2.emit("player:ready", { roomCode, isReady: true });
  socket3.emit("player:ready", { roomCode, isReady: true });
  socket4.emit("player:ready", { roomCode, isReady: true });

  await delay(300);

  // Set up listeners for questions, ticks, answer results, and round results
  let currentQ = null;
  let qPromiseResolver = null;
  let roundResultPromiseResolver = null;
  let gameOverPromiseResolver = null;
  let gameOverData = null;

  socket1.on("game:question", (data) => {
    currentQ = data.question;
    assert(data.question.correctAnswer === undefined, "Security check: correctAnswer is NOT exposed to clients");
    assert(data.question.options.length === 4, "Question contains 4 answer options");
    if (qPromiseResolver) {
      qPromiseResolver(data);
      qPromiseResolver = null;
    }
  });

  let latestRoundResult = null;
  socket1.on("round:result", (data) => {
    latestRoundResult = data;
    if (roundResultPromiseResolver) {
      roundResultPromiseResolver(data);
      roundResultPromiseResolver = null;
    }
  });

  socket1.on("game:over", (data) => {
    gameOverData = data;
    if (gameOverPromiseResolver) {
      gameOverPromiseResolver(data);
      gameOverPromiseResolver = null;
    }
  });

  // Start game
  const q1Promise = new Promise((resolve) => { qPromiseResolver = resolve; });
  socket1.emit("game:start", { roomCode });
  const q1Data = await q1Promise;

  assert(q1Data.round === 1, `Round 1 started (Question: ${q1Data.question.text})`);

  // 3. Round 1: Player 1 (Rahul) answers correctly first
  console.log("\n3. Testing Round 1: Fastest Correct Answer Scoring...");
  // Evaluate correct answer from question text (a op b)
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

  const correctAns1 = solveText(currentQ.text);
  const r1ResultPromise = new Promise((resolve) => { roundResultPromiseResolver = resolve; });

  // Player 1 submits correct answer
  socket1.emit("answer:submit", { roomCode, round: 1, answer: correctAns1 });

  // Player 2 immediately tries submitting as well
  socket2.emit("answer:submit", { roomCode, round: 1, answer: correctAns1 });

  const r1Result = await r1ResultPromise;
  assert(r1Result.status === "won", "Round 1 was won");
  assert(r1Result.winnerName === "Rahul", "Rahul was fastest correct");
  const p1Score = r1Result.scores.find((p) => p.name === "Rahul")?.score;
  const p2Score = r1Result.scores.find((p) => p.name === "Amit")?.score;
  assert(p1Score === 1, `Rahul got +1 point (score = ${p1Score})`);
  assert(p2Score === 0, `Amit got 0 points (score = ${p2Score})`);
  assert(r1Result.correctAnswer === correctAns1, `Correct answer revealed after round end: ${correctAns1}`);

  // 4. Round 2: Player 2 submits wrong answer, Player 3 submits correct answer
  console.log("\n4. Testing Round 2: Wrong Answer and Follow-up Winner...");
  const q2Promise = new Promise((resolve) => { qPromiseResolver = resolve; });
  const q2Data = await q2Promise;
  assert(q2Data.round === 2, `Round 2 started (Question: ${q2Data.question.text})`);

  const correctAns2 = solveText(currentQ.text);
  const wrongAns2 = currentQ.options.find((opt) => opt !== correctAns2);

  // Player 2 submits WRONG answer
  let p2AnswerAck = null;
  await new Promise((resolve) => {
    socket2.emit("answer:submit", { roomCode, round: 2, answer: wrongAns2 }, (ack) => {
      p2AnswerAck = ack;
      resolve();
    });
  });

  assert(p2AnswerAck.isCorrect === false, "Player 2's wrong answer was recorded as incorrect");

  // Player 3 then submits CORRECT answer
  const r2ResultPromise = new Promise((resolve) => { roundResultPromiseResolver = resolve; });
  socket3.emit("answer:submit", { roomCode, round: 2, answer: correctAns2 });
  const r2Result = await r2ResultPromise;

  assert(r2Result.status === "won", "Round 2 was won after wrong attempt");
  assert(r2Result.winnerName === "Jay", "Jay won Round 2 point");
  const p3ScoreR2 = r2Result.scores.find((p) => p.name === "Jay")?.score;
  assert(p3ScoreR2 === 1, `Jay now has score = ${p3ScoreR2}`);

  // 5. Play through Rounds 3, 4, 5, 6
  console.log("\n5. Playing through Rounds 3 to 6...");
  for (let r = 3; r <= 6; r++) {
    const qPromise = new Promise((resolve) => { qPromiseResolver = resolve; });
    const qData = await qPromise;
    assert(qData.round === r, `Round ${r} started`);

    const ans = solveText(currentQ.text);
    const roundPromise = new Promise((resolve) => { roundResultPromiseResolver = resolve; });

    // Alternating winners to test scoring & ties
    if (r === 3) socket1.emit("answer:submit", { roomCode, round: r, answer: ans }); // Rahul +1 (Rahul=2)
    if (r === 4) socket2.emit("answer:submit", { roomCode, round: r, answer: ans }); // Amit +1 (Amit=1)
    if (r === 5) socket3.emit("answer:submit", { roomCode, round: r, answer: ans }); // Jay +1 (Jay=2)
    if (r === 6) socket1.emit("answer:submit", { roomCode, round: r, answer: ans }); // Rahul +1 (Rahul=3)

    await roundPromise;
  }

  // 6. Game Over & Final Leaderboard
  console.log("\n6. Verifying Game Over & Leaderboard Rankings...");
  if (!gameOverData) {
    const goPromise = new Promise((resolve) => { gameOverPromiseResolver = resolve; });
    await goPromise;
  }

  assert(gameOverData !== null, "Game Over event received");
  assert(gameOverData.totalRounds === 6, "Total rounds is 6");
  assert(gameOverData.leaderboard.length === 4, "Leaderboard contains all 4 players");
  assert(gameOverData.leaderboard[0].name === "Rahul" && gameOverData.leaderboard[0].score === 3, "Rahul ranked #1 with 3 points");
  assert(gameOverData.winner.isTie === false, "Single winner detected");
  assert(gameOverData.winner.winnerName === "Rahul", "Winner name is 'Rahul'");

  // 7. Test Play Again Reset
  console.log("\n7. Testing Play Again (Lobby Reset)...");
  let gameResetData = null;
  const resetPromise = new Promise((resolve) => {
    socket1.on("game:reset", (room) => {
      gameResetData = room;
      resolve();
    });
  });

  socket1.emit("game:playAgain", { roomCode });
  await resetPromise;

  assert(gameResetData !== null, "game:reset broadcast received");
  assert(gameResetData.gameStatus === "lobby", "Room status reset to 'lobby'");
  assert(gameResetData.roomCode === roomCode, "Room code preserved");
  assert(gameResetData.players.every((p) => p.score === 0), "All player scores reset to 0");

  socket1.disconnect();
  socket2.disconnect();
  socket3.disconnect();
  socket4.disconnect();

  console.log("\n==========================================");
  console.log(`Phase 5 E2E Tests: ${passed} passed, ${failed} failed`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Tests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
