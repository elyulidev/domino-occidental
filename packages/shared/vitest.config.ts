import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["src/game/__tests__/**", "node_modules/**"],
  },
});
