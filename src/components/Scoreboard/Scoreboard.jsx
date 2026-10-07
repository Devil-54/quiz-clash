import { useEffect, useRef, useState } from "react";
import "./Scoreboard.css";

const AVATAR_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b"];
const RANK_MEDALS   = ["🥇", "🥈", "🥉", "4th"];

function computeRankedPlayers(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  let rank = 1;
  return sorted.map((player, idx) => {
    if (idx > 0 && player.score < sorted[idx - 1].score) {
      rank = idx + 1;
    }
    return { ...player, rank };
  });
}

export default function Scoreboard({ players = [], currentSocketId, compact = false }) {
  const prevScoresRef = useRef({});
  const [pointAnimPlayers, setPointAnimPlayers] = useState({});

  const ranked = computeRankedPlayers(players);

  // Detect score changes to trigger +1 animation
  useEffect(() => {
    const updatedAnims = {};
    players.forEach((p) => {
      const prev = prevScoresRef.current[p.id];
      if (prev !== undefined && p.score > prev) {
        updatedAnims[p.id] = true;
      }
      prevScoresRef.current[p.id] = p.score;
    });

    if (Object.keys(updatedAnims).length > 0) {
      const timer = setTimeout(() => {
        setPointAnimPlayers({});
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [players]);

  return (
    <div className={`scoreboard ${compact ? "scoreboard--compact" : ""}`}>
      <div className="scoreboard__header">
        <span>LIVE SCOREBOARD</span>
        <span className="scoreboard__count">👥 {players.length} Players</span>
      </div>
      <ul className="scoreboard__list">
        {ranked.map((player, i) => {
          const isSelf = currentSocketId && player.id === currentSocketId;
          const colorIdx = (player.playerNumber ? player.playerNumber - 1 : i) % AVATAR_COLORS.length;
          const hasScoreGain = pointAnimPlayers[player.id];
          const medal = RANK_MEDALS[player.rank - 1] ?? `#${player.rank}`;

          return (
            <li
              key={player.id || i}
              className={`scoreboard__item ${isSelf ? "scoreboard__item--self" : ""} ${
                hasScoreGain ? "scoreboard__item--scored" : ""
              }`}
            >
              <span className={`scoreboard__rank scoreboard__rank--${player.rank}`}>
                {medal}
              </span>
              <div
                className="scoreboard__avatar"
                style={{ background: AVATAR_COLORS[colorIdx] }}
              >
                {player.name ? player.name.charAt(0).toUpperCase() : "?"}
              </div>
              <span className="scoreboard__name">
                {player.name}
                {isSelf && <strong className="scoreboard__self-badge">(You)</strong>}
              </span>
              <div className="scoreboard__score-wrapper">
                <span className="scoreboard__score">
                  {player.score} {player.score === 1 ? "pt" : "pts"}
                </span>
                {typeof player.coins === "number" && (
                  <span className="scoreboard__coins">
                    🪙 {player.coins}
                  </span>
                )}
                {hasScoreGain && (
                  <span className="scoreboard__score-pop">+1 pt & +10 🪙</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
