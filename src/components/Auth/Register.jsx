import { useState } from "react";
import { sound } from "../../utils/audio";

export default function Register({ onRegister, onSwitchToLogin, error, clearError }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    sound.playClick();
    clearError?.();
    setLocalError("");

    if (!name.trim() || name.trim().length < 2) {
      setLocalError("Full Name / Username must be at least 2 characters.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setLocalError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    if (!password || password.length < 6) {
      setLocalError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match. Please verify and try again.");
      return;
    }

    setIsSubmitting(true);
    const res = await onRegister({
      name: name.trim(),
      email: email.trim(),
      password,
      confirmPassword,
    });
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
        <p className="auth-header__subtitle">Create your player profile & start battling!</p>
      </div>

      <div className="auth-tabs">
        <button
          type="button"
          className="auth-tab-btn"
          onClick={() => {
            sound.playClick();
            clearError?.();
            onSwitchToLogin();
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          className="auth-tab-btn auth-tab-btn--active"
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
          <label htmlFor="reg-name" className="auth-form-label">
            Full Name / Username
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">👤</span>
            <input
              id="reg-name"
              type="text"
              className="auth-input"
              placeholder="e.g. Rahul, Deepak, Alex..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setLocalError("");
                clearError?.();
              }}
              autoComplete="name"
              maxLength={24}
              required
              autoFocus
            />
          </div>
        </div>

        <div className="auth-form-group">
          <label htmlFor="reg-email" className="auth-form-label">
            Email Address
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">✉️</span>
            <input
              id="reg-email"
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
            />
          </div>
        </div>

        <div className="auth-form-group">
          <label htmlFor="reg-password" className="auth-form-label">
            Password (min 6 characters)
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">🔒</span>
            <input
              id="reg-password"
              type="password"
              className="auth-input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLocalError("");
                clearError?.();
              }}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
        </div>

        <div className="auth-form-group">
          <label htmlFor="reg-confirm-password" className="auth-form-label">
            Confirm Password
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">🔒</span>
            <input
              id="reg-confirm-password"
              type="password"
              className="auth-input"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setLocalError("");
                clearError?.();
              }}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--lg auth-submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating Account..." : "🚀 Register Now"}
        </button>
      </form>

      <div className="auth-switch-link">
        Already have an account?
        <button
          type="button"
          className="auth-link-button"
          onClick={() => {
            sound.playClick();
            clearError?.();
            onSwitchToLogin();
          }}
        >
          Login here
        </button>
      </div>

      <div className="auth-features-preview">
        <span className="auth-pill">🔒 Secure Passwords</span>
        <span className="auth-pill">⚡ Instant Matchmaking</span>
      </div>
    </div>
  );
}
