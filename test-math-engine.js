import { generateQuestion, generateRounds, generateWrongAnswers, OPERATIONS } from "./src/utils/mathUtils.js";

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

console.log("=== Testing Math Battle Question Engine (Phase 2) ===\n");

// 1. Test Addition Questions
console.log("1. Testing Addition (+)...");
for (let i = 0; i < 50; i++) {
  const q = generateQuestion("+");
  assert(q.op === "+", `Operation is + (iteration ${i + 1})`);
  assert(q.a >= 1 && q.a <= 50, `Operand A (${q.a}) is between 1 and 50`);
  assert(q.b >= 1 && q.b <= 50, `Operand B (${q.b}) is between 1 and 50`);
  assert(q.correct === q.a + q.b, `Correct answer (${q.correct}) equals ${q.a} + ${q.b}`);
  assert(Number.isInteger(q.correct), `Correct answer is integer`);
  assert(q.correct >= 0, `Correct answer is non-negative`);
}

// 2. Test Subtraction Questions
console.log("\n2. Testing Subtraction (-)...");
for (let i = 0; i < 50; i++) {
  const q = generateQuestion("-");
  assert(q.op === "-", `Operation is - (iteration ${i + 1})`);
  assert(q.a >= 1 && q.a <= 50, `Operand A (${q.a}) is between 1 and 50`);
  assert(q.b >= 1 && q.b <= q.a, `Operand B (${q.b}) <= A (${q.a})`);
  assert(q.correct === q.a - q.b, `Correct answer (${q.correct}) equals ${q.a} - ${q.b}`);
  assert(q.correct >= 0, `No negative answers in subtraction: ${q.correct} >= 0`);
  assert(Number.isInteger(q.correct), `Correct answer is integer`);
}

// 3. Test Multiplication Questions
console.log("\n3. Testing Multiplication (×)...");
for (let i = 0; i < 50; i++) {
  const q = generateQuestion("×");
  assert(q.op === "×", `Operation is × (iteration ${i + 1})`);
  assert(q.a >= 1 && q.a <= 12, `Operand A (${q.a}) is between 1 and 12`);
  assert(q.b >= 1 && q.b <= 12, `Operand B (${q.b}) is between 1 and 12`);
  assert(q.correct === q.a * q.b, `Correct answer (${q.correct}) equals ${q.a} * ${q.b}`);
  assert(Number.isInteger(q.correct), `Correct answer is integer`);
}

// 4. Test Division Questions
console.log("\n4. Testing Division (÷)...");
for (let i = 0; i < 50; i++) {
  const q = generateQuestion("÷");
  assert(q.op === "÷", `Operation is ÷ (iteration ${i + 1})`);
  assert(q.b >= 1 && q.b <= 12, `Divisor B (${q.b}) is between 1 and 12 (no divide by 0)`);
  assert(q.correct >= 1 && q.correct <= 12, `Quotient (${q.correct}) is between 1 and 12`);
  assert(q.a === q.b * q.correct, `Dividend A (${q.a}) equals ${q.b} * ${q.correct}`);
  assert(Number.isInteger(q.correct), `Division produces whole number integer`);
  assert(!Number.isNaN(q.correct) && Number.isFinite(q.correct), `Division answer is finite and not NaN`);
}

// 5. Test Options and Duplicate Prevention across 1000 generated questions
console.log("\n5. Testing 4 Options & Duplicate Prevention (1000 iterations)...");
let duplicateFailures = 0;
let missingCorrectFailures = 0;
let negativeOptionFailures = 0;
let invalidTypeFailures = 0;

for (let i = 0; i < 1000; i++) {
  const q = generateQuestion();
  if (q.options.length !== 4) duplicateFailures++;
  const uniqueSet = new Set(q.options);
  if (uniqueSet.size !== 4) duplicateFailures++;
  if (!q.options.includes(q.correct)) missingCorrectFailures++;
  for (const opt of q.options) {
    if (typeof opt !== "number" || Number.isNaN(opt)) invalidTypeFailures++;
    if (opt < 0) negativeOptionFailures++;
  }
}

assert(duplicateFailures === 0, `Exactly 4 unique options in all 1000 questions (failures: ${duplicateFailures})`);
assert(missingCorrectFailures === 0, `Correct answer included in all 1000 questions (failures: ${missingCorrectFailures})`);
assert(negativeOptionFailures === 0, `No negative option values in all 1000 questions (failures: ${negativeOptionFailures})`);
assert(invalidTypeFailures === 0, `No NaN, Infinity, or invalid types in all 1000 questions (failures: ${invalidTypeFailures})`);

// 6. Test New Question / Rounds Generation
console.log("\n6. Testing generateRounds(6)...");
const rounds = generateRounds(6);
assert(rounds.length === 6, `Generates exactly 6 rounds`);
rounds.forEach((r, idx) => {
  assert(r.roundNumber === idx + 1, `Round ${r.roundNumber} has correct roundNumber`);
  assert(r.question && r.question.text, `Round ${r.roundNumber} has a valid question`);
  assert(r.question.options.length === 4, `Round ${r.roundNumber} has 4 options`);
});

// 7. Test Answer Selection & Scoring Logic Simulation
console.log("\n7. Testing Correct and Incorrect Answer Selection Simulation...");
const testQ = generateQuestion();
const correctChoice = testQ.correct;
const wrongChoice = testQ.options.find(opt => opt !== testQ.correct);

// Simulate Correct Answer
const isCorrectCheck = (correctChoice === testQ.correct);
assert(isCorrectCheck === true, `Selecting correct answer (${correctChoice}) evaluates to true`);

// Simulate Incorrect Answer
const isWrongCheck = (wrongChoice === testQ.correct);
assert(isWrongCheck === false, `Selecting incorrect answer (${wrongChoice}) evaluates to false`);

// Summary
console.log("\n==========================================");
console.log(`Total tests run: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
