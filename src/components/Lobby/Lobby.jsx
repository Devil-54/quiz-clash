import { useState } from "react";
import PlayerCard from "../PlayerCard/PlayerCard";
import AudioToggle from "../AudioToggle/AudioToggle";
import { sound } from "../../utils/audio";
import "./Lobby.css";

export default function Lobby({
  mode = "math",
  difficulty = "medium",
  roomCode,
  playerSlots = [],
  isHost = false,
  currentSocketId,
  isSelfReady = false,
  onToggleReady,
  onStartGame,
  onLeaveGame,
  error,
}) {
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const filledPlayers = playerSlots.filter(Boolean);
  const readyCount = filledPlayers.filter((p) => p.isReady).length;
  const allReady = filledPlayers.length >= 2 && filledPlayers.every((p) => p.isReady);
  const canStart = isHost && filledPlayers.length >= 2 && filledPlayers.length <= 4 && allReady;

  function handleCopyCode() {
    sound.playClick();
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleToggleReadyClick() {
    sound.playClick();
    onToggleReady?.();
  }

  function handleStartClick() {
    sound.playClick();
    if (!canStart || isStarting) return;
    setIsStarting(true);
    onStartGame?.(() => {
      setIsStarting(false);
    });
  }

  function handleLeaveClick() {
    sound.playClick();
    onLeaveGame?.();
  }

  const isGK = mode === "gk";
  const isGrammar = mode === "grammar";
  const modeLabel = isGrammar ? "📚 English Grammar" : isGK ? "🌍 General Knowledge" : "🧮 Math Battle";
  const modeBadgeClass = isGrammar ? "badge--grammar" : isGK ? "badge--gk" : "badge--math";
  const normDiff = String(difficulty || "medium").toLowerCase();
  const diffLabel = normDiff === "easy" ? "🟢 Easy" : normDiff === "hard" ? "🔴 Hard" : "🟡 Medium";
  const startButtonLabel = isStarting
    ? "Starting Match..."
    : `🚀 Start ${isGrammar ? "Grammar" : isGK ? "GK" : "Math"} Clash`;

  return (
    <div className="screen lobby">
      <div className="container container--sm">
        <div className="card lobby__card">
          {/* Header */}
          <div className="lobby__header">
            <button
              className="lobby__back"
              onClick={handleLeaveClick}
              aria-label="Leave Room"
              title="Leave Room"
            >
              ←
            </button>

            <div className="lobby__header-brand">
              <span className="lobby__brand-icon">⚡</span>
              <h2 className="lobby__title">
                QUIZ <span>CLASH</span>
              </h2>
            </div>

            <div className="lobby__header-controls">
              <AudioToggle />
              <button
                className="btn btn--ghost btn--sm lobby__leave-btn"
                onClick={handleLeaveClick}
              >
                Leave
              </button>
            </div>
          </div>

          {error && <div className="lobby__error" role="alert">⚠️ {error}</div>}

          {/* Room Code Card */}
          <div className="lobby__room-banner">
            <div className="lobby__room-header">
              <span className="lobby__room-label">ROOM CODE</span>
              <span className="lobby__room-sub">Share with friends to join</span>
            </div>

            <div className="lobby__room-code-box">
              <span className="lobby__room-code">{roomCode}</span>
              <button
                className="lobby__copy-btn"
                onClick={handleCopyCode}
                title="Copy Room Code"
              >
                {copied ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>
          </div>

          {/* Game Info Chips */}
          <div className="lobby__info-row">
            <span className={`lobby__info-chip ${modeBadgeClass}`}>{modeLabel}</span>
            <span className="lobby__info-chip" style={{ fontWeight: 800 }}>{diffLabel}</span>
            <span className="lobby__info-chip">⚔️ 6 Rounds</span>
            <span className="lobby__info-chip">⏱ 10s Timer</span>
            <span className="lobby__info-chip" style={{ color: "#fbbf24" }}>🪙 +10/Round</span>
          </div>

          <div className="divider" />

          {/* Players Roster Section */}
          <div className="lobby__roster-header">
            <span className="lobby__section-title">Connected Players</span>
            <span className="lobby__player-count">
              <strong>{filledPlayers.length}</strong>/4 Joined ·{" "}
              <strong style={{ color: "var(--clr-success)" }}>{readyCount}</strong> Ready
            </span>
          </div>

          <div className="lobby__players">
            {playerSlots.map((player, i) => (
              <PlayerCard
                key={player ? player.id : `empty-${i}`}
                player={player}
                slotIndex={i}
                currentSocketId={currentSocketId}
              />
            ))}
          </div>

          {/* Action Controls */}
          <div className="lobby__actions">
            {/* Toggle Ready button */}
            <button
              className={`btn ${isSelfReady ? "btn--secondary" : "btn--primary"} lobby__ready-btn`}
              onClick={handleToggleReadyClick}
            >
              {isSelfReady ? "⏸ Cancel Ready (Wait)" : "✅ Click when Ready"}
            </button>

            {/* Host Start button vs Non-Host waiting message */}
            {isHost ? (
              <>
                <button
                  className="btn btn--primary btn--lg btn--full lobby__start-btn"
                  onClick={handleStartClick}
                  disabled={!canStart || isStarting}
                >
                  {startButtonLabel}
                </button>

                {!canStart && (
                  <p className="lobby__start-note">
                    {filledPlayers.length < 2
                      ? `Waiting for at least 1 more player to join (Code: ${roomCode}).`
                      : "Waiting for all players to click Ready."}
                  </p>
                )}
              </>
            ) : (
              <div className="lobby__waiting-banner">
                ⏳ Waiting for room host to launch the match...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
