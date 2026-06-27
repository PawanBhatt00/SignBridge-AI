import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.integration.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    hookTimeout: 180000,
    testTimeout: 60000,
  },
});
