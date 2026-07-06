import { test, expect, type Page } from "@playwright/test";

// Full golden path against the production build + local Supabase stack:
// anonymous browse → magic-link sign-in (real email via Mailpit) → list an
// item → rent degrades gracefully without Stripe keys → session persists →
// sign out. The paid rent/receipt steps are covered by unit tests and stay
// blocked in E2E until Stripe TEST keys are configured (see DEPLOY.md).

const MAILPIT = "http://127.0.0.1:54324";

async function fetchMagicLink(email: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/messages?limit=20`);
    const data = (await res.json()) as {
      messages?: { ID: string; To: { Address: string }[] }[];
    };
    const msg = data.messages?.find((m) =>
      m.To.some((t) => t.Address.toLowerCase() === email.toLowerCase())
    );
    if (msg) {
      const full = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`);
      const body = (await full.json()) as { Text: string; HTML: string };
      const match = body.Text.match(/https?:\/\/[^\s)>\]]+auth\/v1\/verify[^\s)>\]]*/);
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No magic-link email arrived for ${email}`);
}

async function findStripeCardFrame(page: Page) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const el of await page.locator('iframe[title="Secure payment input frame"]').all()) {
      const frame = el.contentFrame();
      if ((await frame.getByPlaceholder("1234 1234 1234 1234").count()) > 0) return frame;
      // PaymentElement may show a payment-method tab picker first.
      const cardTab = frame.getByRole("button", { name: "Card", exact: true });
      if ((await cardTab.count()) > 0) {
        await cardTab.click();
        await page.waitForTimeout(1000);
        if ((await frame.getByPlaceholder("1234 1234 1234 1234").count()) > 0) return frame;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Stripe PaymentElement card frame never appeared");
}

async function answerAgent(page: Page, text: string) {
  const input = page.getByPlaceholder("Type your answer...");
  await input.fill(text);
  await input.press("Enter");
}

test.describe.serial("Gimi production readiness", () => {
  const email = `e2e-${Date.now()}@gimi.test`;
  const itemName = `E2E Pressure Washer ${Date.now()}`;

  test("anonymous visitors can browse the marketplace", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Available Rentals" })).toBeVisible();
    await expect(page.getByText("DJI Mini 4 Pro Drone")).toBeVisible();
    await expect(page.getByText("Burton Custom Snowboard 158")).toBeVisible();
  });

  test("anonymous listing is gated behind sign-in", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "+ List Item" }).click();
    await expect(page.getByTestId("listing-auth-gate")).toBeVisible();
    await page.getByRole("button", { name: "Sign in to continue" }).click();
    await expect(page.getByTestId("signin-modal")).toBeVisible();
  });

  test("magic-link sign-in → list item → rent degrade → session persistence → sign-out", async ({
    page,
  }) => {
    // --- Sign in with a real emailed magic link ---
    await page.goto("/");
    await page.getByTestId("signin-button").click();
    await page.getByTestId("signin-email").fill(email);
    await page.getByTestId("signin-submit").click();
    await expect(page.getByTestId("magic-link-sent")).toBeVisible();

    const link = await fetchMagicLink(email);
    await page.goto(link);
    await page.waitForURL("**/localhost:3000/**");
    await expect(page.getByTestId("account-button")).toContainText(email);

    // --- List an item through the listing agent ---
    await page.getByRole("button", { name: "+ List Item" }).click();
    await page.getByRole("button", { name: "Tools", exact: true }).click();
    await answerAgent(page, itemName);
    await answerAgent(page, "Karcher");
    await answerAgent(page, "K5 Premium");
    await page.getByRole("button", { name: "8 — Great" }).click();
    await answerAgent(page, "Like new, includes hose and two nozzles");
    await page.getByRole("button", { name: "Mint it!" }).click();
    await expect(page.getByText("Your item is live!")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "View marketplace" }).click();
    await expect(page.getByText(itemName)).toBeVisible();

    // --- Rent: full paid flow with Stripe TEST keys, graceful degrade without ---
    test.setTimeout(240_000);
    const status = await (await page.request.get("/api/card/status")).json();

    await page.getByText(itemName).click();
    await expect(page.getByText(`Renting as ${email}`)).toBeVisible();

    if (!status.configured) {
      // Blocked until STRIPE TEST keys land in the environment (see DEPLOY.md).
      await expect(
        page.getByText("Payment not configured — renting is disabled in this environment.")
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /^Rent for \$/ })).toBeDisabled();
    } else {
      // Link the Stripe TEST card (4242...) inside the PaymentElement iframe.
      // Stripe renders several same-titled iframes; find the one with the card field.
      await page.getByRole("button", { name: /^Rent for \$/ }).click();
      const stripeFrame = await findStripeCardFrame(page);
      await stripeFrame.getByPlaceholder("1234 1234 1234 1234").fill("4242424242424242");
      await stripeFrame.getByPlaceholder("MM / YY").fill("12/34");
      await stripeFrame.getByPlaceholder("CVC").fill("123");
      const zip = stripeFrame.locator('input[autocomplete="postal-code"], input[name="postalCode"]');
      if ((await zip.count()) > 0) await zip.first().fill("94107");
      await page.getByRole("button", { name: "Link card" }).click();

      // Charge + devnet receipt mint can take a while.
      await expect(page.getByText("Rental confirmed")).toBeVisible({ timeout: 120_000 });
      await expect(page.getByText(/•••• 4242/)).toBeVisible();
      const receiptLink = page.getByRole("link", { name: /on-chain receipt/i });
      const receiptPending = page.getByText(/On-chain receipt pending/);
      await expect(receiptLink.or(receiptPending)).toBeVisible();
      if (await receiptLink.isVisible().catch(() => false)) {
        const href = await receiptLink.getAttribute("href");
        expect(href).toContain("cluster=devnet");
      }

      // --- Return the item (on time — no overage) ---
      await page.getByRole("button", { name: "Back to marketplace" }).click();
      await page.getByText(itemName).click();
      await page.getByRole("button", { name: "Return item" }).click();
      await expect(page.getByText("Item returned")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Returned on time — no extra charges.")).toBeVisible();
    }

    // --- Session persists across a full reload ---
    await page.goto("/");
    await expect(page.getByTestId("account-button")).toContainText(email);

    // --- Sign out ---
    await page.getByTestId("account-button").click();
    await page.getByTestId("signout-button").click();
    await expect(page.getByTestId("signin-button")).toBeVisible();
  });

  test("mutating APIs refuse anonymous requests", async ({ request }) => {
    const rent = await request.post("/api/rent", {
      data: { itemId: "1", rentalDays: 3 },
    });
    expect(rent.status()).toBe(401);
    const list = await request.post("/api/list", {
      data: { name: "x", brand: "y", category: "Tools" },
    });
    expect(list.status()).toBe(401);
    const rentals = await request.get("/api/rentals");
    expect(rentals.status()).toBe(401);
  });
});
