import { useState } from "react";
import "./Confetti.css";

const CONFETTI_COLORS = ["#e94560", "#f5a623", "#27ae60", "#3498db", "#9b59b6", "#f1c40f", "#e67e22"];

export default function Confetti({ count = 45 }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 2}s`,
      animationDuration: `${2.5 + Math.random() * 2.5}s`,
      backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: `${6 + Math.random() * 8}px`,
      shape: Math.random() > 0.5 ? "circle" : "rect",
      rotate: `${Math.random() * 360}deg`,
    }))
  );

  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className={`confetti-piece confetti-piece--${p.shape}`}
          style={{
            left: p.left,
            width: p.size,
            height: p.shape === "circle" ? p.size : `${parseFloat(p.size) * 1.6}px`,
            backgroundColor: p.backgroundColor,
            animationDelay: p.animationDelay,
            animationDuration: p.animationDuration,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
    </div>
  );
}
