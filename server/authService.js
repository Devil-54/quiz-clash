import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET must be configured with at least 32 characters before starting Quiz Clash.",
  );
}
const JWT_EXPIRES_IN = "7d";

// In-memory user store (structured as a mockable database repository)
// Map<string (lowercased email), User>
const usersByEmail = new Map();
// Map<string (userId), User>
const usersById = new Map();

/**
 * Validate email format.
 */
export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Sanitize username/name.
 */
export function sanitizeName(name) {
  if (typeof name !== "string") return "";
  return name
    .replace(/<[^>]*>?/gm, "")
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "")
    .trim()
    .slice(0, 30);
}

/**
 * Return safe public user object (never exposing password hash).
 */
export function toSafeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    coins: typeof user.coins === "number" ? user.coins : 0,
    gamesPlayed: typeof user.gamesPlayed === "number" ? user.gamesPlayed : 0,
    gamesWon: typeof user.gamesWon === "number" ? user.gamesWon : 0,
    createdAt: user.createdAt,
  };
}

/**
 * Register a new user with 0 starting coins.
 */
export async function registerUser({ name, email, password }) {
  const sanitized = sanitizeName(name);
  if (!sanitized || sanitized.length < 2) {
    throw new Error("Full Name / Username must be at least 2 characters.");
  }

  if (!email || !isValidEmail(email)) {
    throw new Error("Please provide a valid email address.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (usersByEmail.has(normalizedEmail)) {
    throw new Error("An account with this email already exists.");
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  if (password.length > 100) {
    throw new Error("Password cannot exceed 100 characters.");
  }

  // Hash password with bcrypt
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const userId = "usr_" + crypto.randomBytes(8).toString("hex");
  const newUser = {
    id: userId,
    name: sanitized,
    email: normalizedEmail,
    passwordHash,
    coins: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    createdAt: new Date().toISOString(),
  };

  usersByEmail.set(normalizedEmail, newUser);
  usersById.set(userId, newUser);

  // Generate JWT token
  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: toSafeUser(newUser),
  };
}

/**
 * Login user with email and password.
 */
export async function loginUser({ email, password }) {
  if (!email || !isValidEmail(email)) {
    throw new Error("Please provide a valid email address.");
  }

  if (!password || typeof password !== "string") {
    throw new Error("Please provide your password.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = usersByEmail.get(normalizedEmail);

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error("Invalid email or password.");
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: toSafeUser(user),
  };
}

/**
 * Verify JWT token and return safe user payload.
 */
export function verifyAuthToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) return null;
    const fullUser = usersById.get(decoded.id);
    return fullUser ? toSafeUser(fullUser) : {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      coins: 0,
      gamesPlayed: 0,
      gamesWon: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Get safe user by ID.
 */
export function getUserById(id) {
  const user = usersById.get(id);
  return toSafeUser(user);
}

/**
 * Get user coin balance.
 */
export function getUserCoins(id) {
  const user = usersById.get(id);
  return user ? (user.coins || 0) : 0;
}

/**
 * Add virtual coins to a user account.
 */
export function addCoinsToUser(userId, amount) {
  if (!userId || typeof amount !== "number" || amount <= 0) return 0;
  const user = usersById.get(userId);
  if (user) {
    user.coins = (user.coins || 0) + amount;
    return user.coins;
  }
  return 0;
}

/**
 * Record a completed match for the user account.
 */
export function recordMatchResult(userId, { isWinner = false, bonusCoins = 0 }) {
  if (!userId) return null;
  const user = usersById.get(userId);
  if (user) {
    user.gamesPlayed = (user.gamesPlayed || 0) + 1;
    if (isWinner) {
      user.gamesWon = (user.gamesWon || 0) + 1;
      if (bonusCoins > 0) {
        user.coins = (user.coins || 0) + bonusCoins;
      }
    }
    return toSafeUser(user);
  }
  return null;
}

/**
 * Optional helper for tests to reset state.
 */
export function _resetUsersForTesting() {
  usersByEmail.clear();
  usersById.clear();
}
