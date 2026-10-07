import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { generateQuestion } from "../src/utils/mathUtils.js";
import { generateGKQuestion } from "../src/data/gkQuestions.js";
import { generateGrammarQuestion } from "../src/data/grammarQuestions.js";
import {
  registerUser,
  loginUser,
  verifyAuthToken,
  sanitizeName,
  getUserById,
  getUserCoins,
  addCoinsToUser,
  recordMatchResult,
} from "./authService.js";

const app = express();
app.use(cors());
app.use(express.json());

// ─── Authentication REST Routes ──────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const result = await registerUser({ name, email, password });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = await loginUser({ email, password });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message || "Login failed." });
  }
});

app.get("/api/auth/me", (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const user = verifyAuthToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized or invalid session token." });
    }
    return res.status(200).json({ success: true, user });
  } catch (err) {
    return res.status(401).json({ success: false, error: "Authentication failed." });
  }
});

// Helper to normalize difficulty
function normalizeDifficulty(difficulty) {
  const d = String(difficulty || "").toLowerCase().trim();
  if (d === "easy") return "easy";
  if (d === "hard") return "hard";
  return "medium";
}

// Helper to generate question by mode and difficulty
function generateQuestionForMode(mode, usedIndices = new Set(), difficulty = "medium") {
  const normalized = (mode || "math").toLowerCase();
  const normDiff = normalizeDifficulty(difficulty);
  if (normalized === "grammar") {
    return generateGrammarQuestion(usedIndices, normDiff);
  }
  if (normalized === "gk") {
    return generateGKQuestion(usedIndices, normDiff);
  }
  return generateQuestion(normDiff);
}

function getCategoryForMode(question, mode) {
  if (question?.category) return question.category;
  const normalized = (mode || "math").toLowerCase();
  if (normalized === "grammar") return "📚 English Grammar";
  if (normalized === "gk") return "🌍 General Knowledge";
  return "🧮 Math";
}

// ─── Single Player In-Memory Session Store ──────────────────────────────────
const singlePlayerSessions = new Map();

function cleanUpOldSinglePlayerSessions() {
  const now = Date.now();
  for (const [id, session] of singlePlayerSessions.entries()) {
    if (now - session.createdAt > 30 * 60 * 1000) {
      singlePlayerSessions.delete(id);
    }
  }
}

// ─── Single Player REST Routes ──────────────────────────────────────────────

app.post("/api/singleplayer/start", (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const user = verifyAuthToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized. Please log in first." });
    }

    const { mode = "math", difficulty = "medium" } = req.body || {};
    const rawMode = (mode || "math").toLowerCase();
    const chosenMode = rawMode === "grammar" ? "grammar" : rawMode === "gk" ? "gk" : "math";
    const chosenDiff = normalizeDifficulty(difficulty);
    const sessionId = "sp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);

    const usedIndices = new Set();
    const firstQuestion = generateQuestionForMode(chosenMode, usedIndices, chosenDiff);

    const session = {
      id: sessionId,
      userId: user.id,
      userName: user.name,
      mode: chosenMode,
      difficulty: chosenDiff,
      round: 1,
      totalRounds: 6,
      score: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      timeouts: 0,
      coinsEarned: 0,
      usedIndices,
      usedGkIndices: usedIndices,
      currentQuestion: firstQuestion,
      answeredRounds: new Set(),
      createdAt: Date.now(),
      isFinished: false,
    };

    singlePlayerSessions.set(sessionId, session);
    cleanUpOldSinglePlayerSessions();

    const clientSafeQuestion = {
      id: firstQuestion.id,
      text: firstQuestion.text,
      options: firstQuestion.options,
      category: getCategoryForMode(firstQuestion, chosenMode),
      difficulty: firstQuestion.difficulty || (chosenDiff === "hard" ? "Hard" : chosenDiff === "easy" ? "Easy" : "Medium"),
      mode: chosenMode,
      round: 1,
      totalRounds: 6,
      duration: 10,
    };

    return res.status(200).json({
      success: true,
      sessionId,
      gameMode: "single",
      questionMode: chosenMode,
      difficulty: chosenDiff,
      round: 1,
      totalRounds: 6,
      question: clientSafeQuestion,
      currentCoins: getUserCoins(user.id),
    });
  } catch (err) {
    console.error("[SinglePlayer Start Error]", err);
    return res.status(500).json({ success: false, error: "Failed to start single player game." });
  }
});

app.post("/api/singleplayer/answer", (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const user = verifyAuthToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { sessionId, round, answer } = req.body || {};
    const session = singlePlayerSessions.get(sessionId);

    if (!session || session.userId !== user.id) {
      return res.status(404).json({ success: false, error: "Active single player session not found." });
    }

    if (session.isFinished) {
      return res.status(400).json({ success: false, error: "Game has already ended." });
    }

    if (typeof round !== "number" || round !== session.round) {
      return res.status(400).json({ success: false, error: "Invalid round for answer submission." });
    }

    if (session.answeredRounds.has(round)) {
      return res.status(400).json({ success: false, error: "Round already answered." });
    }

    session.answeredRounds.add(round);

    const correctAnswer = session.currentQuestion.correct;
    const isCorrect = String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

    let coinsAwarded = 0;
    if (isCorrect) {
      session.score += 1;
      session.correctAnswers += 1;
      coinsAwarded = 10;
      session.coinsEarned += coinsAwarded;
      addCoinsToUser(user.id, coinsAwarded);
    } else {
      session.wrongAnswers += 1;
    }

    const isGameOver = session.round >= session.totalRounds;
    let nextQuestion = null;

    if (isGameOver) {
      session.isFinished = true;
      recordMatchResult(user.id, { isWinner: false, bonusCoins: 0 });
    } else {
      session.round += 1;
      const q = generateQuestionForMode(session.mode, session.usedIndices || session.usedGkIndices, session.difficulty);
      session.currentQuestion = q;
      nextQuestion = {
        id: q.id,
        text: q.text,
        options: q.options,
        category: getCategoryForMode(q, session.mode),
        difficulty: q.difficulty || (session.difficulty === "hard" ? "Hard" : session.difficulty === "easy" ? "Easy" : "Medium"),
        mode: session.mode,
        round: session.round,
        totalRounds: session.totalRounds,
        duration: 10,
      };
    }

    const totalCoins = getUserCoins(user.id);

    return res.status(200).json({
      success: true,
      isCorrect,
      correctAnswer,
      coinsAwarded,
      score: session.score,
      correctAnswers: session.correctAnswers,
      wrongAnswers: session.wrongAnswers,
      timeouts: session.timeouts,
      coinsEarned: session.coinsEarned,
      totalCoins,
      isGameOver,
      nextRound: session.round,
      nextQuestion,
      difficulty: session.difficulty,
    });
  } catch (err) {
    console.error("[SinglePlayer Answer Error]", err);
    return res.status(500).json({ success: false, error: "Failed to submit answer." });
  }
});

app.post("/api/singleplayer/timeout", (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const user = verifyAuthToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { sessionId, round } = req.body || {};
    const session = singlePlayerSessions.get(sessionId);

    if (!session || session.userId !== user.id) {
      return res.status(404).json({ success: false, error: "Session not found." });
    }

    if (session.isFinished) {
      return res.status(400).json({ success: false, error: "Game has already ended." });
    }

    if (typeof round !== "number" || round !== session.round) {
      return res.status(400).json({ success: false, error: "Invalid round." });
    }

    if (!session.answeredRounds.has(round)) {
      session.answeredRounds.add(round);
      session.timeouts += 1;
    }

    const correctAnswer = session.currentQuestion.correct;
    const isGameOver = session.round >= session.totalRounds;
    let nextQuestion = null;

    if (isGameOver) {
      session.isFinished = true;
      recordMatchResult(user.id, { isWinner: false, bonusCoins: 0 });
    } else {
      session.round += 1;
      const q = generateQuestionForMode(session.mode, session.usedIndices || session.usedGkIndices, session.difficulty);
      session.currentQuestion = q;
      nextQuestion = {
        id: q.id,
        text: q.text,
        options: q.options,
        category: getCategoryForMode(q, session.mode),
        difficulty: q.difficulty || (session.difficulty === "hard" ? "Hard" : session.difficulty === "easy" ? "Easy" : "Medium"),
        mode: session.mode,
        round: session.round,
        totalRounds: session.totalRounds,
        duration: 10,
      };
    }

    const totalCoins = getUserCoins(user.id);

    return res.status(200).json({
      success: true,
      status: "timeout",
      correctAnswer,
      coinsAwarded: 0,
      score: session.score,
      correctAnswers: session.correctAnswers,
      wrongAnswers: session.wrongAnswers,
      timeouts: session.timeouts,
      coinsEarned: session.coinsEarned,
      totalCoins,
      isGameOver,
      nextRound: session.round,
      nextQuestion,
      difficulty: session.difficulty,
    });
  } catch (err) {
    console.error("[SinglePlayer Timeout Error]", err);
    return res.status(500).json({ success: false, error: "Failed to process timeout." });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;
const TOTAL_ROUNDS = 6;
const ROUND_TIME = 10; // 10 seconds per round
const TRANSITION_DELAY = 2000; // 2 seconds delay between rounds
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

// In-memory room store: roomCode -> Room Object
const rooms = new Map();

// ─── Sanitization & Security Helpers ──────────────────────────────────────────

/**
 * Sanitizes player names against XSS and control characters.
 * Limits length to 20 characters.
 */
function sanitizePlayerName(name) {
  if (typeof name !== "string") return "Player";
  const cleaned = name
    .replace(/<[^>]*>?/gm, "")
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "")
    .trim();
  return cleaned.slice(0, 20) || "Player";
}

/**
 * Validates room code format (6 alphanumeric uppercase chars).
 */
function isValidRoomCode(code) {
  return typeof code === "string" && /^[A-Z0-9]{6}$/.test(code);
}

function generateUniqueRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function getNextAvailablePlayerNumber(players) {
  const taken = new Set(players.map((p) => p.playerNumber));
  for (let num = 1; num <= MAX_PLAYERS; num++) {
    if (!taken.has(num)) return num;
  }
  return players.length + 1;
}

function sanitizeRoom(room) {
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    mode: room.mode || "math",
    difficulty: room.difficulty || "medium",
    players: room.players.map((p) => ({
      id: p.id,
      userId: p.userId || null,
      name: p.name,
      playerNumber: p.playerNumber,
      score: p.score,
      coins: p.userId ? getUserCoins(p.userId) : (p.coins || 0),
      correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers,
      timeouts: p.timeouts,
      isReady: p.isReady,
      rematchReady: p.rematchReady ?? false,
      connected: p.connected,
      isHost: p.id === room.hostId,
    })),
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    gameStatus: room.gameStatus, // "lobby" | "starting" | "playing" | "roundResult" | "finished"
    roundStatus: room.roundStatus, // "idle" | "active" | "ended"
  };
}

function clearRoomTimers(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  if (room.transitionTimeout) {
    clearTimeout(room.transitionTimeout);
    room.transitionTimeout = null;
  }
}

// ─── Authoritative Round Lifecycle Functions ────────────────────────────────

function startNewRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  clearRoomTimers(room);

  // Check if all 6 rounds are completed
  if (room.currentRound >= TOTAL_ROUNDS) {
    endMatch(roomCode);
    return;
  }

  // Advance round and generate question based on selected room mode and difficulty
  room.currentRound += 1;
  const question = generateQuestionForMode(room.mode, room.usedIndices || room.usedGkIndices, room.difficulty);

  room.currentQuestion = question; // Stored securely on server; correctAnswer NOT sent to clients
  room.roundStatus = "active";
  room.gameStatus = "playing";
  room.roundWinnerId = null;
  room.roundWinnerName = null;
  room.roundRewardAwarded = false; // Prevents duplicate coin rewards for this round
  room.submittedPlayers.clear();
  room.timeRemaining = ROUND_TIME;
  room.roundStartTime = Date.now();
  room.expiresAt = room.roundStartTime + ROUND_TIME * 1000;

  console.log(`[Round ${room.currentRound}/${TOTAL_ROUNDS}] [Mode: ${room.mode}, Diff: ${room.difficulty}] Room ${roomCode}: ${question.text} (Answer: ${question.correct})`);

  // Safe client question payload (OMITS correctAnswer!)
  const clientQuestion = {
    id: question.id,
    text: question.text,
    options: question.options,
    category: getCategoryForMode(question, room.mode),
    difficulty: question.difficulty || (room.difficulty === "hard" ? "Hard" : room.difficulty === "easy" ? "Easy" : "Medium"),
    mode: room.mode,
    round: room.currentRound,
    totalRounds: TOTAL_ROUNDS,
    duration: ROUND_TIME,
    roundStartTime: room.roundStartTime,
    expiresAt: room.expiresAt,
    timeRemaining: ROUND_TIME,
  };

  io.to(roomCode).emit("game:question", {
    question: clientQuestion,
    mode: room.mode,
    difficulty: room.difficulty || "medium",
    round: room.currentRound,
    totalRounds: TOTAL_ROUNDS,
    timeRemaining: ROUND_TIME,
    expiresAt: room.expiresAt,
  });

  io.to(roomCode).emit("room:updated", sanitizeRoom(room));

  // Server authoritative timer interval
  room.timerInterval = setInterval(() => {
    room.timeRemaining -= 1;
    const remaining = Math.max(0, Math.ceil((room.expiresAt - Date.now()) / 1000));

    io.to(roomCode).emit("timer:tick", {
      timeRemaining: remaining,
      expiresAt: room.expiresAt,
    });

    if (Date.now() >= room.expiresAt || room.timeRemaining <= 0) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
      handleRoundTimeout(roomCode);
    }
  }, 1000);
}

function handleRoundTimeout(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.roundStatus !== "active") return;

  room.roundStatus = "ended";
  room.gameStatus = "roundResult";
  clearRoomTimers(room);

  // Record timeouts for players who didn't submit
  for (const player of room.players) {
    if (!room.submittedPlayers.has(player.id)) {
      player.timeouts += 1;
    }
  }

  console.log(`[Timeout] Room ${roomCode} Round ${room.currentRound} ended with no winner.`);

  // Reveal correct answer and broadcast round result
  io.to(roomCode).emit("round:result", {
    status: "timeout",
    winnerId: null,
    winnerName: null,
    coinsAwarded: 0,
    correctAnswer: room.currentQuestion ? room.currentQuestion.correct : null,
    scores: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      playerNumber: p.playerNumber,
      score: p.score,
      coins: p.userId ? getUserCoins(p.userId) : (p.coins || 0),
    })),
    message: "⏰ TIME'S UP! No player received a point or coins.",
    nextRoundIn: TRANSITION_DELAY,
  });

  io.to(roomCode).emit("room:updated", sanitizeRoom(room));

  // Automatically start next round after transition delay
  room.transitionTimeout = setTimeout(() => {
    startNewRound(roomCode);
  }, TRANSITION_DELAY);
}

function endMatch(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  clearRoomTimers(room);
  room.roundStatus = "ended";
  room.gameStatus = "finished";

  // Sort players by score descending
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const highestScore = sorted[0]?.score ?? 0;
  const topPlayers = sorted.filter((p) => p.score === highestScore);
  const isTie = topPlayers.length > 1;
  const winnerNames = topPlayers.map((p) => p.name);

  // Authoritatively award match results and bonus coins (strictly once per match)
  if (!room.matchRewardAwarded) {
    room.matchRewardAwarded = true;

    for (const player of room.players) {
      if (player.userId) {
        const isWinner = !isTie && highestScore > 0 && player.id === topPlayers[0].id;
        const bonusCoins = isWinner ? 20 : 0;
        recordMatchResult(player.userId, { isWinner, bonusCoins });
      }
    }
  }

  // Calculate ranks & leaderboard
  let currentRank = 1;
  const leaderboard = sorted.map((p, idx) => {
    if (idx > 0 && p.score < sorted[idx - 1].score) {
      currentRank = idx + 1;
    }
    const currentCoins = p.userId ? getUserCoins(p.userId) : (p.coins || 0);
    return {
      id: p.id,
      userId: p.userId || null,
      name: p.name,
      playerNumber: p.playerNumber,
      score: p.score,
      coins: currentCoins,
      rank: currentRank,
      correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers,
      timeouts: p.timeouts,
      rematchReady: p.rematchReady ?? false,
    };
  });

  // Calculate individual reward breakdowns
  const rewards = room.players.map((p) => {
    const isWinner = !isTie && highestScore > 0 && p.id === topPlayers[0]?.id;
    const roundRewards = (p.correctAnswers || 0) * 10;
    const winnerBonus = isWinner ? 20 : 0;
    const totalEarned = roundRewards + winnerBonus;
    const currentBalance = p.userId ? getUserCoins(p.userId) : (p.coins || 0);
    return {
      id: p.id,
      userId: p.userId || null,
      name: p.name,
      score: p.score,
      roundRewards,
      winnerBonus,
      totalEarned,
      currentBalance,
      isWinner,
      isTie,
    };
  });

  const winnerData = {
    isTie,
    names: winnerNames,
    winnerName: isTie ? `Tie between ${winnerNames.join(" and ")}` : `${winnerNames[0]} Wins!`,
    highestScore,
  };

  console.log(`[Match Finished] Room ${roomCode} Mode: ${room.mode} Diff: ${room.difficulty} Winner: ${winnerData.winnerName} (${highestScore} pts)`);

  io.to(roomCode).emit("game:over", {
    leaderboard,
    winner: winnerData,
    rewards,
    totalRounds: TOTAL_ROUNDS,
    mode: room.mode,
    difficulty: room.difficulty || "medium",
  });

  io.to(roomCode).emit("room:updated", sanitizeRoom(room));
}

// ─── Socket.IO Connection & Auth Middleware ─────────────────────────────────

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      const cleanToken = typeof token === "string" && token.startsWith("Bearer ") ? token.slice(7).trim() : token;
      const verified = verifyAuthToken(cleanToken);
      if (verified) {
        socket.user = verified;
      }
    }
  } catch (err) {
    console.warn("[Socket Auth Middleware Warning]", err.message);
  }
  next();
});

io.on("connection", (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}${socket.user ? ` (User: ${socket.user.name})` : ""}`);

  // ─── Create Room ──────────────────────────────────────────────────────────
  socket.on("room:create", ({ playerName, mode = "math", difficulty = "medium", token }, callback) => {
    try {
      const verifiedUser = (token ? verifyAuthToken(token) : null) || socket.user;
      const finalName = verifiedUser?.name || sanitizePlayerName(playerName);
      const rawMode = (mode || "math").toLowerCase();
      const chosenMode = rawMode === "grammar" ? "grammar" : rawMode === "gk" ? "gk" : "math";
      const chosenDiff = normalizeDifficulty(difficulty);
      const roomCode = generateUniqueRoomCode();

      const hostPlayer = {
        id: socket.id,
        userId: verifiedUser?.id || null,
        name: finalName,
        playerNumber: 1,
        score: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        timeouts: 0,
        isReady: true, // Host starts ready
        rematchReady: true,
        connected: true,
        isHost: true,
      };

      const room = {
        roomCode,
        hostId: socket.id,
        mode: chosenMode,
        difficulty: chosenDiff,
        usedIndices: new Set(),
        usedGkIndices: new Set(),
        players: [hostPlayer],
        gameStatus: "lobby",
        roundStatus: "idle",
        currentRound: 0,
        totalRounds: TOTAL_ROUNDS,
        currentQuestion: null,
        roundWinnerId: null,
        roundWinnerName: null,
        submittedPlayers: new Set(),
        timerInterval: null,
        timeRemaining: ROUND_TIME,
        transitionTimeout: null,
      };

      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.roomCode = roomCode;

      console.log(`[Room Created] ${roomCode} (Mode: ${chosenMode}, Diff: ${chosenDiff}) by ${finalName} (${socket.id})`);

      const sanitized = sanitizeRoom(room);
      if (typeof callback === "function") {
        callback({ success: true, roomCode, player: hostPlayer, room: sanitized });
      }
      io.to(roomCode).emit("room:updated", sanitized);
    } catch (err) {
      console.error("[Create Room Error]", err);
      callback?.({ success: false, error: "Failed to create game room. Please try again." });
    }
  });

  // ─── Join Room ────────────────────────────────────────────────────────────
  socket.on("room:join", ({ roomCode, playerName, token }, callback) => {
    try {
      const code = (roomCode || "").trim().toUpperCase();
      const verifiedUser = (token ? verifyAuthToken(token) : null) || socket.user;
      const sanitizedName = verifiedUser?.name || sanitizePlayerName(playerName);

      if (!isValidRoomCode(code)) {
        return callback?.({ success: false, error: "Please enter a valid 6-character room code." });
      }

      const room = rooms.get(code);
      if (!room) {
        return callback?.({ success: false, error: "Room not found. Please check the code and try again." });
      }

      if (room.players.length >= MAX_PLAYERS) {
        return callback?.({ success: false, error: "Room is full. Maximum 4 players allowed." });
      }

      if (room.gameStatus === "playing" || room.gameStatus === "starting") {
        return callback?.({ success: false, error: "Game has already started. You cannot join mid-match." });
      }

      // Reconnection handling: check if socket already in room
      const existingPlayer = room.players.find((p) => p.id === socket.id || (verifiedUser && p.userId === verifiedUser.id));
      if (existingPlayer) {
        existingPlayer.id = socket.id; // Update socket ID on reconnect
        existingPlayer.connected = true;
        socket.join(code);
        socket.roomCode = code;
        const sanitized = sanitizeRoom(room);
        callback?.({ success: true, roomCode: code, player: existingPlayer, room: sanitized });
        return io.to(code).emit("room:updated", sanitized);
      }

      const playerNumber = getNextAvailablePlayerNumber(room.players);
      const newPlayer = {
        id: socket.id,
        userId: verifiedUser?.id || null,
        name: sanitizedName || `Player ${playerNumber}`,
        playerNumber,
        score: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        timeouts: 0,
        isReady: false,
        rematchReady: false,
        connected: true,
      };

      room.players.push(newPlayer);
      socket.join(code);
      socket.roomCode = code;

      console.log(`[Player Joined] ${newPlayer.name} joined room ${code} (Mode: ${room.mode})`);

      const sanitized = sanitizeRoom(room);
      if (typeof callback === "function") {
        callback({ success: true, roomCode: code, player: newPlayer, room: sanitized });
      }
      io.to(code).emit("room:updated", sanitized);
      io.to(code).emit("notification", { message: `${newPlayer.name} joined the room.` });
    } catch (err) {
      console.error("[Join Room Error]", err);
      callback?.({ success: false, error: "Failed to join room. Please try again." });
    }
  });

  // ─── Toggle Ready Status (Lobby) ──────────────────────────────────────────
  socket.on("player:ready", ({ roomCode, isReady }) => {
    const code = (roomCode || socket.roomCode || "").toUpperCase();
    const room = rooms.get(code);
    if (!room || room.gameStatus !== "lobby") return;

    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.isReady = typeof isReady === "boolean" ? isReady : !player.isReady;
      console.log(`[Player Ready] ${player.name} in ${code} -> ${player.isReady}`);
      io.to(code).emit("room:updated", sanitizeRoom(room));
    }
  });

  // ─── Toggle Rematch Ready (Results Screen) ─────────────────────────────────
  socket.on("player:rematchReady", ({ roomCode, isReady }) => {
    const code = (roomCode || socket.roomCode || "").toUpperCase();
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.rematchReady = typeof isReady === "boolean" ? isReady : !player.rematchReady;
      console.log(`[Rematch Ready] ${player.name} in ${code} -> ${player.rematchReady}`);

      const sanitized = sanitizeRoom(room);
      io.to(code).emit("room:updated", sanitized);
      io.to(code).emit("rematch:updated", {
        players: sanitized.players,
        message: `${player.name} is ${player.rematchReady ? "ready for rematch" : "waiting"}.`,
      });
    }
  });

  // ─── Start Game / Start Rematch (Host only) ───────────────────────────────
  socket.on("game:start", ({ roomCode }, callback) => {
    const code = (roomCode || socket.roomCode || "").toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      return callback?.({ success: false, error: "Room not found." });
    }

    if (room.gameStatus === "playing" || room.gameStatus === "starting") {
      return callback?.({ success: false, error: "Game has already started." });
    }

    if (room.hostId !== socket.id) {
      return callback?.({ success: false, error: "Only the room host can start the game." });
    }

    if (room.players.length < MIN_PLAYERS) {
      return callback?.({ success: false, error: "Waiting for at least 1 more player." });
    }

    // If starting from lobby or rematch, ensure all players are ready
    const isRematch = room.gameStatus === "finished";
    const allReady = isRematch
      ? room.players.every((p) => p.rematchReady)
      : room.players.every((p) => p.isReady);

    if (!allReady) {
      return callback?.({ success: false, error: "Cannot start until everyone is ready." });
    }

    // Reset scores & stats for a fresh game
    room.currentRound = 0;
    room.usedIndices = new Set();
    room.usedGkIndices = new Set();
    room.gameStatus = "starting";
    room.matchRewardAwarded = false; // Reset for new match
    room.roundRewardAwarded = false;
    room.players.forEach((p) => {
      p.score = 0;
      p.correctAnswers = 0;
      p.wrongAnswers = 0;
      p.timeouts = 0;
      p.isReady = p.id === room.hostId;
      p.rematchReady = p.id === room.hostId;
    });

    console.log(`[Game Starting] Room ${code} (Mode: ${room.mode}) with ${room.players.length} players`);

    const sanitized = sanitizeRoom(room);
    callback?.({ success: true, room: sanitized });

    io.to(code).emit("game:started", {
      roomCode: code,
      mode: room.mode,
      totalRounds: TOTAL_ROUNDS,
      players: sanitized.players,
    });

    // Start Round 1
    startNewRound(code);
  });

  // ─── Submit Answer (Authoritative Evaluation) ─────────────────────────────
  socket.on("answer:submit", ({ roomCode, round, answer }, callback) => {
    const code = (roomCode || socket.roomCode || "").toUpperCase();
    const room = rooms.get(code);

    if (!room || room.gameStatus !== "playing" || room.roundStatus !== "active") {
      return callback?.({ success: false, error: "Round is not active." });
    }

    if (typeof round !== "number" || round !== room.currentRound) {
      return callback?.({ success: false, error: "Answer was for an old round." });
    }

    // Answer payload validation: must match one of the active options (supports numbers and strings)
    const isOptionValid = room.currentQuestion?.options?.some(
      (opt) => String(opt).trim().toLowerCase() === String(answer).trim().toLowerCase()
    );
    if (!isOptionValid) {
      return callback?.({ success: false, error: "Invalid answer option submitted." });
    }

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      return callback?.({ success: false, error: "Player not in room." });
    }

    if (room.submittedPlayers.has(socket.id)) {
      return callback?.({ success: false, error: "You have already submitted an answer for this round." });
    }

    // Mark that this player has submitted an answer for this round
    room.submittedPlayers.add(socket.id);

    const isCorrect = String(answer).trim().toLowerCase() === String(room.currentQuestion.correct).trim().toLowerCase();

    if (isCorrect) {
      // First player who answers correctly wins the round point!
      if (!room.roundWinnerId) {
        room.roundWinnerId = socket.id;
        room.roundWinnerName = player.name;
        player.score += 1;
        player.correctAnswers += 1;
        room.roundStatus = "ended";
        room.gameStatus = "roundResult";

        // Authoritatively award +10 coins on server (strictly once per round)
        let updatedCoins = 0;
        if (!room.roundRewardAwarded) {
          room.roundRewardAwarded = true;
          if (player.userId) {
            updatedCoins = addCoinsToUser(player.userId, 10);
            player.coins = updatedCoins;
          }
        }

        clearRoomTimers(room);

        console.log(`[Fastest Correct Answer] ${player.name} won Round ${room.currentRound} in ${code}! (+1 pt, +10 Coins)`);

        // Send individual confirmation to submitter
        socket.emit("answer:result", {
          isCorrect: true,
          isFirst: true,
          coinsAwarded: 10,
          currentCoins: updatedCoins,
          message: "Correct! +1 pt & +10 🪙",
        });

        // Broadcast round win result to everyone in room
        io.to(code).emit("round:result", {
          status: "won",
          winnerId: player.id,
          winnerName: player.name,
          coinsAwarded: 10,
          correctAnswer: room.currentQuestion.correct,
          scores: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            playerNumber: p.playerNumber,
            score: p.score,
            coins: p.userId ? getUserCoins(p.userId) : (p.coins || 0),
          })),
          message: `⚡ ${player.name} answered correctly first! (+1 pt, +10 🪙)`,
          nextRoundIn: TRANSITION_DELAY,
        });

        io.to(code).emit("room:updated", sanitizeRoom(room));

        // Schedule next round after transition delay
        room.transitionTimeout = setTimeout(() => {
          startNewRound(code);
        }, TRANSITION_DELAY);

        return callback?.({ success: true, isCorrect: true, isFirst: true, coinsAwarded: 10 });
      } else {
        // Correct, but too late (another player was faster)
        socket.emit("answer:result", {
          isCorrect: true,
          isFirst: false,
          coinsAwarded: 0,
          message: `Too late! ${room.roundWinnerName} got the point.`,
        });
        return callback?.({ success: true, isCorrect: true, isFirst: false });
      }
    } else {
      // Incorrect answer: 0 points, other players can keep trying
      player.wrongAnswers += 1;
      console.log(`[Wrong Answer] ${player.name} answered '${answer}' (expected '${room.currentQuestion.correct}')`);

      socket.emit("answer:result", {
        isCorrect: false,
        isFirst: false,
        coinsAwarded: 0,
        message: "Incorrect! 0 pts & 0 🪙",
      });

      return callback?.({ success: true, isCorrect: false, isFirst: false });
    }
  });

  // ─── Play Again / Return to Lobby ─────────────────────────────────────────
  socket.on("game:playAgain", ({ roomCode }) => {
    const code = (roomCode || socket.roomCode || "").toUpperCase();
    const room = rooms.get(code);
    if (!room) return;

    clearRoomTimers(room);

    // Reset room state back to lobby (preserves room.mode)
    room.gameStatus = "lobby";
    room.roundStatus = "idle";
    room.currentRound = 0;
    room.currentQuestion = null;
    room.roundWinnerId = null;
    room.roundWinnerName = null;
    room.submittedPlayers.clear();
    room.usedIndices = new Set();
    room.usedGkIndices = new Set();

    // Reset player scores and ready states (host stays ready)
    room.players.forEach((p) => {
      p.score = 0;
      p.correctAnswers = 0;
      p.wrongAnswers = 0;
      p.timeouts = 0;
      p.isReady = p.id === room.hostId;
      p.rematchReady = p.id === room.hostId;
    });

    console.log(`[Play Again] Room ${code} reset to lobby (Mode: ${room.mode})`);

    const sanitized = sanitizeRoom(room);
    io.to(code).emit("game:reset", sanitized);
    io.to(code).emit("room:updated", sanitized);
  });

  // ─── Leave Room ───────────────────────────────────────────────────────────
  socket.on("room:leave", ({ roomCode }) => {
    const code = (roomCode || socket.roomCode || "").toUpperCase();
    handlePlayerLeave(socket, code);
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    if (socket.roomCode) {
      handlePlayerLeave(socket, socket.roomCode);
    } else {
      for (const [code, room] of rooms.entries()) {
        const inRoom = room.players.some((p) => p.id === socket.id);
        if (inRoom) {
          handlePlayerLeave(socket, code);
          break;
        }
      }
    }
  });
});

function handlePlayerLeave(socket, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const playerIndex = room.players.findIndex((p) => p.id === socket.id);
  if (playerIndex === -1) return;

  const leavingPlayer = room.players[playerIndex];
  const wasHost = room.hostId === socket.id;

  room.players.splice(playerIndex, 1);
  socket.leave(roomCode);
  socket.roomCode = null;

  console.log(`[Player Left] ${leavingPlayer.name} left room ${roomCode}`);

  if (room.players.length === 0) {
    clearRoomTimers(room);
    rooms.delete(roomCode);
    console.log(`[Room Deleted] ${roomCode} is empty`);
  } else {
    // If host left, promote lowest available player number as the new host
    let newHostName = null;
    if (wasHost) {
      room.players.sort((a, b) => a.playerNumber - b.playerNumber);
      room.hostId = room.players[0].id;
      room.players[0].isReady = true;
      room.players[0].rematchReady = true;
      newHostName = room.players[0].name;
      console.log(`[New Host] ${room.players[0].name} (${room.players[0].id}) in room ${roomCode}`);
    }

    const sanitized = sanitizeRoom(room);
    io.to(roomCode).emit("room:updated", sanitized);

    io.to(roomCode).emit("player:left", {
      playerName: leavingPlayer.name,
      newHostName,
      wasHost,
      remainingCount: room.players.length,
      message: wasHost
        ? `${leavingPlayer.name} left the game. ${newHostName} is now the host.`
        : `${leavingPlayer.name} disconnected.`,
    });
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", activeRooms: rooms.size });
});

server.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(`Math Battle Multiplayer Server on port ${PORT}`);
  console.log(`WebSocket URL: ws://localhost:${PORT}`);
  console.log(`==========================================`);
});
