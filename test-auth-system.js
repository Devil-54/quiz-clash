import { io } from "socket.io-client";

const BASE_URL = "http://localhost:3001";
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runAuthTests() {
  console.log("\n==================================================");
  console.log("🚀 AUTHENTICATION & MULTIPLAYER TEST SUITE");
  console.log("==================================================\n");

  const timestamp = Date.now();
  const testUser1 = {
    name: "Deepak",
    email: `deepak_${timestamp}@example.com`,
    password: "password123",
  };

  // 1. Register new user
  console.log("--- 1. Testing Registration ---");
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testUser1),
  });
  const regData = await regRes.json();
  assert(regRes.status === 201 && regData.success === true, "New user registered successfully");
  assert(Boolean(regData.token), "JWT token returned upon registration");
  assert(regData.user && regData.user.name === "Deepak", "User object returned with name");
  assert(regData.user.password === undefined && regData.user.passwordHash === undefined, "Password/hash NOT exposed in response");

  const token1 = regData.token;

  // 2. Duplicate email registration
  console.log("\n--- 2. Duplicate Email Registration ---");
  const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testUser1),
  });
  const dupData = await dupRes.json();
  assert(dupRes.status === 400 && dupData.success === false, "Duplicate email registration rejected with 400");
  assert(/already exists/i.test(dupData.error), "Error message clearly mentions duplicate email");

  // 3. Invalid email registration
  console.log("\n--- 3. Invalid Email Format ---");
  const invEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Alex", email: "not-an-email", password: "password123" }),
  });
  const invEmailData = await invEmailRes.json();
  assert(invEmailRes.status === 400 && invEmailData.success === false, "Invalid email format rejected");

  // 4. Short password registration (< 6 chars)
  console.log("\n--- 4. Short Password Rejection ---");
  const shortPassRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Alex", email: `alex_${timestamp}@example.com`, password: "123" }),
  });
  const shortPassData = await shortPassRes.json();
  assert(shortPassRes.status === 400 && shortPassData.success === false, "Password shorter than 6 chars rejected");

  // 5. Login with correct credentials
  console.log("\n--- 5. Login with Valid Credentials ---");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testUser1.email, password: testUser1.password }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200 && loginData.success === true, "Login successful with valid credentials");
  assert(Boolean(loginData.token), "Valid JWT token returned upon login");
  assert(loginData.user.name === "Deepak", "User profile returned correctly");

  // 6. Login with wrong password
  console.log("\n--- 6. Login with Wrong Password ---");
  const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testUser1.email, password: "wrongpassword" }),
  });
  const wrongPassData = await wrongPassRes.json();
  assert(wrongPassRes.status === 401 && wrongPassData.success === false, "Wrong password rejected with 401");

  // 7. Verify token session (/api/auth/me)
  console.log("\n--- 7. Token Session Verification (/api/auth/me) ---");
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const meData = await meRes.json();
  assert(meRes.status === 200 && meData.success === true, "Session token successfully verified");
  assert(meData.user.email === testUser1.email, "Returned verified user profile matches session");

  // 8. Protected route rejection with missing/invalid token
  console.log("\n--- 8. Unauthorized Token Rejection ---");
  const unauthRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: "Bearer invalid_or_expired_jwt_token" },
  });
  assert(unauthRes.status === 401, "Invalid token rejected with 401 Unauthorized");

  // 9. Register 3 additional players for 4-player multiplayer
  console.log("\n--- 9. Registering Multiple Authenticated Players ---");
  const users = [
    { name: "Rahul", email: `rahul_${timestamp}@example.com`, password: "password123" },
    { name: "Priya", email: `priya_${timestamp}@example.com`, password: "password123" },
    { name: "Amit",  email: `amit_${timestamp}@example.com`,  password: "password123" },
  ];

  const authTokens = [token1];
  for (const u of users) {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(u),
    });
    const data = await res.json();
    assert(res.status === 201, `Registered ${u.name}`);
    authTokens.push(data.token);
  }

  // 10. Test 4-Player Multiplayer with Authenticated Usernames
  console.log("\n--- 10. 4-Player Authenticated Multiplayer Flow ---");
  await testAuthenticatedMultiplayer(authTokens);

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

function testAuthenticatedMultiplayer(tokens) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Multiplayer test timed out"));
    }, 25000);

    // Sockets for Deepak (Host), Rahul, Priya, Amit
    const s1 = io(BASE_URL, { transports: ["websocket"], auth: { token: tokens[0] } });
    const s2 = io(BASE_URL, { transports: ["websocket"], auth: { token: tokens[1] } });
    const s3 = io(BASE_URL, { transports: ["websocket"], auth: { token: tokens[2] } });
    const s4 = io(BASE_URL, { transports: ["websocket"], auth: { token: tokens[3] } });

    let roomCode = null;

    s1.on("connect", () => {
      // Deepak creates GK room
      s1.emit("room:create", { mode: "gk", token: tokens[0] }, (res) => {
        assert(res.success === true, "Deepak created GK multiplayer room");
        assert(res.player.name === "Deepak", "Host player assigned verified username 'Deepak'");
        assert(res.room.mode === "gk", "Room mode is 'gk'");
        roomCode = res.roomCode;

        // Rahul joins
        s2.emit("room:join", { roomCode, token: tokens[1] }, (res2) => {
          assert(res2.success === true, "Rahul joined room");
          assert(res2.player.name === "Rahul", "Second player has username 'Rahul'");

          // Priya joins
          s3.emit("room:join", { roomCode, token: tokens[2] }, (res3) => {
            assert(res3.success === true, "Priya joined room");
            assert(res3.player.name === "Priya", "Third player has username 'Priya'");

            // Amit joins
            s4.emit("room:join", { roomCode, token: tokens[3] }, (res4) => {
              assert(res4.success === true, "Amit joined room");
              assert(res4.player.name === "Amit", "Fourth player has username 'Amit'");

              const playerNames = res4.room.players.map((p) => p.name);
              assert(
                playerNames.includes("Deepak") &&
                playerNames.includes("Rahul") &&
                playerNames.includes("Priya") &&
                playerNames.includes("Amit"),
                "All 4 players authenticated usernames present in room state"
              );

              // Ready up players 2, 3, 4
              s2.emit("player:ready", { roomCode, isReady: true });
              s3.emit("player:ready", { roomCode, isReady: true });
              s4.emit("player:ready", { roomCode, isReady: true });

              // Start match
              setTimeout(() => {
                s1.emit("game:start", { roomCode }, (startRes) => {
                  assert(startRes.success === true, "Host started the 4-player game");
                });
              }, 300);
            });
          });
        });
      });
    });

    const sockets = [s1, s2, s3, s4];
    s1.on("game:question", (data) => {
      const q = data.question;
      if (q.round === 1) {
        assert(q.mode === "gk", "Round 1 question received in GK mode");
        assert(Boolean(q.category), `Question category: ${q.category}`);
      }

      // All players submit an answer promptly so rounds transition rapidly
      sockets.forEach((s, idx) => {
        setTimeout(() => {
          s.emit("answer:submit", { roomCode, round: q.round, answer: q.options[idx % q.options.length] });
        }, 50 * (idx + 1));
      });
    });

    s1.on("game:over", (data) => {
      assert(data.leaderboard && data.leaderboard.length === 4, "Leaderboard contains all 4 authenticated players");
      assert(Boolean(data.winner), `Match winner declared: ${data.winner.name}`);

      clearTimeout(timeout);
      s1.disconnect();
      s2.disconnect();
      s3.disconnect();
      s4.disconnect();
      resolve();
    });
  });
}

runAuthTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
