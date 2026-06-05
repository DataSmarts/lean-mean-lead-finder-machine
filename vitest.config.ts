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
      HUNTER_API_KEY: "test-hunter-api-key",
      OPENROUTER_API_KEY: "test-openrouter-api-key",
      ADMIN_USERNAME: "test-admin",
      ADMIN_PASSWORD: "test-password",
      SESSION_SECRET: "test-session-secret-at-least-32-bytes-long",
      TELEGRAM_BOT_TOKEN: "1234567890:test-telegram-bot-token",
      TELEGRAM_CHAT_ID: "987654321",
      TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret",
      APP_BASE_URL: "http://localhost:3000",
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
