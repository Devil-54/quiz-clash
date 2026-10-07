import "./PlayerCard.css";

const AVATAR_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b"];

export default function PlayerCard({ player, slotIndex, currentSocketId }) {
  const isEmpty = !player;
  const playerNumber = slotIndex + 1;

  if (isEmpty) {
    return (
      <div className="player-card player-card--empty">
        <div className="player-card__avatar">···</div>
        <div className="player-card__info">
          <div className="player-card__name">Waiting for player...</div>
          <div className="player-card__slot">Open Slot {playerNumber}</div>
        </div>
        <div className="player-card__status">
          <span className="player-card__status-text player-card__status-text--waiting">
            Empty
          </span>
        </div>
      </div>
    );
  }

  const isReady = player.isReady;
  const isSelf = currentSocketId && player.id === currentSocketId;
  const isHost = player.isHost;

  return (
    <div
      className={`player-card ${isReady ? "player-card--ready" : ""} ${
        isSelf ? "player-card--current" : ""
      }`}
    >
      <div
        className="player-card__avatar"
        style={{
          background:
            AVATAR_COLORS[(player.playerNumber - 1) % AVATAR_COLORS.length] ||
            AVATAR_COLORS[slotIndex % AVATAR_COLORS.length],
        }}
      >
        {player.name ? player.name.charAt(0).toUpperCase() : "?"}
      </div>

      <div className="player-card__info">
        <div className="player-card__name-row">
          <span className="player-card__name">{player.name}</span>
          {isHost && <span className="player-card__tag player-card__tag--host">HOST</span>}
          {isSelf && <span className="player-card__tag player-card__tag--you">YOU</span>}
        </div>
        <div className="player-card__slot">
          <span>Player {player.playerNumber || playerNumber}</span>
          {typeof player.coins === "number" && (
            <span className="player-card__coins">
              🪙 {player.coins}
            </span>
          )}
        </div>
      </div>

      <div className="player-card__status">
        <span
          className={`player-card__status-text ${
            isReady ? "player-card__status-text--ready" : "player-card__status-text--waiting"
          }`}
        >
          {isReady ? "● READY" : "○ WAITING"}
        </span>
      </div>
    </div>
  );
}
