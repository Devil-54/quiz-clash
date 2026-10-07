import { useEffect } from "react";
import AudioToggle from "../AudioToggle/AudioToggle";
import Confetti from "../Confetti/Confetti";
import { sound } from "../../utils/audio";
import "./Results.css";

const AVATAR_COLORS = ["#e94560", "#f5a623", "#27ae60", "#3498db"];
const RANK_MEDALS   = ["🥇", "🥈", "🥉", "4th"];

export default function Results({
  gameMode = "single",
  mode = "math",
  difficulty = "medium",
  user,
  gameOverData,
  singlePlayerStats = {},
  players = [],
  currentSocketId,
  isHost = false,
  isSelfRematchReady = false,
  allRematchReady = false,
  totalRounds = 6,
  onToggleRematchReady,
  onStartRematch,
  onReturnToLobby,
  onPlayAgain,
  onBackToHome,
  onLeaveGame,
}) {
  // Play celebration audio fanfare on mount
  useEffect(() => {
    sound.playVictory();
  }, []);

  const isSingle = (gameOverData?.gameMode || gameMode) === "single";
  const questionMode = gameOverData?.questionMode || gameOverData?.mode || mode || "math";
  const isGK = questionMode === "gk";
  const isGrammar = questionMode === "grammar";
  const rawDiff = gameOverData?.difficulty || difficulty || "medium";
  const diffLabel = rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase();

  // ─── Single Player Results View ───────────────────────────────────────────
  if (isSingle) {
    const score = gameOverData?.score ?? singlePlayerStats?.score ?? 0;
    const rounds = gameOverData?.totalRounds || totalRounds || 6;
    const correct = gameOverData?.correctAnswers ?? singlePlayerStats?.correctAnswers ?? 0;
    const wrong = gameOverData?.wrongAnswers ?? singlePlayerStats?.wrongAnswers ?? 0;
    const timeouts = gameOverData?.timeouts ?? singlePlayerStats?.timeouts ?? 0;
    const coinsEarned = gameOverData?.coinsEarned ?? singlePlayerStats?.coinsEarned ?? (correct * 10);
    const totalCoins = gameOverData?.totalCoins ?? singlePlayerStats?.totalCoins ?? user?.coins ?? 0;

    const handlePlayAgainClick = () => {
      sound.playClick();
      onPlayAgain?.();
    };

    const handleBackToHomeClick = () => {
      sound.playClick();
      if (onBackToHome) {
        onBackToHome();
      } else {
        onLeaveGame?.();
      }
    };

    const modeName = isGrammar
      ? "English Grammar"
      : isGK
      ? "General Knowledge"
      : "Math";

    return (
      <div className="screen results">
        <Confetti count={correct >= 3 ? 50 : 20} />

        <div className="results__inner">
          {/* Header */}
          <div className="results__header">
            <div className="results__header-top">
              <AudioToggle />
            </div>
            <h1 className="results__game-over">
              ⚡ MATCH COMPLETE
            </h1>
            <p className="results__subtitle">
              {modeName} • {diffLabel} · {rounds} / {rounds} Rounds
            </p>
          </div>

          {/* Main Score Hero Card */}
          <div className="results__winner-card results__hero-card">
            <span className="results__winner-trophy" aria-hidden="true">
              {correct === rounds ? "👑" : correct >= Math.ceil(rounds / 2) ? "⚡" : "⭐"}
            </span>

            <div className="results__winner-label">
              Solo Performance
            </div>

            <div className="results__winner-name">
              Score: <span className="results__score-highlight">{score}</span> / {rounds}
            </div>

            <div className="results__feedback-text">
              {correct === rounds
                ? "Flawless Performance! True Quiz Clash Champion! ⚡"
                : correct >= 4
                ? "Great effort! High accuracy on questions! 👏"
                : "Keep practicing to master all clash rounds! 💪"}
            </div>
          </div>

          {/* Detailed Stats Breakdown */}
          <div className="results__rewards-card">
            <div className="results__rewards-title">
              <span>📊</span>
              <span>Round Statistics</span>
            </div>

            <div className="results__rewards-list">
              <div className="results__rewards-row">
                <span className="results__stat-label">
                  <strong className="text-success">✓</strong> Correct Answers
                </span>
                <strong className="text-success">{correct}</strong>
              </div>

              <div className="results__rewards-row">
                <span className="results__stat-label">
                  <strong className="text-danger">✕</strong> Wrong Answers
                </span>
                <strong className="text-danger">{wrong}</strong>
              </div>

              <div className="results__rewards-row">
                <span className="results__stat-label">
                  <strong className="text-warning">⏰</strong> Timeouts
                </span>
                <strong className="text-warning">{timeouts}</strong>
              </div>

              <div className="results__rewards-row results__rewards-row--total">
                <span>Coins Earned ({correct} × 10):</span>
                <span className="results__coins-earned">
                  +{coinsEarned} 🪙
                </span>
              </div>

              <div className="results__rewards-row results__rewards-row--balance">
                <span>Total Account Coins:</span>
                <span className="results__total-coins">🪙 {totalCoins}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="results__actions results__actions--solo">
            <button
              type="button"
              className="btn btn--primary btn--lg btn--full"
              onClick={handlePlayAgainClick}
            >
              🔄 Play Again
            </button>

            <button
              type="button"
              className="btn btn--ghost btn--lg btn--full"
              onClick={handleBackToHomeClick}
            >
              🏠 Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Multiplayer Results View ─────────────────────────────────────────────
  const leaderboard =
    gameOverData?.leaderboard ||
    [...players]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ ...p, rank: i + 1 }));

  const winnerData = gameOverData?.winner || {
    isTie: false,
    winnerName: leaderboard[0]?.name ? `${leaderboard[0].name} Wins!` : "Winner",
    highestScore: leaderboard[0]?.score || 0,
  };

  const selfPlayer = leaderboard.find((p) => p.id === currentSocketId);
  const myReward = gameOverData?.rewards?.find((r) => r.id === currentSocketId) || {
    score: selfPlayer?.score || 0,
    roundRewards: (selfPlayer?.correctAnswers || 0) * 10,
    winnerBonus: (!winnerData.isTie && winnerData.highestScore > 0 && leaderboard[0]?.id === currentSocketId) ? 20 : 0,
    totalEarned: ((selfPlayer?.correctAnswers || 0) * 10) + ((!winnerData.isTie && winnerData.highestScore > 0 && leaderboard[0]?.id === currentSocketId) ? 20 : 0),
    currentBalance: selfPlayer?.coins || 0,
    isWinner: !winnerData.isTie && winnerData.highestScore > 0 && leaderboard[0]?.id === currentSocketId,
    isTie: winnerData.isTie,
  };

  const isSelfWinner = myReward.isWinner;
  const isTie = winnerData.isTie;

  function handleToggleRematchClick() {
    sound.playClick();
    onToggleRematchReady?.();
  }

  function handleStartRematchClick() {
    sound.playClick();
    onStartRematch?.();
  }

  function handleReturnToLobbyClick() {
    sound.playClick();
    onReturnToLobby?.();
  }

  function handleLeaveClick() {
    sound.playClick();
    onLeaveGame?.();
  }

  return (
    <div className="screen results">
      {/* Celebratory Confetti */}
      <Confetti count={50} />

      <div className="results__inner">
        {/* Header */}
        <div className="results__header">
          <div className="results__header-top">
            <AudioToggle />
          </div>
          <h1 className="results__game-over">
            ⚡ MATCH COMPLETE
          </h1>
          <p className="results__subtitle">
            {isGrammar ? "English Grammar" : isGK ? "General Knowledge" : "Math"} • {diffLabel} · {totalRounds} / {totalRounds} Rounds Complete
          </p>
        </div>

        {/* Winner / Tie Spotlight */}
        <div
          className={`results__winner-card ${
            winnerData.isTie ? "results__winner-card--tie" : ""
          }`}
        >
          <span className="results__winner-trophy" aria-hidden="true">
            {winnerData.isTie ? "🤝" : "🏆"}
          </span>
          <div className="results__winner-label">
            {winnerData.isTie ? "Match Result" : "Clash Champion"}
          </div>
          <div className="results__winner-name">{winnerData.winnerName}</div>
          <div className="results__winner-score">
            Top Score: <strong>{winnerData.highestScore} {winnerData.highestScore === 1 ? "point" : "points"}</strong>
          </div>
        </div>

        {/* Coin Reward Breakdown */}
        <div className="results__rewards-card">
          <div className="results__rewards-title">
            <span>🪙</span>
            <span>
              {isSelfWinner
                ? "🏆 YOU WON! Reward Summary"
                : isTie
                ? "🤝 MATCH TIE — Reward Summary"
                : "Match Reward Summary"}
            </span>
          </div>

          <div className="results__rewards-list">
            <div className="results__rewards-row">
              <span>Final Match Score:</span>
              <strong>{myReward.score} pts</strong>
            </div>

            <div className="results__rewards-row">
              <span>Round Rewards ({myReward.score} × 10):</span>
              <strong style={{ color: "var(--clr-accent)" }}>+{myReward.roundRewards} 🪙</strong>
            </div>

            <div className="results__rewards-row">
              <span>Winner Bonus:</span>
              <strong style={{ color: myReward.winnerBonus > 0 ? "var(--clr-accent)" : "var(--clr-text-muted)" }}>
                +{myReward.winnerBonus} 🪙
              </strong>
            </div>

            <div className="results__rewards-row results__rewards-row--total">
              <span>Total Earned This Match:</span>
              <span style={{ color: "var(--clr-accent)" }}>+{myReward.totalEarned} 🪙</span>
            </div>

            <div className="results__rewards-row results__rewards-row--balance">
              <span>Current Account Balance:</span>
              <span>🪙 {myReward.currentBalance} Coins</span>
            </div>
          </div>
        </div>

        {/* Final Leaderboard */}
        <div className="results__leaderboard-title">Leaderboard Standings</div>
        <div className="results__leaderboard">
          {leaderboard.map((player, i) => {
            const isSelf = currentSocketId && player.id === currentSocketId;
            const medal = RANK_MEDALS[player.rank - 1] || `#${player.rank || i + 1}`;
            const colorIdx = (player.playerNumber ? player.playerNumber - 1 : i) % AVATAR_COLORS.length;

            return (
              <div
                key={player.id || i}
                className={`results__leaderboard-item ${
                  isSelf ? "results__leaderboard-item--self" : ""
                }`}
              >
                <div className="results__lb-rank">{medal}</div>
                <div
                  className="results__lb-avatar"
                  style={{ background: AVATAR_COLORS[colorIdx] }}
                >
                  {player.name ? player.name.charAt(0).toUpperCase() : "?"}
                </div>

                <div className="results__lb-info">
                  <div className="results__lb-name">
                    {player.name}
                    {isSelf && <span className="results__lb-self-badge">(You)</span>}
                  </div>
                  <div className="results__lb-stats">
                    <span>✓ {player.correctAnswers || 0}</span>
                    <span>✗ {player.wrongAnswers || 0}</span>
                    <span>⏰ {player.timeouts || 0}</span>
                  </div>
                </div>

                <div className="results__lb-score-col">
                  <div className="results__lb-score">
                    {player.score} {player.score === 1 ? "pt" : "pts"}
                  </div>
                  {typeof player.coins === "number" && (
                    <div style={{ fontSize: "0.8rem", color: "var(--clr-accent)", fontWeight: 700 }}>
                      🪙 {player.coins}
                    </div>
                  )}
                  {player.rematchReady && (
                    <div className="results__lb-rematch-status">● Ready</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rematch and Action Controls */}
        <div className="results__actions">
          {/* Toggle Rematch Ready */}
          <button
            className={`btn btn--lg ${
              isSelfRematchReady ? "btn--ready" : "btn--primary"
            }`}
            onClick={handleToggleRematchClick}
          >
            {isSelfRematchReady ? "✓ Ready for Rematch" : "⚔️ Ready for Rematch"}
          </button>

          {/* Host Rematch Start Button */}
          {isHost && (
            <button
              className="btn btn--primary btn--lg"
              onClick={handleStartRematchClick}
              disabled={!allRematchReady}
              title={
                !allRematchReady
                  ? "Waiting for all players to click Rematch Ready"
                  : "Start fresh 6-round rematch"
              }
            >
              {allRematchReady ? "🚀 Start Rematch Now" : "⏳ Waiting for All Players..."}
            </button>
          )}

          {/* Return to Lobby (Host or Player) */}
          <button
            className="btn btn--secondary btn--lg"
            onClick={handleReturnToLobbyClick}
          >
            🔄 Return to Lobby
          </button>

          {/* Leave Match */}
          <button
            className="btn btn--ghost btn--lg"
            onClick={handleLeaveClick}
          >
            🏠 Return to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
