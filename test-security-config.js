import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const result = spawnSync(process.execPath, ["--input-type=module", "-e", "import('./server/authService.js')"], {
  cwd: process.cwd(),
  env: { ...process.env, JWT_SECRET: undefined },
  encoding: "utf8",
});

assert.notEqual(
  result.status,
  0,
  "The backend must fail fast when JWT_SECRET is not configured.",
);
assert.match(
  result.stderr,
  /JWT_SECRET/i,
  "The backend must explain how to configure the missing JWT secret.",
);

console.log("✅ PASS: Authentication configuration requires JWT_SECRET.");
