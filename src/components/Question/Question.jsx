import "./Question.css";

export default function Question({ question, mode = "math" }) {
  if (!question) return null;

  const isGK = mode === "gk" || question.mode === "gk" || question.id?.startsWith("gk-");
  const isGrammar = mode === "grammar" || question.mode === "grammar" || question.id?.startsWith("grammar-");
  const qText = question.text || "";

  // Identify operation or category for badge
  let opBadge = "🧮 Math";
  let opClass = "question__op-badge";

  if (isGrammar) {
    opBadge = question.category || "📚 English Grammar";
    opClass = "question__op-badge question__op-badge--grammar";
  } else if (isGK) {
    opBadge = question.category || "🌍 General Knowledge";
    opClass = "question__op-badge question__op-badge--gk";
  } else if (qText.includes("+")) {
    opBadge = "➕ Addition";
  } else if (qText.includes("-") || qText.includes("−")) {
    opBadge = "➖ Subtraction";
  } else if (qText.includes("×") || qText.includes("*")) {
    opBadge = "✖️ Multiplication";
  } else if (qText.includes("÷") || qText.includes("/")) {
    opBadge = "➗ Division";
  }

  const difficulty = question.difficulty || "Easy";
  const isTextQuestion = isGK || isGrammar;

  return (
    <div className={`question ${isTextQuestion ? "question--gk" : ""}`} key={question.id || question.text}>
      <div className="question__meta">
        <span className={opClass}>{opBadge}</span>
        <span className={`question__difficulty question__difficulty--${difficulty.toLowerCase()}`}>
          Difficulty: <strong>{difficulty}</strong>
        </span>
      </div>
      <div className={`question__text ${isTextQuestion ? "question__text--gk" : ""}`}>
        {question.text}
      </div>
    </div>
  );
}
