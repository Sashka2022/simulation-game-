import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function create(host: BrowserContext) {
  const room = await (
    await host.request.post("/api/session", {
      data: { type: "create", name: "משלחות חופשיות" },
    })
  ).json();
  const url = "/api/room/" + room.id;
  const state = await (await host.request.get(url)).json();
  return { ...room, url, code: state.code };
}
async function command(
  c: BrowserContext,
  url: string,
  action: Record<string, unknown>,
) {
  const s = await (await c.request.get(url)).json();
  const response = await c.request.post(url, {
    data: {
      commandId: crypto.randomUUID(),
      revision: s.revision,
      action: { roleScope: s.actor.role, ...action },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}
test("mobile open joining: names, large delegation cards, real counts, current phase and refresh", async ({
  browser,
}) => {
  const host = await browser.newContext();
  const a = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const b = await browser.newContext();
  try {
    const r = await create(host);
    await command(host, r.url, { type: "start" });
    await command(host, r.url, { type: "advance" });
    await b.request.post("/api/session", {
      data: { type: "join", name: "דנה", code: r.code, role: "MOE" },
    });
    const page = await a.newPage();
    await page.goto("/?join=" + r.code);
    await page.getByLabel("שם או כינוי", { exact: true }).fill("נעה");
    await expect(
      page
        .getByRole("group", { name: "בחרי משלחת" })
        .locator(".delegation-choice"),
    ).toHaveCount(5);
    const card = page
      .locator(".delegation-choice")
      .filter({ hasText: "משרד החינוך" });
    await expect(card).toContainText("1 משתתפות");
    await card.click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "כניסה למשלחת" }).click();
    await expect(
      page.getByRole("heading", { name: "גנבתן לנו את המורה" }),
    ).toBeVisible();
    await expect(page.locator(".team-space")).toContainText("נעה");
    await expect(page.locator(".team-space")).toContainText("2 משתתפות");
    await expect(page.getByLabel("מה אתן מציעות?")).not.toBeVisible();
    await expect(
      page.getByText("ניהול משתתפות", { exact: false }),
    ).not.toBeVisible();
    await page
      .getByLabel("הרעיון שלי למשלחת")
      .fill("תמיכה במורות לפני פתיחת כיתה");
    await page.getByRole("button", { name: "שיתוף רעיון במשלחת" }).click();
    await page.getByText("רעיונות המשלחת · 1", { exact: true }).click();
    await expect(
      page.getByText("תמיכה במורות לפני פתיחת כיתה", { exact: true }),
    ).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.reload();
    await expect(page.locator(".team-space")).toContainText("נעה");
    const s = await (await host.request.get(r.url)).json();
    expect(s.membership.members).toHaveLength(2);
  } finally {
    await Promise.all([host, a, b].map((c) => c.close()));
  }
});
test("host roster, manual members and server reassignment remove previous private content", async ({
  browser,
}) => {
  const host = await browser.newContext();
  const a = await browser.newContext();
  try {
    const r = await create(host);
    await a.request.post("/api/session", {
      data: { type: "join", name: "נעה", code: r.code, role: "MOE" },
    });
    const page = await a.newPage();
    await page.goto("/room/" + r.id);
    await page
      .getByRole("button", { name: "התפקיד שלנו", exact: true })
      .click();
    await page.getByRole("button", { name: "מידע למשלחת בלבד" }).click();
    await expect(
      page.getByText("אישור משרות אינו מבטיח מורות זמינות ומתאימות."),
    ).toBeVisible();
    const hp = await host.newPage();
    await hp.goto("/room/" + r.id);
    await hp.locator(".members-panel > summary").click();
    await hp.getByLabel("שם או כינוי להוספה").fill("ללא מכשיר");
    await hp.getByRole("button", { name: "הוספת משתתפת", exact: true }).click();
    await expect(
      hp.locator(".roster-row").filter({ hasText: "ללא מכשיר" }),
    ).toContainText("מנותקת");
    await hp.getByLabel("העברת נעה", { exact: true }).selectOption("FIN");
    await expect(
      page.getByText("אישור משרות אינו מבטיח מורות זמינות ומתאימות."),
    ).not.toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "משרד האוצר", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "מידע למשלחת בלבד" }).click();
    await expect(
      page.getByText("אישור משרות אינו מבטיח מורות זמינות ומתאימות."),
    ).not.toBeVisible();
    expect((await new AxeBuilder({ page: hp }).analyze()).violations).toEqual(
      [],
    );
    await hp
      .getByRole("button", { name: "הסרת ללא מכשיר", exact: true })
      .click({ trial: true });
  } finally {
    await Promise.all([host, a].map((c) => c.close()));
  }
});
test("ordinary members elect a representative; only representative sees the official submission form", async ({
  browser,
}) => {
  const host = await browser.newContext(),
    a = await browser.newContext(),
    b = await browser.newContext();
  try {
    const r = await create(host);
    for (const [c, name] of [
      [a, "אור"],
      [b, "בר"],
    ] as const)
      await c.request.post("/api/session", {
        data: { type: "join", name, code: r.code, role: "MOE" },
      });
    await command(host, r.url, { type: "start" });
    await command(host, r.url, { type: "advance" });
    const pa = await a.newPage(),
      pb = await b.newPage();
    await Promise.all([pa.goto("/room/" + r.id), pb.goto("/room/" + r.id)]);
    await expect(pa.getByLabel("מה אתן מציעות?")).toBeVisible();
    await expect(pb.getByLabel("מה אתן מציעות?")).not.toBeVisible();
    await pb.getByText("חברות המשלחת ובחירת נציגה", { exact: true }).click();
    await pb.getByLabel("הפונקציה שלי").selectOption("POLICY");
    await expect(pb.getByLabel("הפונקציה שלי")).toHaveValue("POLICY");
    await pb
      .getByRole("button", { name: "בחירת בר לנציגה", exact: true })
      .click();
    await expect(pb.getByLabel("מה אתן מציעות?")).toBeVisible();
    await expect(pa.getByLabel("מה אתן מציעות?")).not.toBeVisible({
      timeout: 10000,
    });
    await pb.getByLabel("מה אתן מציעות?").fill("חונכות ושימור");
    await pb.getByLabel("מה המחיר ומי מושפעת?").fill("זמן");
    await pb.getByLabel("מה התנאי להסכמה?").fill("תקציב");
    await pb.getByRole("button", { name: "שליחת העמדה" }).click();
    await expect(pb.locator(".official-status")).toContainText(
      "הוגשה לסבב הנוכחי",
    );
    await expect(pb.getByLabel("מה אתן מציעות?")).not.toBeVisible();
    await expect(pa.locator(".official-status")).toContainText(
      "הוגשה לסבב הנוכחי",
      { timeout: 10000 },
    );
    const s = await (await host.request.get(r.url)).json();
    expect(s.proposals).toHaveLength(1);
  } finally {
    await Promise.all([host, a, b].map((c) => c.close()));
  }
});
test("disconnection status and reconnect preserve identity without duplicating the member", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const host = await browser.newContext(),
    a = await browser.newContext();
  try {
    const r = await create(host);
    await a.request.post("/api/session", {
      data: { type: "join", name: "חוזרת לרשת", code: r.code, role: "MOE" },
    });
    const page = await a.newPage();
    await page.goto("/room/" + r.id);
    await expect(page.locator(".team-space")).toContainText("חוזרת לרשת");
    const before = await (await host.request.get(r.url)).json();
    const id = before.membership.members[0].id;
    await a.setOffline(true);
    await expect
      .poll(
        async () => {
          const s = await (await host.request.get(r.url)).json();
          return s.membership.members[0].connected;
        },
        { timeout: 30000, intervals: [2000] },
      )
      .toBe(false);
    await command(host, r.url, { type: "start" });
    await a.setOffline(false);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "הבטחה אחת. מערכת שלמה." }),
    ).toBeVisible();
    const after = await (await host.request.get(r.url)).json();
    expect(after.membership.members).toHaveLength(1);
    expect(after.membership.members[0].id).toBe(id);
    expect(after.membership.members[0].connected).toBe(true);
  } finally {
    await Promise.all([host, a].map((c) => c.close()));
  }
});
