import { useState, useEffect, useCallback, useRef } from "react";
import { TOTAL_ROUNDS, MAX_PLAYERS, MIN_PLAYERS, QUESTION_TIMER } from "../data/mockData";
import { socketService } from "../services/socket";
import { singlePlayerService } from "../services/singlePlayerService";

/**
 * Central game state hook supporting both Single Player and Multiplayer across Math & GK modes.
 */
export function useGameState() {
  const [screen, setScreen] = useState("home"); // "home" | "lobby" | "game" | "results"
  const [gameMode, setGameMode] = useState("single"); // "single" | "multiplayer"
  const [questionMode, setQuestionMode] = useState("math"); // "math" | "gk" | "grammar"
  const [difficulty, setDifficulty] = useState("medium"); // "easy" | "medium" | "hard"
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem("math_battle_name") || "Player 1";
  });
  const [players, setPlayers] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [socketId, setSocketId] = useState(null);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  // Synchronized Round & Question State
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(QUESTION_TIMER);
  const [expiresAt, setExpiresAt] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerResult, setAnswerResult] = useState(null); // { isCorrect, isFirst, message }
  const [roundResult, setRoundResult] = useState(null);   // { status, winnerName, correctAnswer, message }
  const [roundOver, setRoundOver] = useState(false);
  const [gameOverData, setGameOverData] = useState(null); // Multiplayer / Singleplayer final results

  // Single Player Specific Session Tracking
  const [singlePlayerStats, setSinglePlayerStats] = useState({
    sessionId: null,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    timeouts: 0,
    coinsEarned: 0,
    totalCoins: 0,
  });

  const singlePlayerTransitionTimerRef = useRef(null);

  // ─── Toast Notification Helper ────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  // ─── Player Name Persistence ──────────────────────────────────────────────
  const handleNameChange = useCallback((name) => {
    setPlayerName(name);
    try {
      localStorage.setItem("math_battle_name", name);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // ─── Socket.IO Subscriptions (Multiplayer) ────────────────────────────────
  useEffect(() => {
    const socket = socketService.connect();

    const handleConnect = () => {
      setSocketId(socket.id);
    };

    if (socket.connected) {
      setSocketId(socket.id);
    }

    socket.on("connect", handleConnect);

    // 1. Room updates
    const unsubRoom = socketService.onRoomUpdated((room) => {
      if (room) {
        setRoomCode(room.roomCode);
        setPlayers(room.players || []);
        setHostId(room.hostId);
        if (room.mode) {
          setQuestionMode(room.mode);
        }
        if (room.difficulty) {
          setDifficulty(room.difficulty.toLowerCase());
        }
      }
    });

    // 2. Notifications
    const unsubNotif = socketService.onNotification((data) => {
      if (data?.message) {
        showToast(data.message);
      }
    });

    const unsubPlayerLeft = socketService.onPlayerLeft((data) => {
      if (data?.message) {
        showToast(data.message);
      }
    });

    // 3. Game started initial event (Multiplayer)
    const unsubGameStart = socketService.onGameStarted((data) => {
      setGameMode("multiplayer");
      if (data?.mode) {
        setQuestionMode(data.mode);
      }
      if (data?.difficulty) {
        setDifficulty(data.difficulty.toLowerCase());
      }
      setSelectedAnswer(null);
      setAnswerResult(null);
      setRoundResult(null);
      setRoundOver(false);
      setGameOverData(null);
      setScreen("game");
    });

    // 4. Server question broadcast (Multiplayer)
    const unsubQuestion = socketService.onQuestion((data) => {
      if (data && data.question) {
        setGameMode("multiplayer");
        setCurrentQuestion(data.question);
        if (data.mode || data.question.mode) {
          setQuestionMode(data.mode || data.question.mode);
        }
        if (data.difficulty || data.question.difficulty) {
          setDifficulty((data.difficulty || data.question.difficulty).toLowerCase());
        }
        setExpiresAt(data.expiresAt ?? null);
        setTimeRemaining(data.timeRemaining ?? QUESTION_TIMER);
        setSelectedAnswer(null);
        setAnswerResult(null);
        setRoundResult(null);
        setRoundOver(false);
        setScreen("game");
      }
    });

    // 5. Server timer tick synchronization (Multiplayer)
    const unsubTimer = socketService.onTimerTick((data) => {
      if (gameMode === "multiplayer" && data) {
        if (data.expiresAt) {
          const remaining = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000));
          setTimeRemaining(remaining);
        } else if (typeof data.timeRemaining === "number") {
          setTimeRemaining(data.timeRemaining);
        }
      }
    });

    // 6. Individual answer submission acknowledgment (Multiplayer)
    const unsubAnswerRes = socketService.onAnswerResult((data) => {
      if (gameMode === "multiplayer") {
        setAnswerResult(data);
      }
    });

    // 7. Room-wide round outcome (Multiplayer)
    const unsubRoundRes = socketService.onRoundResult((data) => {
      if (gameMode === "multiplayer") {
        setRoundResult(data);
        setRoundOver(true);
        if (data.scores) {
          setPlayers((prev) =>
            prev.map((p) => {
              const updated = data.scores.find((s) => s.id === p.id);
              return updated ? { ...p, score: updated.score, coins: updated.coins ?? p.coins } : p;
            })
          );
        }
      }
    });

    // 8. Match completion (Multiplayer)
    const unsubGameOver = socketService.onGameOver((data) => {
      if (gameMode === "multiplayer") {
        if (data?.mode) {
          setQuestionMode(data.mode);
        }
        setGameOverData({ ...data, gameMode: "multiplayer" });
        setScreen("results");
      }
    });

    // 9. Play Again / Reset back to lobby (Multiplayer)
    const unsubGameReset = socketService.onGameReset((room) => {
      setGameMode("multiplayer");
      setCurrentQuestion(null);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setRoundResult(null);
      setRoundOver(false);
      setGameOverData(null);
      if (room) {
        setRoomCode(room.roomCode);
        setPlayers(room.players || []);
        setHostId(room.hostId);
        if (room.mode) {
          setQuestionMode(room.mode);
        }
      }
      setScreen("lobby");
    });

    return () => {
      socket.off("connect", handleConnect);
      unsubRoom();
      unsubNotif();
      unsubPlayerLeft();
      unsubGameStart();
      unsubQuestion();
      unsubTimer();
      unsubAnswerRes();
      unsubRoundRes();
      unsubGameOver();
      unsubGameReset();
    };
  }, [showToast, gameMode]);

  // ─── Single Player Local Timer Countdown ──────────────────────────────────
  useEffect(() => {
    if (gameMode !== "single" || screen !== "game" || roundOver) {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSinglePlayerTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameMode, screen, roundOver, currentQuestion]);

  // ─── Single Player Timeout Handler ────────────────────────────────────────
  const handleSinglePlayerTimeout = useCallback(async () => {
    if (!singlePlayerStats.sessionId || !currentQuestion || roundOver) return;

    setRoundOver(true);

    try {
      const res = await singlePlayerService.handleTimeout(
        singlePlayerStats.sessionId,
        currentQuestion.round
      );

      setSinglePlayerStats((prev) => ({
        ...prev,
        timeouts: res.timeouts,
        totalCoins: res.totalCoins,
      }));

      setRoundResult({
        status: "timeout",
        correctAnswer: res.correctAnswer,
        message: "⏰ TIME'S UP! No points or coins.",
      });

      singlePlayerTransitionTimerRef.current = setTimeout(() => {
        if (res.isGameOver) {
          setGameOverData({
            gameMode: "single",
            questionMode: res.questionMode || questionMode,
            difficulty: res.difficulty || difficulty,
            score: res.score,
            totalRounds: TOTAL_ROUNDS,
            correctAnswers: res.correctAnswers,
            wrongAnswers: res.wrongAnswers,
            timeouts: res.timeouts,
            coinsEarned: res.coinsEarned,
            totalCoins: res.totalCoins,
          });
          setScreen("results");
        } else if (res.nextQuestion) {
          setCurrentQuestion(res.nextQuestion);
          setSelectedAnswer(null);
          setAnswerResult(null);
          setRoundResult(null);
          setRoundOver(false);
          setTimeRemaining(QUESTION_TIMER);
        }
      }, 2000);
    } catch (err) {
      console.warn("[SinglePlayer Timeout Error]", err);
    }
  }, [singlePlayerStats.sessionId, currentQuestion, roundOver, questionMode, difficulty]);

  // ─── Single Player Answer Submission ──────────────────────────────────────
  const submitSinglePlayerAnswer = useCallback(
    async (answer) => {
      if (
        selectedAnswer !== null ||
        roundOver ||
        timeRemaining <= 0 ||
        !currentQuestion ||
        !singlePlayerStats.sessionId
      ) {
        return;
      }

      setSelectedAnswer(answer);
      setRoundOver(true);

      try {
        const res = await singlePlayerService.submitAnswer(
          singlePlayerStats.sessionId,
          currentQuestion.round,
          answer
        );

        setSinglePlayerStats((prev) => ({
          ...prev,
          score: res.score,
          correctAnswers: res.correctAnswers,
          wrongAnswers: res.wrongAnswers,
          coinsEarned: res.coinsEarned,
          totalCoins: res.totalCoins,
        }));

        setAnswerResult({
          isCorrect: res.isCorrect,
          isFirst: true,
          message: res.isCorrect ? "Correct! +1 pt & +10 🪙" : "Incorrect! 0 pts & 0 🪙",
        });

        setRoundResult({
          status: res.isCorrect ? "won" : "wrong",
          correctAnswer: res.correctAnswer,
          message: res.isCorrect
            ? "⚡ Correct Answer! (+1 pt, +10 🪙)"
            : "❌ Incorrect Answer! (0 pts & 0 🪙)",
        });

        singlePlayerTransitionTimerRef.current = setTimeout(() => {
          if (res.isGameOver) {
            setGameOverData({
              gameMode: "single",
              questionMode: res.questionMode || questionMode,
              difficulty: res.difficulty || difficulty,
              score: res.score,
              totalRounds: TOTAL_ROUNDS,
              correctAnswers: res.correctAnswers,
              wrongAnswers: res.wrongAnswers,
              timeouts: res.timeouts,
              coinsEarned: res.coinsEarned,
              totalCoins: res.totalCoins,
            });
            setScreen("results");
          } else if (res.nextQuestion) {
            setCurrentQuestion(res.nextQuestion);
            setSelectedAnswer(null);
            setAnswerResult(null);
            setRoundResult(null);
            setRoundOver(false);
            setTimeRemaining(QUESTION_TIMER);
          }
        }, 2000);
      } catch (err) {
        console.warn("[SinglePlayer Submit Error]", err);
      }
    },
    [selectedAnswer, roundOver, timeRemaining, currentQuestion, singlePlayerStats.sessionId, questionMode, difficulty]
  );

  // ─── Single Player Start / Restart ────────────────────────────────────────
  const startSinglePlayer = useCallback(
    async (chosenMode = "math", chosenDifficulty = "medium", onComplete) => {
      if (typeof chosenDifficulty === "function") {
        onComplete = chosenDifficulty;
        chosenDifficulty = "medium";
      }
      setError(null);
      if (singlePlayerTransitionTimerRef.current) {
        clearTimeout(singlePlayerTransitionTimerRef.current);
      }

      const cleanMode = chosenMode === "gk" ? "gk" : chosenMode === "grammar" ? "grammar" : "math";
      const cleanDiff = chosenDifficulty === "hard" ? "hard" : chosenDifficulty === "easy" ? "easy" : "medium";

      try {
        const res = await singlePlayerService.start(cleanMode, cleanDiff);
        onComplete?.();

        setGameMode("single");
        setQuestionMode(cleanMode);
        setDifficulty(cleanDiff);
        setSinglePlayerStats({
          sessionId: res.sessionId,
          score: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          timeouts: 0,
          coinsEarned: 0,
          totalCoins: res.currentCoins || 0,
        });
        setCurrentQuestion(res.question);
        setTimeRemaining(QUESTION_TIMER);
        setSelectedAnswer(null);
        setAnswerResult(null);
        setRoundResult(null);
        setRoundOver(false);
        setGameOverData(null);
        setScreen("game");
      } catch (err) {
        onComplete?.();
        setError(err.message || "Failed to start single player game.");
      }
    },
    []
  );

  // ─── Multiplayer Room Actions ─────────────────────────────────────────────
  const createGame = useCallback(
    (name, chosenMode = "math", chosenDifficulty = "medium", onComplete) => {
      if (typeof chosenDifficulty === "function") {
        onComplete = chosenDifficulty;
        chosenDifficulty = "medium";
      }
      if (typeof chosenMode === "function") {
        onComplete = chosenMode;
        chosenMode = "math";
        chosenDifficulty = "medium";
      }
      setError(null);
      const chosenName = (name || playerName || "Player 1").trim();
      const cleanMode = chosenMode === "gk" ? "gk" : chosenMode === "grammar" ? "grammar" : "math";
      const cleanDiff = chosenDifficulty === "hard" ? "hard" : chosenDifficulty === "easy" ? "easy" : "medium";

      socketService.createRoom(chosenName, cleanMode, cleanDiff, (res) => {
        onComplete?.();
        if (res && res.success) {
          setGameMode("multiplayer");
          setRoomCode(res.roomCode);
          setQuestionMode(res.room.mode || cleanMode);
          setDifficulty(res.room.difficulty || cleanDiff);
          setPlayers(res.room.players);
          setHostId(res.room.hostId);
          setSocketId(socketService.getSocketId());
          setScreen("lobby");
        } else {
          setError(res?.error || "Failed to create room.");
        }
      });
    },
    [playerName]
  );

  const joinGame = useCallback(
    (code, name, onComplete) => {
      setError(null);
      const chosenCode = (code || "").trim().toUpperCase();
      const chosenName = (name || playerName || "").trim();

      socketService.joinRoom(chosenCode, chosenName, (res) => {
        onComplete?.();
        if (res && res.success) {
          setGameMode("multiplayer");
          setRoomCode(res.roomCode);
          if (res.room.mode) {
            setQuestionMode(res.room.mode);
          }
          if (res.room.difficulty) {
            setDifficulty(res.room.difficulty);
          }
          setPlayers(res.room.players);
          setHostId(res.room.hostId);
          setSocketId(socketService.getSocketId());
          setScreen("lobby");
        } else {
          setError(res?.error || "Failed to join room.");
        }
      });
    },
    [playerName]
  );

  const toggleReady = useCallback(() => {
    const currentId = socketId || socketService.getSocketId();
    const self = players.find((p) => p.id === currentId);
    const nextReady = self ? !self.isReady : true;
    socketService.toggleReady(roomCode, nextReady);
  }, [players, socketId, roomCode]);

  const toggleRematchReady = useCallback(() => {
    const currentId = socketId || socketService.getSocketId();
    const self = players.find((p) => p.id === currentId);
    const nextReady = self ? !self.rematchReady : true;
    socketService.toggleRematchReady(roomCode, nextReady);
  }, [players, socketId, roomCode]);

  const startGame = useCallback(
    (onComplete) => {
      setError(null);
      socketService.startGame(roomCode, (res) => {
        onComplete?.();
        if (!res?.success) {
          setError(res?.error || "Failed to start game.");
        }
      });
    },
    [roomCode]
  );

  // ─── Unified Answer Submission ────────────────────────────────────────────
  const submitAnswer = useCallback(
    (answer) => {
      if (gameMode === "single") {
        submitSinglePlayerAnswer(answer);
        return;
      }

      // Multiplayer answer submission
      if (selectedAnswer !== null || roundOver || timeRemaining <= 0 || !currentQuestion) {
        return;
      }

      setSelectedAnswer(answer);
      socketService.submitAnswer(roomCode, currentQuestion.round, answer, (res) => {
        if (!res?.success && res?.error) {
          console.warn("[Submit Answer Error]", res.error);
        }
      });
    },
    [gameMode, submitSinglePlayerAnswer, selectedAnswer, roundOver, timeRemaining, currentQuestion, roomCode]
  );

  // ─── Unified Play Again ───────────────────────────────────────────────────
  const playAgain = useCallback(() => {
    if (gameMode === "single") {
      startSinglePlayer(questionMode, difficulty);
    } else {
      socketService.playAgain(roomCode);
    }
  }, [gameMode, questionMode, difficulty, startSinglePlayer, roomCode]);

  // ─── Unified Return to Home / Leave Game ──────────────────────────────────
  const leaveGame = useCallback(() => {
    if (singlePlayerTransitionTimerRef.current) {
      clearTimeout(singlePlayerTransitionTimerRef.current);
    }
    if (gameMode === "multiplayer" && roomCode) {
      socketService.leaveRoom(roomCode);
    }
    setScreen("home");
    setRoomCode("");
    setPlayers([]);
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setRoundResult(null);
    setRoundOver(false);
    setGameOverData(null);
    setError(null);
  }, [gameMode, roomCode]);

  // ─── Derived State ────────────────────────────────────────────────────────
  const currentSocketId = socketId || socketService.getSocketId();
  const isHost = Boolean(hostId && currentSocketId && hostId === currentSocketId);
  const selfPlayer = players.find((p) => p.id === currentSocketId);
  const isSelfReady = selfPlayer?.isReady ?? false;
  const isSelfRematchReady = selfPlayer?.rematchReady ?? false;
  const currentScore = gameMode === "single" ? singlePlayerStats.score : (selfPlayer?.score ?? 0);
  const roundNumber = currentQuestion?.round ?? 1;

  // 4 player slots for Multiplayer UI
  const playerSlots = Array.from({ length: MAX_PLAYERS }, (_, i) => players[i] ?? null);

  // Sorted scoreboard for Multiplayer
  const scoreboard = [...players].sort((a, b) => b.score - a.score);

  // Rematch status checks for Multiplayer
  const allRematchReady = players.length >= MIN_PLAYERS && players.every((p) => p.rematchReady);

  return {
    // State
    screen,
    gameMode,
    questionMode,
    difficulty,
    mode: questionMode,
    roomCode,
    playerName,
    players,
    playerSlots,
    roundNumber,
    totalRounds: TOTAL_ROUNDS,
    currentQuestion,
    timeRemaining,
    expiresAt,
    selectedAnswer,
    answerResult,
    roundResult,
    roundOver,
    currentScore,
    singlePlayerStats,
    scoreboard,
    gameOverData,
    hostId,
    isHost,
    currentSocketId,
    isSelfReady,
    isSelfRematchReady,
    allRematchReady,
    error,
    toastMessage,
    // Actions
    setPlayerName: handleNameChange,
    setDifficulty,
    clearError: () => setError(null),
    showToast,
    goHome: leaveGame,
    leaveGame,
    startSinglePlayer,
    createGame,
    joinGame,
    toggleReady,
    toggleRematchReady,
    startGame,
    submitAnswer,
    playAgain,
  };
}
