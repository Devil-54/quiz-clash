import { useState } from "react";
import AudioToggle from "../AudioToggle/AudioToggle";
import ProfileModal from "../Profile/ProfileModal";
import { sound } from "../../utils/audio";
import "./Home.css";

export default function Home({
  user,
  playerName,
  difficulty = "medium",
  onDifficultyChange,
  onNameChange,
  onStartSinglePlayer,
  onCreateGame,
  onJoinGame,
  onLogout,
  error,
  clearError,
}) {
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulty || "medium");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [inputRoomCode, setInputRoomCode] = useState("");
  const [joinName, setJoinName] = useState(user?.name || playerName || "");
  const [submittingAction, setSubmittingAction] = useState(null); // null | "single-math" | "single-gk" | "single-grammar" | "multi-math" | "multi-gk" | "multi-grammar" | "join"

  const userCoins = typeof user?.coins === "number" ? user.coins : 0;
  const displayName = user?.name || playerName || "Player";

  function handleDifficultySelect(diff) {
    sound.playClick();
    setSelectedDifficulty(diff);
    onDifficultyChange?.(diff);
  }

  function handleSinglePlayerClick(mode) {
    sound.playClick();
    clearError?.();
    setSubmittingAction(`single-${mode}`);
    onStartSinglePlayer?.(mode, selectedDifficulty, () => {
      setSubmittingAction(null);
    });
  }

  function handleMultiplayerCreateClick(mode) {
    sound.playClick();
    clearError?.();
    setSubmittingAction(`multi-${mode}`);
    onCreateGame?.(displayName, mode, selectedDifficulty, () => {
      setSubmittingAction(null);
    });
  }

  function handleOpenJoinModal() {
    sound.playClick();
    clearError?.();
    setJoinName(displayName);
    setShowJoinModal(true);
  }

  function handleCloseJoinModal() {
    sound.playClick();
    clearError?.();
    setShowJoinModal(false);
  }

  function handleJoinSubmit(e) {
    e.preventDefault();
    sound.playClick();
    clearError?.();
    if (!inputRoomCode.trim()) return;

    setSubmittingAction("join");
    onJoinGame?.(inputRoomCode.trim().toUpperCase(), joinName || displayName, () => {
      setSubmittingAction(null);
    });
  }

  const isBusy = submittingAction !== null;

  return (
    <div className="screen home">
      {/* ── Top Navigation Bar ── */}
      <header className="home__navbar">
        <div className="home__navbar-brand">
          <span className="home__navbar-icon">⚡</span>
          <span className="home__navbar-logo">QUIZ <span className="accent">CLASH</span></span>
        </div>

        {user ? (
          <div className="home__user-nav">
            <div className="home__user-badge">
              <span className="home__user-avatar">
                {user.name ? user.name.charAt(0).toUpperCase() : "👤"}
              </span>
              <span className="home__user-name">{user.name}</span>
            </div>

            <div className="home__user-coins" title="Your Total Coins Balance">
              <span>🪙</span>
              <span>{userCoins}</span>
            </div>

            <button
              type="button"
              className="home__nav-btn"
              onClick={() => {
                sound.playClick();
                setShowProfileModal(true);
              }}
              title="View Player Profile"
            >
              👤 Profile
            </button>

            <button
              type="button"
              className="home__nav-btn home__nav-btn--logout"
              onClick={() => {
                sound.playClick();
                onLogout?.();
              }}
              title="Log out"
            >
              🚪 Logout
            </button>

            <AudioToggle />
          </div>
        ) : (
          <div className="home__user-nav">
            <AudioToggle />
          </div>
        )}
      </header>

      {/* ── Main Content Container ── */}
      <main className="home__main">
        {/* Hero Section */}
        <section className="home__hero">
          <div className="home__hero-tag">
            <span>⚡ THINK FAST. CLASH SMARTER.</span>
          </div>

          <h1 className="home__title">
            Choose Your <span className="accent">Challenge</span>
          </h1>

          <p className="home__subtitle">
            Battle through 6 fast-paced 10-second rounds. Play solo to beat your score or challenge players in real-time.
          </p>
        </section>

        {/* Global Error Banner */}
        {error && !showJoinModal && (
          <div className="home__error-banner" role="alert">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* ── Choose Difficulty Section ── */}
        <section className="home__difficulty-section">
          <div className="home__difficulty-label">CHOOSE DIFFICULTY</div>
          <div className="home__difficulty-grid">
            <button
              type="button"
              className={`home__difficulty-card home__difficulty-card--easy ${
                selectedDifficulty === "easy" ? "home__difficulty-card--active" : ""
              }`}
              onClick={() => handleDifficultySelect("easy")}
              disabled={isBusy}
            >
              <span className="home__difficulty-icon">🟢</span>
              <span className="home__difficulty-name">EASY</span>
              <span className="home__difficulty-sub">Warm up</span>
            </button>

            <button
              type="button"
              className={`home__difficulty-card home__difficulty-card--medium ${
                selectedDifficulty === "medium" ? "home__difficulty-card--active" : ""
              }`}
              onClick={() => handleDifficultySelect("medium")}
              disabled={isBusy}
            >
              <span className="home__difficulty-icon">🟡</span>
              <span className="home__difficulty-name">MEDIUM</span>
              <span className="home__difficulty-sub">Test yourself</span>
            </button>

            <button
              type="button"
              className={`home__difficulty-card home__difficulty-card--hard ${
                selectedDifficulty === "hard" ? "home__difficulty-card--active" : ""
              }`}
              onClick={() => handleDifficultySelect("hard")}
              disabled={isBusy}
            >
              <span className="home__difficulty-icon">🔴</span>
              <span className="home__difficulty-name">HARD</span>
              <span className="home__difficulty-sub">Challenge</span>
            </button>
          </div>
        </section>

        {/* ── 3 Mode Selection Cards ── */}
        <div className="home__modes-grid">
          {/* 🧮 MATH CARD */}
          <div className="home__mode-card home__mode-card--math">
            <div className="home__mode-header">
              <div className="home__mode-icon-box">
                <span className="home__mode-icon">🧮</span>
              </div>
              <div className="home__mode-info">
                <h3 className="home__mode-title">MATH</h3>
                <p className="home__mode-desc">Numbers. Speed. Arithmetic.</p>
              </div>
              <div className={`home__mode-diff-tag home__mode-diff-tag--${selectedDifficulty}`}>
                {selectedDifficulty === "easy" ? "🟢 Easy" : selectedDifficulty === "hard" ? "🔴 Hard" : "🟡 Medium"}
              </div>
            </div>

            <p className="home__mode-detail">
              {selectedDifficulty === "easy"
                ? "Simple arithmetic with whole numbers (+, -, ×, ÷)."
                : selectedDifficulty === "hard"
                ? "Percentages, difference of squares & multi-step calculations."
                : "2-digit multiplication, 3-digit division & mixed arithmetic."}
            </p>

            <div className="home__mode-actions">
              <button
                type="button"
                className="btn btn--secondary btn--md home__btn-choice"
                onClick={() => handleSinglePlayerClick("math")}
                disabled={isBusy}
              >
                <span>👤</span> Single Player
              </button>

              <button
                type="button"
                className="btn btn--primary btn--md home__btn-choice home__btn-choice--math"
                onClick={() => handleMultiplayerCreateClick("math")}
                disabled={isBusy}
              >
                <span>👥</span> Multiplayer
              </button>
            </div>
          </div>

          {/* 🌍 GK CARD */}
          <div className="home__mode-card home__mode-card--gk">
            <div className="home__mode-header">
              <div className="home__mode-icon-box">
                <span className="home__mode-icon">🌍</span>
              </div>
              <div className="home__mode-info">
                <h3 className="home__mode-title">GENERAL KNOWLEDGE</h3>
                <p className="home__mode-desc">World, Science & History Trivia</p>
              </div>
              <div className={`home__mode-diff-tag home__mode-diff-tag--${selectedDifficulty}`}>
                {selectedDifficulty === "easy" ? "🟢 Easy" : selectedDifficulty === "hard" ? "🔴 Hard" : "🟡 Medium"}
              </div>
            </div>

            <p className="home__mode-detail">
              {selectedDifficulty === "easy"
                ? "Common landmarks, capitals, animals & foundational facts."
                : selectedDifficulty === "hard"
                ? "Advanced geography, scientific laws, history & niche world trivia."
                : "Indian history, geography, tech milestones, science & sports."}
            </p>

            <div className="home__mode-actions">
              <button
                type="button"
                className="btn btn--secondary btn--md home__btn-choice"
                onClick={() => handleSinglePlayerClick("gk")}
                disabled={isBusy}
              >
                <span>👤</span> Single Player
              </button>

              <button
                type="button"
                className="btn btn--primary btn--md home__btn-choice home__btn-choice--gk"
                onClick={() => handleMultiplayerCreateClick("gk")}
                disabled={isBusy}
              >
                <span>👥</span> Multiplayer
              </button>
            </div>
          </div>

          {/* 📚 GRAMMAR CARD */}
          <div className="home__mode-card home__mode-card--grammar">
            <div className="home__mode-header">
              <div className="home__mode-icon-box">
                <span className="home__mode-icon">📚</span>
              </div>
              <div className="home__mode-info">
                <h3 className="home__mode-title">ENGLISH GRAMMAR</h3>
                <p className="home__mode-desc">Tenses, Voice, Speech & Rules</p>
              </div>
              <div className={`home__mode-diff-tag home__mode-diff-tag--${selectedDifficulty}`}>
                {selectedDifficulty === "easy" ? "🟢 Easy" : selectedDifficulty === "hard" ? "🔴 Hard" : "🟡 Medium"}
              </div>
            </div>

            <p className="home__mode-detail">
              {selectedDifficulty === "easy"
                ? "Basic articles, pronouns, simple prepositions & basic tenses."
                : selectedDifficulty === "hard"
                ? "Subjunctive mood, advanced conditionals, reported speech & idioms."
                : "Active/passive voice, mixed tenses, conjunctions & modals."}
            </p>

            <div className="home__mode-actions">
              <button
                type="button"
                className="btn btn--secondary btn--md home__btn-choice"
                onClick={() => handleSinglePlayerClick("grammar")}
                disabled={isBusy}
              >
                <span>👤</span> Single Player
              </button>

              <button
                type="button"
                className="btn btn--primary btn--md home__btn-choice home__btn-choice--grammar"
                onClick={() => handleMultiplayerCreateClick("grammar")}
                disabled={isBusy}
              >
                <span>👥</span> Multiplayer
              </button>
            </div>
          </div>
        </div>

        {/* ── Join Game Room Action ── */}
        <div className="home__join-bar">
          <button
            type="button"
            className="btn btn--ghost btn--md home__btn-join-room"
            onClick={handleOpenJoinModal}
            disabled={isBusy}
          >
            <span>🔗</span> Have a room code? <strong>Join Friend&apos;s Room</strong>
          </button>
        </div>

        <footer className="home__footer">
          <span>Quiz Clash · Real-Time Speed Quiz Battles</span>
        </footer>
      </main>

      {/* ── Join Room Modal ── */}
      {showJoinModal && (
        <div className="home__modal-backdrop" onClick={handleCloseJoinModal}>
          <div className="home__modal" onClick={(e) => e.stopPropagation()}>
            <div className="home__modal-header">
              <h2 className="home__modal-title">
                Join <span>Battle Room</span>
              </h2>
              <button
                type="button"
                className="home__modal-close-btn"
                onClick={handleCloseJoinModal}
              >
                ✕
              </button>
            </div>

            <p className="home__modal-subtitle">
              Enter the 6-character room code from your host.
            </p>

            {error && (
              <div className="home__error-banner" style={{ marginBottom: 14 }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleJoinSubmit}>
              <div className="home__modal-fields">
                <div className="home__form-group">
                  <label htmlFor="join-room-code" className="home__form-label">
                    Room Code
                  </label>
                  <input
                    id="join-room-code"
                    type="text"
                    className="home__input home__input--code"
                    placeholder="e.g. AB7K2M"
                    value={inputRoomCode}
                    onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    autoFocus
                    required
                  />
                </div>

                <div className="home__form-group">
                  <label htmlFor="join-player-name" className="home__form-label">
                    Player Name
                  </label>
                  <input
                    id="join-player-name"
                    type="text"
                    className="home__input"
                    value={joinName}
                    onChange={(e) => {
                      setJoinName(e.target.value);
                      onNameChange(e.target.value);
                    }}
                    maxLength={20}
                    required
                  />
                </div>
              </div>

              <div className="home__modal-actions">
                <button
                  type="submit"
                  className="btn btn--primary btn--full"
                  disabled={submittingAction === "join" || !inputRoomCode.trim()}
                >
                  {submittingAction === "join" ? "Joining Room..." : "⚡ Enter Room"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--full"
                  onClick={handleCloseJoinModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Player Profile Modal ── */}
      {showProfileModal && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
