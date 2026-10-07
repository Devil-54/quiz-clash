import { useState, useEffect, useRef } from "react";
import { sound } from "../../utils/audio";
import "./CountdownOverlay.css";

export default function CountdownOverlay({ onComplete }) {
  const [count, setCount] = useState(3);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    sound.playTick(440);
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev === 3) {
          sound.playTick(550);
          return 2;
        }
        if (prev === 2) {
          sound.playTick(660);
          return 1;
        }
        if (prev === 1) {
          sound.playTick(880);
          return 0; // "GO!"
        }
        clearInterval(interval);
        setTimeout(() => {
          onCompleteRef.current?.();
        }, 400);
        return -1;
      });
    }, 700);

    return () => clearInterval(interval);
  }, []);

  if (count < 0) return null;

  return (
    <div className="countdown-overlay">
      <div className="countdown-overlay__content" key={count}>
        <div className="countdown-overlay__label">MATCH STARTING</div>
        <div className="countdown-overlay__number">
          {count === 0 ? "GO! 🚀" : count}
        </div>
      </div>
    </div>
  );
}
