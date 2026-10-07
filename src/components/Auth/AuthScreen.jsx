import { useState } from "react";
import Login from "./Login";
import Register from "./Register";
import AudioToggle from "../AudioToggle/AudioToggle";
import { useAuth } from "../../context/AuthContext";
import "./Auth.css";

export default function AuthScreen() {
  const [authView, setAuthView] = useState("login"); // "login" | "register"
  const { login, register, authError, clearAuthError } = useAuth();

  return (
    <div className="auth-container">
      <div className="auth-top-bar">
        <AudioToggle />
      </div>

      {authView === "login" ? (
        <Login
          onLogin={login}
          onSwitchToRegister={() => setAuthView("register")}
          error={authError}
          clearError={clearAuthError}
        />
      ) : (
        <Register
          onRegister={register}
          onSwitchToLogin={() => setAuthView("login")}
          error={authError}
          clearError={clearAuthError}
        />
      )}
    </div>
  );
}
