import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.test" });

export default defineConfig({
  test: { environment: "node", globals: true, fileParallelism: false },
});
