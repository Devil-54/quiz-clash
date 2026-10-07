import { useState, useEffect, useRef } from "react";
import Question from "../Question/Question";
import AnswerOptions from "../AnswerOptions/AnswerOptions";
import Scoreboard from "../Scoreboard/Scoreboard";
import AudioToggle from "../AudioToggle/AudioToggle";
import CountdownOverlay from "../CountdownOverlay/CountdownOverlay";
import { sound } from "../../utils/audio";
import { TOTAL_ROUNDS } from "../../data/mockData";
import "./Game.css";

export default function Game({
  gameMode = "single",
  mode = "math",
  difficulty = "medium",
  user,
  players = [],
  currentSocketId,
  currentQuestion,
  roundNumber = 1,
  selectedAnswer,
  answerResult,
  roundResult,
  roundOver,
  timeRemaining = 10,
  currentScore = 0,
  singlePlayerStats = {},
  onSubmitAnswer,
  onLeaveGame,
}) {
  const [showCountdown, setShowCountdown] = useState(() => roundNumber === 1);
  const prevTimeRef = useRef(timeRemaining);
  const prevRoundRef = useRef(roundNumber);

  // Trigger match start countdown for round 1
  useEffect(() => {
    if (roundNumber === 1 && prevRoundRef.current !== 1) {
      setShowCountdown(true);
    }
    prevRoundRef.current = roundNumber;
  }, [roundNumber]);

  // Audio trigger for timer warning at <= 3s
  useEffect(() => {
    if (
      timeRemaining <= 3 &&
      timeRemaining > 0 &&
      timeRemaining !== prevTimeRef.current &&
      !roundOver &&
      selectedAnswer === null
    ) {
      sound.playWarning();
    }
    prevTimeRef.current = timeRemaining;
  }, [timeRemaining, roundOver, selectedAnswer]);

  // Audio trigger for answer result
  useEffect(() => {
    if (answerResult) {
      if (answerResult.isCorrect) {
        sound.playCorrect();
      } else {
        sound.playWrong();
      }
    }
  }, [answerResult]);

  const isGK = mode === "gk" || currentQuestion?.mode === "gk";
  const isGrammar = mode === "grammar" || currentQuestion?.mode === "grammar";
  const formattedTime = String(Math.max(0, timeRemaining)).padStart(2, "0");
  const revealedCorrect = roundResult?.correctAnswer;
  const isSingle = gameMode === "single";

  const timerPercent = Math.max(0, Math.min(100, (timeRemaining / 10) * 100));
  const isTimeCritical = timeRemaining <= 3 && timeRemaining > 0;

  const currentDiff = String(currentQuestion?.difficulty || difficulty || "medium").toUpperCase();
  const modeName = isGrammar ? "ENGLISH GRAMMAR" : isGK ? "GK" : "MATH";
  const modeBadgeText = `${modeName} • ${currentDiff}`;

  const modeBadgeClass = isGrammar
    ? "game__mode-badge--grammar"
    : isGK
    ? "game__mode-badge--gk"
    : "game__mode-badge--math";

  const totalUserCoins = isSingle
    ? (singlePlayerStats.totalCoins ?? user?.coins ?? 0)
    : (user?.coins ?? 0);

  return (
    <div className="game">
      {/* ── Match Start 3-2-1 Countdown Overlay ── */}
      {showCountdown && (
        <CountdownOverlay onComplete={() => setShowCountdown(false)} />
      )}

      {/* ── Top Bar ── */}
      <header className="game__topbar">
        <div className="game__brand-group">
          <span className="game__brand-icon">⚡</span>
          <div className="game__title">
            QUIZ <span className="accent">CLASH</span>
          </div>
          <span className={`game__mode-badge ${modeBadgeClass}`}>
            {modeBadgeText}
          </span>
        </div>

        <div className="game__topbar-right">
          <div className="game__coin-pill" title="Current Coins Balance">
            <span>🪙</span>
            <span>{totalUserCoins}</span>
          </div>

          <AudioToggle />

          {onLeaveGame && (
            <button
              className="btn btn--ghost btn--sm game__leave-btn"
              onClick={() => {
                sound.playClick();
                onLeaveGame();
              }}
              title="Leave Match"
            >
              Exit
            </button>
          )}
        </div>
      </header>

      {/* ── Match HUD Bar (Round & Timer) ── */}
      <div className="game__hud">
        <div className="game__hud-inner">
          <div className="game__round-info">
            <span className="game__round-label">ROUND</span>
            <span className="game__round-count">
              <strong>{roundNumber}</strong> / {TOTAL_ROUNDS}
            </span>
          </div>

          {/* Linear Timer Bar */}
          <div className="game__timer-wrapper">
            <div className="game__timer-bar-track">
              <div
                className={`game__timer-bar-fill ${isTimeCritical ? "game__timer-bar-fill--danger" : ""}`}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
          </div>

          {/* Digital Timer */}
          <div className={`game__digital-timer ${isTimeCritical ? "game__digital-timer--danger" : ""}`}>
            <span className="game__timer-icon">⏱</span>
            <span>{formattedTime}s</span>
          </div>
        </div>
      </div>

      {/* ── Main Battle Layout ── */}
      <main className="game__layout">
        {/* Left / Center: Question & Answer Area */}
        <section className="game__main">
          {/* Question Card */}
          <div className="game__question-box">
            <Question question={currentQuestion} mode={mode} />
          </div>

          {/* Answer Options */}
          <div className="game__answers-box">
            <AnswerOptions
              options={currentQuestion?.options ?? []}
              correct={revealedCorrect}
              selectedAnswer={selectedAnswer}
              roundOver={roundOver}
              onSelect={onSubmitAnswer}
            />
          </div>

          {/* Immediate Individual Answer Feedback */}
          {answerResult && !roundResult && (
            <div
              className={`game__feedback-pill ${
                answerResult.isCorrect
                  ? "game__feedback-pill--correct"
                  : "game__feedback-pill--wrong"
              }`}
            >
              <span>{answerResult.isCorrect ? "✓" : "✕"}</span>
              <span>{answerResult.message}</span>
            </div>
          )}

          {/* Round Outcome Banner */}
          {roundResult && (
            <div
              className={`game__round-result-card ${
                roundResult.status === "won"
                  ? "game__round-result-card--won"
                  : "game__round-result-card--timeout"
              }`}
            >
              <div className="game__round-result-msg">
                {roundResult.status === "won" ? "⚡ " : "⏰ "}
                {roundResult.message}
              </div>
              {revealedCorrect !== undefined && (
                <div className="game__round-result-ans">
                  Correct answer was: <strong>{revealedCorrect}</strong>
                </div>
              )}
            </div>
          )}

          {/* Transition indicator */}
          {roundOver && (
            <div className="game__transition-hint">
              <span>Next round in 2s...</span>
            </div>
          )}
        </section>

        {/* Right Sidebar: Scoreboard & Stats */}
        <aside className="game__sidebar">
          {isSingle ? (
            <div className="card game__solo-card">
              <div className="game__sidebar-header">
                <span className="game__sidebar-title">SOLO SCOREBOARD</span>
                <span className="game__sidebar-tag">1 Player</span>
              </div>

              <div className="game__solo-player">
                <div className="game__solo-avatar">
                  {user?.name ? user.name.charAt(0).toUpperCase() : "👤"}
                </div>
                <div className="game__solo-name-box">
                  <div className="game__solo-name">{user?.name || "Player"} (You)</div>
                  <div className="game__solo-mode">
                    {isGrammar ? "English Grammar" : isGK ? "General Knowledge" : "Mental Math"}
                  </div>
                </div>
              </div>

              <div className="game__solo-score-box">
                <div className="game__solo-score-row">
                  <span>Current Points:</span>
                  <strong>{currentScore} pts</strong>
                </div>
                <div className="game__solo-score-row">
                  <span>Coins Earned:</span>
                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                    +{singlePlayerStats.coinsEarned ?? (currentScore * 10)} 🪙
                  </span>
                </div>
              </div>

              <div className="game__sidebar-tip">
                <span>+10 🪙 per correct answer</span>
              </div>
            </div>
          ) : (
            <Scoreboard
              players={players}
              currentSocketId={currentSocketId}
            />
          )}
        </aside>
      </main>
    </div>
  );
}
