const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getAuthHeaders() {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("math_battle_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const singlePlayerService = {
  /**
   * Start a new Single Player game session (Math, GK, or Grammar) with difficulty tier.
   */
  async start(mode = "math", difficulty = "medium") {
    const res = await fetch(`${API_URL}/api/singleplayer/start`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ mode, difficulty }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to start single player game.");
    }
    return data;
  },

  /**
   * Submit an answer for the current round in Single Player mode.
   */
  async submitAnswer(sessionId, round, answer) {
    const res = await fetch(`${API_URL}/api/singleplayer/answer`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId, round, answer }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to submit answer.");
    }
    return data;
  },

  /**
   * Process a timeout for the current round in Single Player mode.
   */
  async handleTimeout(sessionId, round) {
    const res = await fetch(`${API_URL}/api/singleplayer/timeout`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId, round }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to process timeout.");
    }
    return data;
  },
};
