/**
 * Comprehensive GK Question Bank & Generator Test Suite
 */

import { GK_QUESTIONS, generateGKQuestion } from "./src/data/gkQuestions.js";
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

async function runGKImprovementTests() {
  console.log("==================================================================");
  console.log("=== Math Battle - GK Question Bank Improvement Test Suite ===");
  console.log("==================================================================\n");

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
  // 1. Static Question Bank Quality & Integrity Validation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("1. Validating GK Question Bank Structure (All Questions)...");
  {
    assert(GK_QUESTIONS.length >= 70, `Question bank has substantial variety (Count: ${GK_QUESTIONS.length})`);

    const categoriesFound = new Set();
    const difficultiesFound = new Set();
    let invalidQuestions = 0;
    let missingCorrect = 0;
    let duplicateOptions = 0;

    GK_QUESTIONS.forEach((q, idx) => {
      if (!q.text || !Array.isArray(q.options) || q.options.length !== 4) {
        invalidQuestions++;
        console.error(`  Question index ${idx} has invalid structure:`, q);
      }

      const uniqueOptions = new Set(q.options.map((o) => String(o).trim().toLowerCase()));
      if (uniqueOptions.size !== 4) {
        duplicateOptions++;
        console.error(`  Question index ${idx} has duplicate options:`, q.options);
      }

      if (!q.options.includes(q.correct)) {
        missingCorrect++;
        console.error(`  Question index ${idx} correct answer '${q.correct}' not in options:`, q.options);
      }

      if (q.category) categoriesFound.add(q.category);
      if (q.difficulty) difficultiesFound.add(q.difficulty);
    });

    assert(invalidQuestions === 0, `All ${GK_QUESTIONS.length} questions have valid 4-option structure`);
    assert(duplicateOptions === 0, `All ${GK_QUESTIONS.length} questions have 4 unique options`);
    assert(missingCorrect === 0, `All ${GK_QUESTIONS.length} questions have correct answer present in options`);
    assert(categoriesFound.size >= 8, `Covers diverse categories (Found ${categoriesFound.size}: ${[...categoriesFound].join(", ")})`);
    assert(difficultiesFound.has("Easy") && difficultiesFound.has("Medium"), "Includes mixture of Easy and Medium/Hard difficulties");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Question Generator Match Uniqueness (100 Matches)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n2. Testing 6-Round Match Uniqueness & Shuffling (100 Iterations)...");
  {
    let duplicateWithinMatchFailures = 0;
    let optionCountFailures = 0;
    let correctPreservationFailures = 0;

    for (let match = 0; match < 100; match++) {
      const used = new Set();
      const matchQuestions = [];

      for (let r = 0; r < 6; r++) {
        const q = generateGKQuestion(used);
        matchQuestions.push(q);

        if (q.options.length !== 4) optionCountFailures++;
        if (!q.options.includes(q.correct)) correctPreservationFailures++;
      }

      const uniqueTexts = new Set(matchQuestions.map((q) => q.text));
      if (uniqueTexts.size !== 6) {
        duplicateWithinMatchFailures++;
      }
    }

    assert(duplicateWithinMatchFailures === 0, "No duplicate questions generated within 6-round matches (100 matches tested)");
    assert(optionCountFailures === 0, "All generated questions have exactly 4 options");
    assert(correctPreservationFailures === 0, "All generated questions preserve the correct answer in shuffled options");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Live Multiplayer 3-Player GK Match Synchronization & Categories
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n3. Testing 3-Player Live Multiplayer GK Match & Categories...");
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
      p1.emit("room:create", { playerName: "Host", mode: "gk" }, (r) => {
        roomCode = r.roomCode;
        res();
      });
    });

    await new Promise((res) => p2.emit("room:join", { roomCode, playerName: "Player 2" }, res));
    await new Promise((res) => p3.emit("room:join", { roomCode, playerName: "Player 3" }, res));

    p2.emit("player:ready", { roomCode, isReady: true });
    p3.emit("player:ready", { roomCode, isReady: true });
    await sleep(200);

    const matchQuestionsP1 = [];
    const matchQuestionsP2 = [];
    let gameOverData = null;

    p1.on("game:question", (d) => matchQuestionsP1.push(d.question));
    p2.on("game:question", (d) => matchQuestionsP2.push(d.question));
    p1.on("game:over", (d) => { gameOverData = d; });

    // Start GK match
    await new Promise((res) => p1.emit("game:start", { roomCode }, res));

    // Wait for match to finish all 6 rounds
    while (!gameOverData) {
      await sleep(200);
    }

    assert(matchQuestionsP1.length === 6, "Host received all 6 rounds");
    assert(matchQuestionsP2.length === 6, "Player 2 received all 6 rounds");

    let syncMismatch = false;
    let categoriesPresent = true;
    for (let r = 0; r < 6; r++) {
      if (matchQuestionsP1[r].text !== matchQuestionsP2[r].text) syncMismatch = true;
      if (!matchQuestionsP1[r].category) categoriesPresent = false;
    }

    assert(!syncMismatch, "All players received 100% synchronized GK questions across all 6 rounds");
    assert(categoriesPresent, "All questions include category metadata for UI display");
    assert(gameOverData.mode === "gk", "Final Game Over payload confirms mode: 'gk'");

    p1.disconnect();
    p2.disconnect();
    p3.disconnect();
    await sleep(200);
  }

  console.log("\n==================================================================");
  console.log(`GK Improvement Test Results: ${passedTests} passed, ${totalTests - passedTests} failed`);
  console.log("==================================================================");

  if (totalTests !== passedTests) {
    process.exit(1);
  }
}

runGKImprovementTests().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
