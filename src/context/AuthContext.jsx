import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { socketService } from "../services/socket";

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    return localStorage.getItem("math_battle_token") || null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem("math_battle_token");
    if (!storedToken) return null;

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      console.warn("[Refresh User Warning]", err);
    }
    return null;
  }, []);

  const updateUserCoins = useCallback((newCoins) => {
    if (typeof newCoins === "number") {
      setUser((prev) => (prev ? { ...prev, coins: newCoins } : prev));
    }
  }, []);

  // Check existing token validity on startup
  useEffect(() => {
    async function verifyExistingToken() {
      const storedToken = localStorage.getItem("math_battle_token");
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        const data = await res.json();
        if (res.ok && data.success && data.user) {
          setUser(data.user);
          setToken(storedToken);
          socketService.connect(storedToken);
        } else {
          localStorage.removeItem("math_battle_token");
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn("[Auth Check Warning]", err);
        localStorage.removeItem("math_battle_token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    verifyExistingToken();
  }, []);

  /**
   * Register a new user
   */
  const register = useCallback(async ({ name, email, password, confirmPassword }) => {
    setAuthError(null);

    // Client-side validations
    if (!name || name.trim().length < 2) {
      const err = "Please enter your full name or username (min 2 characters).";
      setAuthError(err);
      return { success: false, error: err };
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const err = "Please enter a valid email address.";
      setAuthError(err);
      return { success: false, error: err };
    }

    if (!password || password.length < 6) {
      const err = "Password must be at least 6 characters long.";
      setAuthError(err);
      return { success: false, error: err };
    }

    if (password !== confirmPassword) {
      const err = "Passwords do not match. Please verify and try again.";
      setAuthError(err);
      return { success: false, error: err };
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const err = data.error || "Registration failed. Please try again.";
        setAuthError(err);
        return { success: false, error: err };
      }

      // Successful registration
      localStorage.setItem("math_battle_token", data.token);
      localStorage.setItem("math_battle_name", data.user.name);
      setToken(data.token);
      setUser(data.user);
      socketService.connect(data.token);
      return { success: true, user: data.user };
    } catch (err) {
      const message = "Network error. Unable to reach authentication server.";
      setAuthError(message);
      return { success: false, error: message };
    }
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(async ({ email, password }) => {
    setAuthError(null);

    if (!email || !email.trim()) {
      const err = "Please enter your email address.";
      setAuthError(err);
      return { success: false, error: err };
    }

    if (!password) {
      const err = "Please enter your password.";
      setAuthError(err);
      return { success: false, error: err };
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const err = data.error || "Invalid email or password.";
        setAuthError(err);
        return { success: false, error: err };
      }

      // Successful login
      localStorage.setItem("math_battle_token", data.token);
      localStorage.setItem("math_battle_name", data.user.name);
      setToken(data.token);
      setUser(data.user);
      socketService.connect(data.token);
      return { success: true, user: data.user };
    } catch (err) {
      const message = "Network error. Unable to connect to server.";
      setAuthError(message);
      return { success: false, error: message };
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(() => {
    localStorage.removeItem("math_battle_token");
    setToken(null);
    setUser(null);
    setAuthError(null);
    socketService.disconnect();
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    authError,
    setAuthError,
    clearAuthError,
    refreshUser,
    updateUserCoins,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
