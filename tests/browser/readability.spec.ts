import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createGame } from "../../lib/engine";
async function advance(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "לשלב הבא", exact: true }).click();
  await page.getByRole("button", { name: "כן, לשלב הבא" }).click();
}
test("mobile task steps preserve a draft, acknowledge a saved answer and keep enlarged text on reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/room/demo");
  await page.getByRole("button", { name: "מתחילות את המשחק" }).click();
  await advance(page);
  await page.getByLabel("נקודת מבט בהדגמה").selectOption("MOE");
  await expect(page.locator(".task-guide")).toContainText("משבר 1 מתוך 4");
  await page.getByRole("button", { name: "מנסחות הצעה ותנאי" }).click();
  await expect(page.locator("#proposal-form")).toBeFocused();
  await page.getByLabel("מה אתן מציעות?").fill("תוכנית חונכות ושימור");
  await page.getByLabel("מה המחיר ומי מושפעת?").fill("פתיחה מדורגת");
  await page.getByLabel("מה התנאי להסכמה?").fill("מימון ושעות");
  await page.getByText("לסיפור המלא", { exact: true }).click();
  await expect(page.getByLabel("מה אתן מציעות?")).toHaveValue(
    "תוכנית חונכות ושימור",
  );
  const before = await page
    .getByLabel("מה אתן מציעות?")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.getByRole("button", { name: "הגדלת טקסט", exact: true }).click();
  expect(
    await page
      .getByLabel("מה אתן מציעות?")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThan(before);
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "הגדלת טקסט", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("נקודת מבט בהדגמה").selectOption("MOE");
  await expect(page.getByLabel("מה אתן מציעות?")).toHaveValue(
    "תוכנית חונכות ושימור",
  );
  await page.getByRole("button", { name: "שליחת העמדה" }).click();
  await expect(page.locator(".task-guide")).toContainText("העמדה נשלחה");
  await expect(page.locator(".task-guide")).toContainText(
    "נשמר — אפשר להמשיך בדיון",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("contextual help opens by keyboard and closes with Escape without losing focus", async ({
  page,
}) => {
  const g = createGame("demo", "התנסות");
  g.phase = "CRISIS3";
  await page.addInitScript(
    (game) => localStorage.setItem("hadar-demo-v1", JSON.stringify(game)),
    g,
  );
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/room/demo");
  await page.getByLabel("נקודת מבט בהדגמה").selectOption("MOE");
  const help = page.getByRole("button", { name: "הסבר: סמכות", exact: true });
  await help.focus();
  await page.keyboard.press("Space");
  await expect(help).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("note")).toContainText(
    "הסכמה בין המשלחות אינה מחליפה",
  );
  await page.keyboard.press("Escape");
  await expect(help).toHaveAttribute("aria-expanded", "false");
  await expect(help).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("projector fits a full-HD screen and shows one public message and a next step", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/room/demo");
  await page.getByRole("button", { name: "מתחילות את המשחק" }).click();
  await advance(page);
  await page.getByRole("button", { name: "חשיפת חלופות למקרן" }).click();
  await page.getByLabel("נקודת מבט בהדגמה").selectOption("projector");
  await expect(
    page.getByRole("heading", { name: "גנבתן לנו את המורה" }),
  ).toBeVisible();
  await expect(page.locator(".projector-options article")).toHaveCount(3);
  await expect(page.locator(".projector-now")).toBeVisible();
  await expect(page.getByRole("region", { name: "השאלה עכשיו" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBeTruthy();
  await expect(page.getByText("מידע למשלחת בלבד")).not.toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("host overview distinguishes submitted answers from presence and resets on the next phase", async ({
  browser,
}) => {
  const host = await browser.newContext(),
    team = await browser.newContext();
  try {
    const room = await (
      await host.request.post("/api/session", {
        data: { type: "create", name: "בדיקת מוכנות ברורה" },
      })
    ).json();
    const api = "/api/room/" + room.id;
    let s = await (await host.request.get(api)).json();
    await team.request.post("/api/session", {
      data: { type: "join", code: s.code, role: "MOE" },
    });
    s = await (await host.request.get(api)).json();
    await host.request.post(api, {
      data: {
        commandId: crypto.randomUUID(),
        revision: s.revision,
        action: { type: "approve", memberId: s.requests[0].id },
      },
    });
    for (const type of ["start", "advance"]) {
      s = await (await host.request.get(api)).json();
      await host.request.post(api, {
        data: {
          commandId: crypto.randomUUID(),
          revision: s.revision,
          action: { type },
        },
      });
    }
    const page = await host.newPage();
    await page.goto("/room/" + room.id);
    await expect(
      page.getByRole("heading", { name: "0 מתוך 5 משלחות הגישו" }),
    ).toBeVisible();
    const row = page
      .locator(".readiness-list li")
      .filter({ hasText: "משרד החינוך" });
    await expect(row).toContainText("מחוברות");
    await expect(row).toContainText("ממתינות להגשת עמדה");
    s = await (await host.request.get(api)).json();
    await team.request.post(api, {
      data: {
        commandId: crypto.randomUUID(),
        revision: s.revision,
        action: {
          type: "proposal",
          option: "B",
          action: "חונכות",
          price: "זמן",
          condition: "שעות",
          owner: "חינוך",
        },
      },
    });
    await expect(
      page.getByRole("heading", { name: "1 מתוך 5 משלחות הגישו" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText("העמדה נשלחה");
    s = await (await host.request.get(api)).json();
    await host.request.post(api, {
      data: {
        commandId: crypto.randomUUID(),
        revision: s.revision,
        action: { type: "advance" },
      },
    });
    await expect(
      page.getByRole("heading", { name: "0 מתוך 5 משלחות הגישו" }),
    ).toBeVisible({ timeout: 10000 });
    s = await (await host.request.get(api)).json();
    await host.request.post(api, {
      data: {
        commandId: crypto.randomUUID(),
        revision: s.revision,
        action: { type: "delete" },
      },
    });
  } finally {
    await host.close();
    await team.close();
  }
});
test("commitment cards expose responsibility, deadline and missing conditions; changes highlight only edited words", async ({
  page,
}) => {
  const g = createGame("demo", "התחייבויות");
  g.phase = "AGREEMENT";
  g.clauses[0] = {
    ...g.clauses[0],
    action: "נפתח שתי כיתות",
    previous: "נפתח שלוש כיתות",
    owner: "משרד החינוך",
    deadline: "ספטמבר 2029",
    version: 3,
  };
  await page.addInitScript(
    (game) => localStorage.setItem("hadar-demo-v1", JSON.stringify(game)),
    g,
  );
  await page.goto("/room/demo");
  const card = page.locator(".ledger-card").first();
  await expect(card.locator(".commitment-summary")).toContainText("מי אחראי");
  await expect(card.locator(".commitment-summary")).toContainText(
    "ספטמבר 2029",
  );
  await expect(card.locator(".commitment-missing")).toContainText(
    "מימון מאושר",
  );
  await card.getByText("מה השתנה מהגרסה הקודמת?", { exact: true }).click();
  await expect(card.locator(".revision-comparison mark")).toHaveText("שתי");
  await expect(card.locator(".revision-comparison del")).toHaveText("שלוש");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
