import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    setupFiles: ["dotenv/config"],
    // The bot and search tests use the database in DATABASE_URL (after
    // `npm run db:migrate && npm run db:seed`). They create rows on test
    // numbers in the +23480999xxxxx range and clean them up.
    fileParallelism: false,
  },
});
