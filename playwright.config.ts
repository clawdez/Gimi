import { defineConfig } from "@playwright/test";

// E2E runs against the PRODUCTION build (`next build` first — see .mrrobot/e2e.sh)
// with the local Supabase stack (API on 54321, Mailpit on 54324) providing
// real magic-link email delivery. Supabase env vars are inherited from the
// shell that launches Playwright.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx next start -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
