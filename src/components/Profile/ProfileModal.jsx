import { sound } from "../../utils/audio";
import "./ProfileModal.css";

export default function ProfileModal({ user, onClose }) {
  if (!user) return null;

  const initial = user.name ? user.name.charAt(0).toUpperCase() : "👤";
  const coins = typeof user.coins === "number" ? user.coins : 0;
  const gamesPlayed = typeof user.gamesPlayed === "number" ? user.gamesPlayed : (user.stats?.matchesPlayed || 0);
  const gamesWon = typeof user.gamesWon === "number" ? user.gamesWon : (user.stats?.matchesWon || 0);
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  function handleClose() {
    sound.playClick();
    onClose();
  }

  return (
    <div className="profile-backdrop" onClick={handleClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal__header">
          <span className="profile-modal__tag">PLAYER PROFILE</span>
          <button
            type="button"
            className="profile-close-btn"
            onClick={handleClose}
            aria-label="Close Profile"
          >
            ✕
          </button>
        </div>

        <div className="profile-identity">
          <div className="profile-avatar-box">
            <span>{initial}</span>
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{user.name}</h2>
            <p className="profile-email">✉️ {user.email}</p>
          </div>
        </div>

        {/* Coin Balance Highlight */}
        <div className="profile-coin-card">
          <div className="profile-coin-left">
            <span className="profile-coin-icon">🪙</span>
            <div className="profile-coin-text">
              <span className="profile-coin-label">Virtual Coins Balance</span>
              <span className="profile-coin-val">{coins} Coins</span>
            </div>
          </div>
          <span className="badge badge--accent">+10/Round</span>
        </div>

        {/* 3 Gaming Stats Cards */}
        <div className="profile-stats-row">
          <div className="profile-stat-box">
            <span className="profile-stat-number">{gamesPlayed}</span>
            <span className="profile-stat-title">Games Played</span>
          </div>

          <div className="profile-stat-box">
            <span className="profile-stat-number" style={{ color: "var(--clr-success)" }}>
              {gamesWon}
            </span>
            <span className="profile-stat-title">Games Won</span>
          </div>

          <div className="profile-stat-box">
            <span className="profile-stat-number" style={{ color: "var(--clr-primary)" }}>
              {winRate}%
            </span>
            <span className="profile-stat-title">Win Rate</span>
          </div>
        </div>

        <div className="profile-footer-tip">
          <span>⚡ Answer fast & clash smartly to rank up your profile!</span>
        </div>
      </div>
    </div>
  );
}
