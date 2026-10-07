import { useEffect } from "react";
import { sound } from "../../utils/audio";
import "./AnswerOptions.css";

const OPTION_LABELS = ["1", "2", "3", "4"];

export default function AnswerOptions({
  options = [],
  correct,
  selectedAnswer,
  roundOver,
  onSelect,
}) {
  const isLocked = roundOver || selectedAnswer !== null;

  // Keyboard shortcut listener for 1, 2, 3, 4 keys
  useEffect(() => {
    function handleKeyDown(e) {
      if (isLocked) return;
      const keyIndex = parseInt(e.key, 10) - 1;
      if (keyIndex >= 0 && keyIndex < options.length) {
        handleOptionClick(options[keyIndex]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLocked, options, onSelect]);

  function handleOptionClick(option) {
    if (isLocked) return;
    sound.playClick();
    onSelect(option);
  }

  function getButtonClass(option) {
    if (!isLocked) return "answer-btn";

    // Reveal correct answer in green when available
    if (correct !== undefined && correct !== null && String(option).toLowerCase() === String(correct).toLowerCase()) {
      return "answer-btn answer-btn--correct";
    }

    // Selected wrong answer in red
    if (
      String(option).toLowerCase() === String(selectedAnswer).toLowerCase() &&
      correct !== undefined &&
      correct !== null &&
      String(option).toLowerCase() !== String(correct).toLowerCase()
    ) {
      return "answer-btn answer-btn--wrong";
    }

    // Just selected while waiting for round resolution
    if (String(option).toLowerCase() === String(selectedAnswer).toLowerCase()) {
      return "answer-btn answer-btn--selected";
    }

    return "answer-btn answer-btn--dim";
  }

  return (
    <div className="answer-section">
      <div className="answer-options">
        {options.map((option, i) => {
          const isText = typeof option === "string" && isNaN(Number(option));
          return (
            <button
              key={i}
              className={getButtonClass(option)}
              onClick={() => handleOptionClick(option)}
              disabled={isLocked}
              aria-label={`Option ${OPTION_LABELS[i]}: ${option}`}
            >
              <span className="answer-btn__key-hint">{OPTION_LABELS[i]}</span>
              <span
                className={`answer-btn__value ${
                  isText ? "answer-btn__value--text" : ""
                }`}
              >
                {option}
              </span>
            </button>
          );
        })}
      </div>

      {selectedAnswer !== null && !roundOver && (
        <div className="answer-section__locked-hint">
          ✓ Answer <strong>{selectedAnswer}</strong> locked in. Waiting for round result...
        </div>
      )}
    </div>
  );
}
