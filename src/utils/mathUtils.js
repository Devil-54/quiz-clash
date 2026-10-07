/**
 * Quiz Clash – Authoritative Math Question Generator Engine
 *
 * Supports three difficulty tiers:
 * - Easy: Basic mental arithmetic (+, -, ×, ÷) with simple whole numbers.
 * - Medium: 2-digit multiplication, 3-digit division, and multi-operation expressions.
 * - Hard: Percentage calculations, difference of squares, bracketed expressions, and multi-step arithmetic.
 *
 * Guaranteed properties for all questions:
 * - Exactly 1 correct answer.
 * - Exactly 4 unique options.
 * - Non-negative whole numbers only (no fractions, no decimals, no division by zero).
 * - Shuffled options.
 */

export const OPERATIONS = ["+", "-", "×", "÷"];
export const DIFFICULTIES = ["easy", "medium", "hard"];

/**
 * Returns a random integer between min and max (inclusive).
 */
export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a Fisher-Yates shuffled copy of an array.
 */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generates 3 unique, realistic non-negative distractors for a correct integer answer.
 * @param {number} correct - The correct answer
 * @param {string} [difficulty="easy"] - Difficulty tier
 * @returns {number[]} Array of 3 unique distractors
 */
export function generateWrongAnswers(correct, difficulty = "easy") {
  const wrongs = new Set();
  const diff = String(difficulty || "easy").toLowerCase();

  // Pick suitable spread based on magnitude and difficulty
  const spread = diff === "hard" ? Math.max(25, Math.floor(correct * 0.25)) : diff === "medium" ? Math.max(15, Math.floor(correct * 0.2)) : 10;
  
  const baseDeltas = [
    -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -10, 10,
    -spread, spread, -Math.floor(spread / 2), Math.floor(spread / 2),
    -12, 12, -15, 15, -20, 20
  ];
  const shuffledDeltas = shuffle(baseDeltas);

  for (const delta of shuffledDeltas) {
    if (wrongs.size >= 3) break;
    const candidate = correct + delta;
    if (candidate >= 0 && candidate !== correct && !wrongs.has(candidate)) {
      wrongs.add(candidate);
    }
  }

  // Fallback generation if needed
  let attempts = 0;
  while (wrongs.size < 3 && attempts < 100) {
    attempts++;
    const delta = getRandomInt(1, Math.max(20, spread * 2));
    const candidate = Math.random() > 0.5 ? correct + delta : correct - delta;
    if (candidate >= 0 && candidate !== correct && !wrongs.has(candidate)) {
      wrongs.add(candidate);
    }
  }

  // Guaranteed fallback with sequential offsets
  let offset = 1;
  while (wrongs.size < 3) {
    if (correct + offset >= 0 && !wrongs.has(correct + offset)) {
      wrongs.add(correct + offset);
    } else if (correct - offset >= 0 && correct - offset !== correct && !wrongs.has(correct - offset)) {
      wrongs.add(correct - offset);
    }
    offset++;
  }

  return [...wrongs].slice(0, 3);
}

/**
 * Generates an Easy math question.
 */
function generateEasyMathQuestion() {
  const op = OPERATIONS[getRandomInt(0, OPERATIONS.length - 1)];
  let text = "";
  let correct = 0;

  switch (op) {
    case "+": {
      const a = getRandomInt(10, 50);
      const b = getRandomInt(5, 50);
      correct = a + b;
      text = `${a} + ${b} = ?`;
      break;
    }
    case "-": {
      const a = getRandomInt(15, 80);
      const b = getRandomInt(5, a);
      correct = a - b;
      text = `${a} - ${b} = ?`;
      break;
    }
    case "×": {
      const a = getRandomInt(2, 12);
      const b = getRandomInt(2, 12);
      correct = a * b;
      text = `${a} × ${b} = ?`;
      break;
    }
    case "÷": {
      const b = getRandomInt(2, 12);
      correct = getRandomInt(2, 12);
      const a = b * correct;
      text = `${a} ÷ ${b} = ?`;
      break;
    }
    default: {
      correct = 10;
      text = "5 + 5 = ?";
    }
  }

  return { text, correct };
}

/**
 * Generates a Medium math question.
 * Features 2-digit multiplication, 3-digit whole division, and multi-operation arithmetic.
 */
function generateMediumMathQuestion() {
  const type = getRandomInt(1, 4);
  let text = "";
  let correct = 0;

  switch (type) {
    case 1: {
      // 2-digit multiplication (e.g. 25 × 14)
      const a = getRandomInt(12, 30);
      const b = getRandomInt(11, 20);
      correct = a * b;
      text = `${a} × ${b} = ?`;
      break;
    }
    case 2: {
      // 3-digit clean division (e.g. 144 ÷ 12, 225 ÷ 15, 360 ÷ 18)
      const b = getRandomInt(11, 25);
      correct = getRandomInt(11, 25);
      const a = b * correct;
      text = `${a} ÷ ${b} = ?`;
      break;
    }
    case 3: {
      // 3-term addition/subtraction (e.g. 35 + 48 - 17, 64 - 28 + 45)
      const isAddFirst = Math.random() > 0.5;
      if (isAddFirst) {
        const a = getRandomInt(20, 60);
        const b = getRandomInt(15, 50);
        const c = getRandomInt(10, Math.min(a + b - 1, 40));
        correct = a + b - c;
        text = `${a} + ${b} - ${c} = ?`;
      } else {
        const a = getRandomInt(40, 90);
        const b = getRandomInt(10, a - 5);
        const c = getRandomInt(15, 50);
        correct = a - b + c;
        text = `${a} - ${b} + ${c} = ?`;
      }
      break;
    }
    case 4: {
      // Multiplication + Addition/Subtraction (e.g. 15 × 8 - 20, 12 × 7 + 36)
      const a = getRandomInt(11, 20);
      const b = getRandomInt(5, 12);
      const prod = a * b;
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        const c = getRandomInt(15, 60);
        correct = prod + c;
        text = `${a} × ${b} + ${c} = ?`;
      } else {
        const c = getRandomInt(10, Math.min(prod - 1, 50));
        correct = prod - c;
        text = `${a} × ${b} - ${c} = ?`;
      }
      break;
    }
    default: {
      correct = 50;
      text = "25 × 2 = ?";
    }
  }

  return { text, correct };
}

/**
 * Generates a Hard math question.
 * Features percentages of whole numbers, difference of squares, bracketed expressions, and multi-step division arithmetic.
 */
function generateHardMathQuestion() {
  const type = getRandomInt(1, 4);
  let text = "";
  let correct = 0;

  switch (type) {
    case 1: {
      // Percentages of integers: (p * N) % 100 === 0 (e.g. 15% of 240 = 36, 25% of 360 = 90)
      const percentages = [5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 80];
      const p = percentages[getRandomInt(0, percentages.length - 1)];
      // Choose base N such that (p * N) % 100 === 0
      const multiples = [];
      for (let n = 40; n <= 600; n += 10) {
        if ((p * n) % 100 === 0) {
          multiples.push(n);
        }
      }
      const base = multiples[getRandomInt(0, multiples.length - 1)] || 200;
      correct = (p * base) / 100;
      text = `${p}% of ${base} = ?`;
      break;
    }
    case 2: {
      // Difference of squares: a² - b² = (a-b)(a+b) (e.g. 25² - 15² = 400, 20² - 12² = 256)
      const pairs = [
        [25, 15], [20, 12], [30, 20], [15, 9], [26, 24],
        [17, 15], [29, 21], [35, 25], [18, 12], [24, 16],
        [40, 30], [22, 18], [19, 11], [28, 22], [32, 18]
      ];
      const [a, b] = pairs[getRandomInt(0, pairs.length - 1)];
      correct = a * a - b * b;
      text = `${a}² - ${b}² = ?`;
      break;
    }
    case 3: {
      // Bracketed multi-step: (a × b) ÷ c = ? where (a * b) % c === 0 (e.g. (48 × 15) ÷ 6 = 120)
      const triples = [
        [48, 15, 6], [72, 12, 9], [65, 16, 5], [84, 15, 7],
        [96, 25, 8], [54, 20, 6], [75, 16, 4], [90, 14, 7],
        [108, 15, 9], [64, 35, 8], [120, 18, 6], [80, 24, 8]
      ];
      const [a, b, c] = triples[getRandomInt(0, triples.length - 1)];
      correct = (a * b) / c;
      text = `(${a} × ${b}) ÷ ${c} = ?`;
      break;
    }
    case 4: {
      // Multi-step division + addition/subtraction: a ÷ b + c = ? (e.g. 1200 ÷ 16 + 37 = 112)
      const divs = [
        [1200, 16, 37], [1500, 25, 48], [960, 15, 24], [1440, 18, 55],
        [1800, 24, 35], [1120, 14, 42], [1350, 15, 60], [1680, 20, 36],
        [2100, 28, 45], [1760, 16, 50]
      ];
      const [a, b, c] = divs[getRandomInt(0, divs.length - 1)];
      const quotient = a / b;
      const isAdd = Math.random() > 0.4;
      if (isAdd) {
        correct = quotient + c;
        text = `${a} ÷ ${b} + ${c} = ?`;
      } else {
        const safeC = Math.min(c, quotient - 5);
        correct = quotient - safeC;
        text = `${a} ÷ ${b} - ${safeC} = ?`;
      }
      break;
    }
    default: {
      correct = 100;
      text = "25 × 4 = ?";
    }
  }

  return { text, correct };
}

/**
 * Generates a single math question tailored to the specified difficulty tier.
 * @param {string} [difficulty="easy"] - "easy" | "medium" | "hard"
 * @returns {Object} Full question payload
 */
export function generateQuestion(difficulty = "easy") {
  const normDifficulty = String(difficulty || "easy").toLowerCase();
  let generated;

  if (normDifficulty === "hard") {
    generated = generateHardMathQuestion();
  } else if (normDifficulty === "medium") {
    generated = generateMediumMathQuestion();
  } else {
    generated = generateEasyMathQuestion();
  }

  const { text, correct } = generated;
  const wrongAnswers = generateWrongAnswers(correct, normDifficulty);
  const options = shuffle([correct, ...wrongAnswers]);

  const diffLabel = normDifficulty === "hard" ? "Hard" : normDifficulty === "medium" ? "Medium" : "Easy";

  return {
    id: `math-${Date.now()}-${getRandomInt(1000, 9999)}`,
    text,
    question: text,
    correct,
    options,
    category: "🧮 Math",
    difficulty: diffLabel,
    mode: "math",
  };
}

/**
 * Generates an array of match rounds.
 * @param {number} [count=6] - Number of rounds
 * @param {string} [difficulty="easy"] - Difficulty level
 * @returns {Array} Array of round objects
 */
export function generateRounds(count = 6, difficulty = "easy") {
  return Array.from({ length: count }, (_, i) => ({
    roundNumber: i + 1,
    question: generateQuestion(difficulty),
  }));
}
