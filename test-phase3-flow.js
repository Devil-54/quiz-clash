import { generateQuestion, generateRounds } from "./src/utils/mathUtils.js";
import { TOTAL_ROUNDS, QUESTION_TIMER } from "./src/data/mockData.js";

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

console.log("=== Testing Math Battle Phase 3 Match Flow & Logic ===\n");

// 1. Test Match Configuration
console.log("1. Checking match configuration constants...");
assert(TOTAL_ROUNDS === 6, `Match length is exactly 6 rounds (got ${TOTAL_ROUNDS})`);
assert(QUESTION_TIMER === 10, `Question countdown timer is 10 seconds (got ${QUESTION_TIMER})`);

// 2. Simulate complete 6-Round Match Gameplay
console.log("\n2. Simulating full 6-round match simulation (Correct, Wrong, Timeout combinations)...");

class GameStateSimulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.rounds = generateRounds(TOTAL_ROUNDS);
    this.currentRoundIndex = 0;
    this.score = 0;
    this.correctAnswers = 0;
    this.wrongAnswers = 0;
    this.timeouts = 0;
    this.timeRemaining = QUESTION_TIMER;
    this.selectedAnswer = null;
    this.answerStatus = "idle";
    this.roundOver = false;
    this.gameStatus = "playing";
    this.screen = "game";
  }

  submitAnswer(answer) {
    if (this.selectedAnswer !== null || this.roundOver || this.timeRemaining <= 0 || this.gameStatus !== "playing") {
      return false;
    }
    const currentQ = this.rounds[this.currentRoundIndex].question;
    const isCorrect = answer === currentQ.correct;

    this.selectedAnswer = answer;
    this.roundOver = true;
    this.gameStatus = "round_ended";

    if (isCorrect) {
      this.answerStatus = "correct";
      this.score += 1;
      this.correctAnswers += 1;
    } else {
      this.answerStatus = "wrong";
      this.wrongAnswers += 1;
    }
    return true;
  }

  triggerTimeout() {
    if (this.roundOver || this.gameStatus !== "playing") return false;
    this.timeRemaining = 0;
    this.answerStatus = "timeout";
    this.roundOver = true;
    this.gameStatus = "round_ended";
    this.timeouts += 1;
    return true;
  }

  nextRound() {
    const next = this.currentRoundIndex + 1;
    if (next >= TOTAL_ROUNDS) {
      this.gameStatus = "game_over";
      this.screen = "results";
    } else {
      this.currentRoundIndex = next;
      this.selectedAnswer = null;
      this.answerStatus = "idle";
      this.roundOver = false;
      this.timeRemaining = QUESTION_TIMER;
      this.gameStatus = "playing";
    }
  }
}

const sim = new GameStateSimulator();

// Round 1: Correct Answer
console.log("  -> Round 1: Correct answer submission");
assert(sim.currentRoundIndex === 0, "Round 1 starts at index 0");
assert(sim.timeRemaining === 10, "Timer starts at 10s");
const q1 = sim.rounds[0].question;
assert(sim.submitAnswer(q1.correct) === true, "Submit correct answer");
assert(sim.score === 1, "Score is 1");
assert(sim.correctAnswers === 1, "Correct count is 1");
assert(sim.roundOver === true, "Round is over");
assert(sim.answerStatus === "correct", "Answer status is 'correct'");
// Test rapid multiple clicks are blocked
assert(sim.submitAnswer(q1.correct) === false, "Second answer submission is blocked");

sim.nextRound();

// Round 2: Incorrect Answer
console.log("  -> Round 2: Incorrect answer submission");
assert(sim.currentRoundIndex === 1, "Advanced to Round 2 (index 1)");
assert(sim.roundOver === false, "Selection state reset");
assert(sim.timeRemaining === 10, "Timer reset to 10s");
const q2 = sim.rounds[1].question;
const wrongAns = q2.options.find(opt => opt !== q2.correct);
assert(sim.submitAnswer(wrongAns) === true, "Submit wrong answer");
assert(sim.score === 1, "Score remains 1");
assert(sim.wrongAnswers === 1, "Wrong answers count is 1");
assert(sim.answerStatus === "wrong", "Answer status is 'wrong'");

sim.nextRound();

// Round 3: Timeout
console.log("  -> Round 3: Timeout test");
assert(sim.currentRoundIndex === 2, "Advanced to Round 3 (index 2)");
assert(sim.triggerTimeout() === true, "Trigger timer expiration (0s)");
assert(sim.score === 1, "Score remains 1 (no point on timeout)");
assert(sim.timeouts === 1, "Timeouts count is 1");
assert(sim.answerStatus === "timeout", "Answer status is 'timeout'");
assert(sim.submitAnswer(sim.rounds[2].question.correct) === false, "Answer submission blocked after timeout");

sim.nextRound();

// Round 4: Correct Answer
console.log("  -> Round 4: Correct answer submission");
assert(sim.currentRoundIndex === 3, "Advanced to Round 4 (index 3)");
const q4 = sim.rounds[3].question;
sim.submitAnswer(q4.correct);
assert(sim.score === 2, "Score updated to 2");
assert(sim.correctAnswers === 2, "Correct count is 2");

sim.nextRound();

// Round 5: Correct Answer
console.log("  -> Round 5: Correct answer submission");
assert(sim.currentRoundIndex === 4, "Advanced to Round 5 (index 4)");
const q5 = sim.rounds[4].question;
sim.submitAnswer(q5.correct);
assert(sim.score === 3, "Score updated to 3");
assert(sim.correctAnswers === 3, "Correct count is 3");

sim.nextRound();

// Round 6: Final Round
console.log("  -> Round 6: Final round answer submission");
assert(sim.currentRoundIndex === 5, "Advanced to Round 6 (index 5)");
const q6 = sim.rounds[5].question;
sim.submitAnswer(q6.correct);
assert(sim.score === 4, "Final score is 4");
assert(sim.correctAnswers === 4, "Final correct count is 4");

// Transition to Results screen
sim.nextRound();
console.log("\n3. Testing Results Screen Transition...");
assert(sim.screen === "results", "Screen transitions to 'results'");
assert(sim.gameStatus === "game_over", "Game status is 'game_over'");
assert(sim.score === 4, "Score is 4 / 6");
assert(sim.correctAnswers === 4, "Total correct answers is 4");
assert(sim.wrongAnswers === 1, "Total wrong answers is 1");
assert(sim.timeouts === 1, "Total timeouts is 1");
assert(sim.correctAnswers + sim.wrongAnswers + sim.timeouts === TOTAL_ROUNDS, "Sum of all outcomes equals total rounds (6)");

// 4. Test Play Again
console.log("\n4. Testing Play Again functionality...");
sim.reset();
assert(sim.screen === "game", "Play Again returns to 'game' screen");
assert(sim.currentRoundIndex === 0, "Round reset to 1");
assert(sim.score === 0, "Score reset to 0");
assert(sim.correctAnswers === 0, "Correct answers reset to 0");
assert(sim.wrongAnswers === 0, "Wrong answers reset to 0");
assert(sim.timeouts === 0, "Timeouts reset to 0");
assert(sim.timeRemaining === 10, "Timer initialized to 10s");
assert(sim.rounds.length === 6, "New set of 6 rounds generated");

console.log("\n==========================================");
console.log(`Phase 3 test results: ${passed} passed, ${failed} failed`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
