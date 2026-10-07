import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    const authToken = token || (typeof localStorage !== "undefined" ? localStorage.getItem("math_battle_token") : null);
    if (this.socket && this.socket.connected) {
      if (authToken) {
        this.socket.auth = { token: authToken };
      }
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token: authToken },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("[Socket Connected]", this.socket.id);
    });

    this.socket.on("connect_error", (err) => {
      console.warn("[Socket Connection Error]", err.message);
    });

    return this.socket;
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  getSocketId() {
    return this.socket?.id ?? null;
  }

  createRoom(playerName, mode = "math", difficulty = "medium", callback) {
    const s = this.getSocket();
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("math_battle_token") : null;
    if (typeof difficulty === "function") {
      callback = difficulty;
      difficulty = "medium";
    }
    if (typeof mode === "function") {
      callback = mode;
      mode = "math";
      difficulty = "medium";
    }
    s.emit("room:create", { playerName, mode, difficulty, token }, callback);
  }

  joinRoom(roomCode, playerName, callback) {
    const s = this.getSocket();
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("math_battle_token") : null;
    s.emit("room:join", { roomCode, playerName, token }, callback);
  }

  toggleReady(roomCode, isReady) {
    const s = this.getSocket();
    s.emit("player:ready", { roomCode, isReady });
  }

  toggleRematchReady(roomCode, isReady) {
    const s = this.getSocket();
    s.emit("player:rematchReady", { roomCode, isReady });
  }

  startGame(roomCode, callback) {
    const s = this.getSocket();
    s.emit("game:start", { roomCode }, callback);
  }

  submitAnswer(roomCode, round, answer, callback) {
    const s = this.getSocket();
    s.emit("answer:submit", { roomCode, round, answer }, callback);
  }

  playAgain(roomCode) {
    const s = this.getSocket();
    s.emit("game:playAgain", { roomCode });
  }

  leaveRoom(roomCode) {
    if (this.socket) {
      this.socket.emit("room:leave", { roomCode });
    }
  }

  onRoomUpdated(callback) {
    const s = this.getSocket();
    s.on("room:updated", callback);
    return () => s.off("room:updated", callback);
  }

  onGameStarted(callback) {
    const s = this.getSocket();
    s.on("game:started", callback);
    return () => s.off("game:started", callback);
  }

  onQuestion(callback) {
    const s = this.getSocket();
    s.on("game:question", callback);
    return () => s.off("game:question", callback);
  }

  onTimerTick(callback) {
    const s = this.getSocket();
    s.on("timer:tick", callback);
    return () => s.off("timer:tick", callback);
  }

  onAnswerResult(callback) {
    const s = this.getSocket();
    s.on("answer:result", callback);
    return () => s.off("answer:result", callback);
  }

  onRoundResult(callback) {
    const s = this.getSocket();
    s.on("round:result", callback);
    return () => s.off("round:result", callback);
  }

  onGameOver(callback) {
    const s = this.getSocket();
    s.on("game:over", callback);
    return () => s.off("game:over", callback);
  }

  onGameReset(callback) {
    const s = this.getSocket();
    s.on("game:reset", callback);
    return () => s.off("game:reset", callback);
  }

  onPlayerLeft(callback) {
    const s = this.getSocket();
    s.on("player:left", callback);
    return () => s.off("player:left", callback);
  }

  onNotification(callback) {
    const s = this.getSocket();
    s.on("notification", callback);
    return () => s.off("notification", callback);
  }

  onRematchUpdated(callback) {
    const s = this.getSocket();
    s.on("rematch:updated", callback);
    return () => s.off("rematch:updated", callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
