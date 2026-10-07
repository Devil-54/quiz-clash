import { useState } from "react";
import { sound } from "../../utils/audio";

export default function Login({ onLogin, onSwitchToRegister, error, clearError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    sound.playClick();
    clearError?.();
    setLocalError("");

    if (!email.trim()) {
      setLocalError("Please enter your email address.");
      return;
    }

    if (!password) {
      setLocalError("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    const res = await onLogin({ email: email.trim(), password });
    setIsSubmitting(false);

    if (!res.success && res.error) {
      setLocalError(res.error);
    }
  }

  const displayedError = localError || error;

  return (
    <div className="auth-card">
      <div className="auth-header">
        <span className="auth-header__icon" aria-hidden="true">⚡</span>
        <h1 className="auth-header__title">
          QUIZ <span className="accent">CLASH</span>
        </h1>
        <p className="auth-header__subtitle">Think Fast. Clash Smarter.</p>
      </div>

      <div className="auth-tabs">
        <button
          type="button"
          className="auth-tab-btn auth-tab-btn--active"
        >
          Sign In
        </button>
        <button
          type="button"
          className="auth-tab-btn"
          onClick={() => {
            sound.playClick();
            clearError?.();
            onSwitchToRegister();
          }}
        >
          Register
        </button>
      </div>

      {displayedError && (
        <div className="auth-error-banner" role="alert">
          <span>⚠️</span>
          <span>{displayedError}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form-group">
          <label htmlFor="login-email" className="auth-form-label">
            Email Address
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">✉️</span>
            <input
              id="login-email"
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLocalError("");
                clearError?.();
              }}
              autoComplete="email"
              required
              autoFocus
            />
          </div>
        </div>

        <div className="auth-form-group">
          <label htmlFor="login-password" className="auth-form-label">
            Password
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">🔒</span>
            <input
              id="login-password"
              type="password"
              className="auth-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLocalError("");
                clearError?.();
              }}
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--lg auth-submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "⚡ Sign In"}
        </button>
      </form>

      <div className="auth-switch-link">
        Don&apos;t have an account?
        <button
          type="button"
          className="auth-link-button"
          onClick={() => {
            sound.playClick();
            clearError?.();
            onSwitchToRegister();
          }}
        >
          Register here
        </button>
      </div>

      <div className="auth-features-preview">
        <span className="auth-pill">🧮 Math Battles</span>
        <span className="auth-pill">🌍 GK Trivia</span>
        <span className="auth-pill">📚 English Grammar</span>
        <span className="auth-pill">👥 Live Multiplayer</span>
      </div>
    </div>
  );
}
