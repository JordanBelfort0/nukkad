import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import path from "path";

config({ path: ".env.test" });

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    // Neon is a remote DB; seed-heavy integration tests do many sequential
    // round-trips and exceed Vitest's 5s default. Raise globally so tests
    // don't each need a per-test timeout override.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
