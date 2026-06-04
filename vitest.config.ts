import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://test:test@localhost/test",
      DATABASE_URL_UNPOOLED: "postgresql://test:test@localhost/test",
      GOOGLE_MAPS_API_KEY: "test-google-maps-key",
      ADMIN_USERNAME: "test-admin",
      ADMIN_PASSWORD: "test-password",
      SESSION_SECRET: "test-session-secret-at-least-32-bytes-long",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
        },
      },
    ],
  },
});
