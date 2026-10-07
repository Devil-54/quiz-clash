import { useState } from "react";
import { sound } from "../../utils/audio";
import "./AudioToggle.css";

export default function AudioToggle() {
  const [muted, setMuted] = useState(() => sound.isMuted());

  const handleToggle = () => {
    const nextMuted = sound.toggleMute();
    setMuted(nextMuted);
    if (!nextMuted) {
      sound.playClick();
    }
  };

  return (
    <button
      className={`audio-toggle ${muted ? "audio-toggle--muted" : ""}`}
      onClick={handleToggle}
      title={muted ? "Unmute Sound Effects" : "Mute Sound Effects"}
      aria-label={muted ? "Unmute Sound Effects" : "Mute Sound Effects"}
    >
      {muted ? "🔇" : "🔊"}
      <span className="audio-toggle__label">{muted ? "Muted" : "Sound"}</span>
    </button>
  );
}
