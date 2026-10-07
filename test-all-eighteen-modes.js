/**
 * Automated Test Suite — All 18 Mode Combinations
 * 3 Question Modes (Math, GK, Grammar) × 3 Difficulties (Easy, Medium, Hard) × 2 Game Types (Single Player, Multiplayer)
 */

import { io } from "socket.io-client";
import { GK_QUESTIONS } from "./src/data/gkQuestions.js";
import { GRAMMAR_QUESTIONS } from "./src/data/grammarQuestions.js";

const BASE_URL = "http://localhost:3001";

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findCorrectAnswer(q) {
  if (!q) return null;
  // If GK question
  if (q.mode === "gk" || q.category?.includes("GK") || q.category?.includes("History") || q.category?.includes("Geography") || q.category?.includes("Science") || q.category?.includes("Sports") || q.category?.includes("Entertainment") || q.category?.includes("Facts") || q.category?.includes("Tech")) {
    const found = GK_QUESTIONS.find((item) => item.text === q.text || item.text === q.question);
    if (found) return found.correct;
  }
  // If Grammar question
  if (q.mode === "grammar" || q.category?.includes("Grammar") || q.category?.includes("Tenses") || q.category?.includes("Articles") || q.category?.includes("Prepositions") || q.category?.includes("Voice") || q.category?.includes("Speech") || q.category?.includes("Conditionals") || q.category?.includes("Modals")) {
    const found = GRAMMAR_QUESTIONS.find((item) => item.text === q.text || item.text === q.question);
    if (found) return found.correct;
  }
  // If Math question, solve arithmetic
  const mathText = q.text || q.question || "";
  // Check basic ops
  const plusMatch = mathText.match(/^(\d+)\s*\+\s*(\d+)\s*=\s*\?/);
  if (plusMatch) return parseInt(plusMatch[1], 10) + parseInt(plusMatch[2], 10);

  const minusMatch = mathText.match(/^(\d+)\s*-\s*(\d+)\s*=\s*\?/);
  if (minusMatch) return parseInt(minusMatch[1], 10) - parseInt(minusMatch[2], 10);

  const multMatch = mathText.match(/^(\d+)\s*×\s*(\d+)\s*=\s*\?/);
  if (multMatch) return parseInt(multMatch[1], 10) * parseInt(multMatch[2], 10);

  const divMatch = mathText.match(/^(\d+)\s*÷\s*(\d+)\s*=\s*\?/);
  if (divMatch) return parseInt(divMatch[1], 10) / parseInt(divMatch[2], 10);

  // 3-term
  const threeAddMinus = mathText.match(/^(\d+)\s*\+\s*(\d+)\s*-\s*(\d+)\s*=\s*\?/);
  if (threeAddMinus) return parseInt(threeAddMinus[1], 10) + parseInt(threeAddMinus[2], 10) - parseInt(threeAddMinus[3], 10);

  const threeMinusAdd = mathText.match(/^(\d+)\s*-\s*(\d+)\s*\+\s*(\d+)\s*=\s*\?/);
  if (threeMinusAdd) return parseInt(threeMinusAdd[1], 10) - parseInt(threeMinusAdd[2], 10) + parseInt(threeMinusAdd[3], 10);

  const mulAdd = mathText.match(/^(\d+)\s*×\s*(\d+)\s*\+\s*(\d+)\s*=\s*\?/);
  if (mulAdd) return parseInt(mulAdd[1], 10) * parseInt(mulAdd[2], 10) + parseInt(mulAdd[3], 10);

  const mulMinus = mathText.match(/^(\d+)\s*×\s*(\d+)\s*-\s*(\d+)\s*=\s*\?/);
  if (mulMinus) return parseInt(mulMinus[1], 10) * parseInt(mulMinus[2], 10) - parseInt(mulMinus[3], 10);

  // Percent
  const pctMatch = mathText.match(/^(\d+)%\s*of\s*(\d+)\s*=\s*\?/);
  if (pctMatch) return (parseInt(pctMatch[1], 10) * parseInt(pctMatch[2], 10)) / 100;

  // Squares
  const sqMatch = mathText.match(/^(\d+)²\s*-\s*(\d+)²\s*=\s*\?/);
  if (sqMatch) return parseInt(sqMatch[1], 10) ** 2 - parseInt(sqMatch[2], 10) ** 2;

  // Bracket: (a × b) ÷ c
  const bracketMatch = mathText.match(/^\((\d+)\s*×\s*(\d+)\)\s*÷\s*(\d+)\s*=\s*\?/);
  if (bracketMatch) return (parseInt(bracketMatch[1], 10) * parseInt(bracketMatch[2], 10)) / parseInt(bracketMatch[3], 10);

  // Div + c: a ÷ b + c
  const divAddMatch = mathText.match(/^(\d+)\s*÷\s*(\d+)\s*\+\s*(\d+)\s*=\s*\?/);
  if (divAddMatch) return parseInt(divAddMatch[1], 10) / parseInt(divAddMatch[2], 10) + parseInt(divAddMatch[3], 10);

  const divSubMatch = mathText.match(/^(\d+)\s*÷\s*(\d+)\s*-\s*(\d+)\s*=\s*\?/);
  if (divSubMatch) return parseInt(divSubMatch[1], 10) / parseInt(divSubMatch[2], 10) - parseInt(divSubMatch[3], 10);

  return q.options[0];
}

async function registerTestUser(name, email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return res.json();
}

async function testSinglePlayerCombination(token, mode, difficulty) {
  console.log(`\n--- Testing [${mode.toUpperCase()} + ${difficulty.toUpperCase()} + SINGLE PLAYER] ---`);

  // 1. Start single player
  const startRes = await fetch(`${BASE_URL}/api/singleplayer/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mode, difficulty }),
  });

  const startData = await startRes.json();
  if (!startData.success) {
    throw new Error(`Failed to start singleplayer for ${mode}-${difficulty}: ${startData.error}`);
  }

  const { sessionId, question } = startData;
  if (!question || question.options.length !== 4) {
    throw new Error(`Question options != 4 for ${mode}-${difficulty}`);
  }

  if (question.difficulty.toLowerCase() !== difficulty.toLowerCase()) {
    throw new Error(`Question difficulty mismatch! Expected ${difficulty}, got ${question.difficulty}`);
  }

  let currentQuestion = question;
  let score = 0;
  let round = 1;

  while (round <= 6) {
    const solvedAns = findCorrectAnswer(currentQuestion);
    const ansRes = await fetch(`${BASE_URL}/api/singleplayer/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId,
        round,
        answer: solvedAns,
      }),
    });

    const ansData = await ansRes.json();
    if (!ansData.success) {
      throw new Error(`Answer failed for round ${round}: ${ansData.error}`);
    }

    if (round < 6) {
      if (!ansData.nextQuestion) throw new Error(`Missing nextQuestion for round ${round + 1}`);
      if (ansData.nextQuestion.difficulty.toLowerCase() !== difficulty.toLowerCase()) {
        throw new Error(`Next round difficulty mismatch: ${ansData.nextQuestion.difficulty} vs ${difficulty}`);
      }
      currentQuestion = ansData.nextQuestion;
      round = ansData.nextRound;
    } else {
      if (!ansData.isGameOver) throw new Error("Expected isGameOver on round 6");
      score = ansData.score;
      break;
    }
  }

  console.log(`✓ Completed 6 Rounds of [${mode.toUpperCase()} + ${difficulty.toUpperCase()} + Single Player]. Final Score: ${score}/6`);
}

function testMultiplayerCombination(hostToken, playerTwoToken, mode, difficulty) {
  return new Promise((resolve, reject) => {
    console.log(`\n--- Testing [${mode.toUpperCase()} + ${difficulty.toUpperCase()} + MULTIPLAYER] ---`);

    const hostSocket = io(BASE_URL, {
      transports: ["websocket"],
      auth: { token: hostToken },
    });

    const playerTwoSocket = io(BASE_URL, {
      transports: ["websocket"],
      auth: { token: playerTwoToken },
    });

    let roomCode = "";

    const cleanup = () => {
      hostSocket.disconnect();
      playerTwoSocket.disconnect();
    };

    hostSocket.on("connect", () => {
      // 1. Host creates room with mode and difficulty
      hostSocket.emit("room:create", { playerName: "HostPlayer", mode, difficulty, token: hostToken }, (res) => {
        if (!res.success) {
          cleanup();
          return reject(new Error(`Failed to create room: ${res.error}`));
        }

        roomCode = res.roomCode;
        if (res.room.difficulty !== difficulty) {
          cleanup();
          return reject(new Error(`Room difficulty mismatch! Expected ${difficulty}, got ${res.room.difficulty}`));
        }

        // 2. Player 2 joins room
        playerTwoSocket.emit("room:join", { roomCode, playerName: "PlayerTwo", token: playerTwoToken }, (joinRes) => {
          if (!joinRes.success) {
            cleanup();
            return reject(new Error(`Player 2 join failed: ${joinRes.error}`));
          }

          if (joinRes.room.difficulty !== difficulty) {
            cleanup();
            return reject(new Error(`Player 2 room difficulty mismatch: ${joinRes.room.difficulty}`));
          }

          // 3. Player 2 ready
          playerTwoSocket.emit("player:ready", { roomCode, isReady: true });
          setTimeout(() => {
            // 4. Host starts game
            hostSocket.emit("game:start", { roomCode }, (startRes) => {
              if (startRes && !startRes.success) {
                cleanup();
                return reject(new Error(`Game start failed: ${startRes.error}`));
              }
            });
          }, 300);
        });
      });
    });

    let currentRound = 0;

    hostSocket.on("game:question", (data) => {
      currentRound = data.round;
      const q = data.question;

      if (!q || q.options.length !== 4) {
        cleanup();
        return reject(new Error(`Multiplayer question options != 4 on round ${currentRound}`));
      }

      if (q.difficulty.toLowerCase() !== difficulty.toLowerCase()) {
        cleanup();
        return reject(new Error(`Multiplayer question difficulty mismatch on round ${currentRound}: got ${q.difficulty}, expected ${difficulty}`));
      }

      const solvedAns = findCorrectAnswer(q);

      // Host answers with correct answer immediately to advance rapidly
      setTimeout(() => {
        hostSocket.emit("answer:submit", {
          roomCode,
          round: currentRound,
          answer: solvedAns,
        });
      }, 50);
    });

    hostSocket.on("game:over", (data) => {
      if (data.difficulty.toLowerCase() !== difficulty.toLowerCase()) {
        cleanup();
        return reject(new Error(`GameOver difficulty mismatch: ${data.difficulty} vs ${difficulty}`));
      }

      console.log(`✓ Completed 6 Rounds of [${mode.toUpperCase()} + ${difficulty.toUpperCase()} + Multiplayer]! Winner: ${data.winner.winnerName}`);
      cleanup();
      resolve();
    });

    setTimeout(() => {
      cleanup();
      reject(new Error(`Multiplayer test timeout for ${mode}-${difficulty}`));
    }, 30000);
  });
}

async function run() {
  console.log("==================================================");
  console.log("   QUIZ CLASH — ALL 18 COMBINATIONS TEST SUITE    ");
  console.log("==================================================");

  const testEmailHost = `host_${Date.now()}@test.com`;
  const hostAuth = await registerTestUser("HostTester", testEmailHost, "pass123456");
  if (!hostAuth.success) throw new Error("Host registration failed");

  const testEmailP2 = `p2_${Date.now()}@test.com`;
  const p2Auth = await registerTestUser("P2Tester", testEmailP2, "pass123456");
  if (!p2Auth.success) throw new Error("P2 registration failed");

  const modes = ["math", "gk", "grammar"];
  const difficulties = ["easy", "medium", "hard"];

  // 1. Test 9 Single Player Combinations
  console.log("\n=== 1. TESTING 9 SINGLE PLAYER COMBINATIONS ===");
  for (const mode of modes) {
    for (const diff of difficulties) {
      await testSinglePlayerCombination(hostAuth.token, mode, diff);
    }
  }

  // 2. Test 9 Multiplayer Combinations
  console.log("\n=== 2. TESTING 9 MULTIPLAYER COMBINATIONS ===");
  for (const mode of modes) {
    for (const diff of difficulties) {
      await testMultiplayerCombination(hostAuth.token, p2Auth.token, mode, diff);
      await wait(300);
    }
  }

  console.log("\n==================================================");
  console.log("   🎉 ALL 18 COMBINATIONS VERIFIED SUCCESSFULLY!  ");
  console.log("==================================================");
  process.exit(0);
}

run().catch((err) => {
  console.error("\n❌ Test Suite Failed:", err);
  process.exit(1);
});
