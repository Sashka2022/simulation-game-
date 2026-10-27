import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("landing is responsive and accessible; join QR opens the correct flow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /הבטחה אחת/ })).toBeVisible();
  for (const width of [320, 360, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
  await page.goto("/?join=ABC123");
  await expect(page.getByLabel("קוד המפגש")).toHaveValue("ABC123");
});
test("demo completes all phases offline and persists across reload", async ({
  page,
  context,
}) => {
  await page.goto("/room/demo");
  await expect(
    page.getByRole("button", { name: "מתחילות את המשחק" }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "מתחילות את המשחק" }).click();
  await expect(
    page.getByRole("heading", { name: "הבטחה אחת. מערכת שלמה." }),
  ).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.getByRole("button", { name: "לשלב הבא", exact: true }).click();
    await page.getByRole("button", { name: "כן, לשלב הבא" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "השיחה לא מסתיימת כאן." }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "השיחה לא מסתיימת כאן." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "לסיכום המפגש" }).click();
  await expect(
    page.getByRole("heading", { name: "סיכום חדר המצב" }),
  ).toBeVisible();
});
test("live room: five isolated delegations, projector, concurrent updates and reconnect", async ({
  browser,
}) => {
  const host = await browser.newContext();
  const teams = await Promise.all(
    Array.from({ length: 5 }, () => browser.newContext()),
  );
  const projection = await browser.newContext();
  try {
    const res = await host.request.post("/api/session", {
      data: { type: "create", name: "בדיקת שבעה לקוחות" },
    });
    expect(res.ok()).toBeTruthy();
    const room = await res.json();
    let s = await (await host.request.get("/api/room/" + room.id)).json();
    const code = s.code;
    const roles = ["MOE", "FIN", "UNION", "LOCAL", "PRINCIPALS"];
    for (let i = 0; i < 5; i++) {
      const join = await teams[i].request.post("/api/session", {
        data: { type: "join", code, role: roles[i] },
      });
      expect(join.ok()).toBeTruthy();
      const pending = await teams[i].request.get("/api/room/" + room.id);
      expect(pending.status()).toBe(202);
      s = await (await host.request.get("/api/room/" + room.id)).json();
      const request = s.requests.find(
        (r: { role: string }) => r.role === roles[i],
      );
      const approve = await host.request.post("/api/room/" + room.id, {
        data: {
          commandId: crypto.randomUUID(),
          revision: s.revision,
          action: { type: "approve", memberId: request.id },
        },
      });
      expect(approve.ok()).toBeTruthy();
    }
    const fin = await (
      await teams[1].request.get("/api/room/" + room.id)
    ).json();
    const moe = await (
      await teams[0].request.get("/api/room/" + room.id)
    ).json();
    expect(fin.privateCard).toContain("לשנה הראשונה");
    expect(JSON.stringify(moe)).not.toContain(fin.privateCard);
    expect(moe.privateCards).toBeUndefined();
    const pub = await (
      await projection.request.get("/api/room/" + room.id, {
        headers: { "x-projector-token": room.projector },
      })
    ).json();
    expect(pub.actor.kind).toBe("projector");
    expect(JSON.stringify(pub)).not.toContain(fin.privateCard);
    expect(pub.privateCards).toBeUndefined();
    expect(pub.code).toBeUndefined();
    const hostProjection = await (
      await host.request.get("/api/room/" + room.id, {
        headers: { "x-projector-token": room.projector },
      })
    ).json();
    expect(hostProjection.actor.kind).toBe("projector");
    expect(hostProjection.privateCards).toBeUndefined();
    const attack = await teams[0].request.post("/api/room/" + room.id, {
      data: {
        commandId: crypto.randomUUID(),
        revision: moe.revision,
        action: { type: "advance" },
      },
    });
    expect(attack.status()).toBe(403);
    const unknown = await projection.request.get("/api/room/" + room.id);
    expect(unknown.status()).toBe(403);
    const p = await host.newPage();
    await p.goto("/room/" + room.id);
    await expect(
      p.getByRole("button", { name: "מתחילות את המשחק" }),
    ).toBeVisible();
    await p.getByRole("button", { name: "מתחילות את המשחק" }).click();
    const teamPage = await teams[0].newPage();
    await teamPage.goto("/room/" + room.id);
    await expect(
      teamPage.getByRole("heading", { name: "הבטחה אחת. מערכת שלמה." }),
    ).toBeVisible();
    await teamPage.reload();
    await expect(
      teamPage.getByRole("heading", { name: "הבטחה אחת. מערכת שלמה." }),
    ).toBeVisible();
    s = await (await host.request.get("/api/room/" + room.id)).json();
    await host.request.post("/api/room/" + room.id, {
      data: {
        commandId: crypto.randomUUID(),
        revision: s.revision,
        action: { type: "advance" },
      },
    });
    await expect(
      teamPage.getByRole("heading", { name: "גנבתן לנו את המורה" }),
    ).toBeVisible({ timeout: 10000 });
    await teamPage.getByLabel("מה אתן מציעות?").fill("תוכנית שימור");
    await teamPage.getByLabel("מה המחיר ומי מושפעת?").fill("פתיחה מדורגת");
    await teamPage.getByLabel("מה התנאי להסכמה?").fill("מימון רב שנתי");
    await teamPage.waitForTimeout(1000);
    await teamPage.reload();
    await expect(teamPage.getByLabel("מה אתן מציעות?")).toHaveValue(
      "תוכנית שימור",
    );
    await teamPage.getByRole("button", { name: "שליחת העמדה" }).click();
    await expect(
      teamPage.getByRole("heading", { name: "העמדות שעל השולחן" }),
    ).toBeVisible();
    const axe = await new AxeBuilder({ page: teamPage }).analyze();
    expect(axe.violations).toEqual([]);
    s = await (await host.request.get("/api/room/" + room.id)).json();
    await host.request.post("/api/room/" + room.id, {
      data: {
        commandId: crypto.randomUUID(),
        revision: s.revision,
        action: { type: "delete" },
      },
    });
    expect((await teams[1].request.get("/api/room/" + room.id)).status()).toBe(
      400,
    );
  } finally {
    await Promise.all([host, ...teams, projection].map((c) => c.close()));
  }
});

test("agreement versions publish explicitly, one final revision, code rotation and CSRF", async ({
  browser,
}) => {
  const c = await browser.newContext();
  try {
    const room = await (
      await c.request.post("/api/session", {
        data: { type: "create", name: "בדיקת הסכם" },
      })
    ).json();
    const read = async () =>
      (await c.request.get("/api/room/" + room.id)).json();
    let s = await read();
    const command = async (action: Record<string, unknown>) => {
      s = await read();
      return c.request.post("/api/room/" + room.id, {
        data: { commandId: crypto.randomUUID(), revision: s.revision, action },
      });
    };
    const old = s.code;
    expect((await command({ type: "rotate" })).ok()).toBeTruthy();
    s = await read();
    expect(s.code).not.toBe(old);
    const attack = await c.request.post("/api/room/" + room.id, {
      headers: { Origin: "https://untrusted.example" },
      data: {
        commandId: crypto.randomUUID(),
        revision: s.revision,
        action: { type: "start" },
      },
    });
    expect(attack.status()).toBe(400);
    await command({ type: "start" });
    for (let i = 0; i < 5; i++) await command({ type: "advance" });
    s = await read();
    expect(s.phase).toBe("AGREEMENT");
    for (const id of ["0", "1", "2"]) {
      const clause = {
        action: "הקמה מדורגת עם חונכות",
        owner: "משרד החינוך",
        requiredPartners: "רשויות ואוצר",
        resources: "שש יחידות סיוע",
        nextStep: "בדיקת כוח אדם וחדרים",
        deadline: "ספטמבר 2029",
        schoolEffects: "מסלול לשני בתי הספר",
        status: "APPROVED_EXECUTABLE",
        authority: true,
        funding: true,
        readiness: true,
        ofakim: true,
        shvilim: true,
        evidence: "אישור בדוי המתועד בסימולציה",
      };
      expect((await command({ type: "clause", id, clause })).ok()).toBeTruthy();
    }
    let pub = await (
      await c.request.get("/api/room/" + room.id, {
        headers: { "x-projector-token": room.projector },
      })
    ).json();
    expect(pub.clauses).toHaveLength(0);
    await command({ type: "publish", id: "0" });
    pub = await (
      await c.request.get("/api/room/" + room.id, {
        headers: { "x-projector-token": room.projector },
      })
    ).json();
    expect(pub.clauses).toHaveLength(1);
    expect(pub.logs).toEqual([]);
    await command({ type: "advisor" });
    await command({ type: "advance" });
    s = await read();
    expect(s.outcome.id).toBe("SLOW_STABLE");
    expect(
      (
        await command({
          type: "final",
          id: "0",
          after: "תמיכה מדורגת ומעקב",
          reason: "למדנו על התלויות",
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await command({
          type: "final",
          id: "1",
          after: "עוד שינוי",
          reason: "ניסיון כפול",
        })
      ).ok(),
    ).toBeFalsy();
    s = await read();
    expect(s.history).toHaveLength(4);
    expect(s.clauses[0].published).toBeFalsy();
    const p = await c.newPage();
    await p.goto("/room/" + room.id);
    await expect(
      p.getByRole("heading", { name: "לאט יותר. יציב יותר." }),
    ).toBeVisible();
    for (const width of [320, 360, 390, 768, 1440, 1920]) {
      await p.setViewportSize({ width, height: 900 });
      expect(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await expect(
      p.getByRole("navigation", { name: "ניווט מהיר" }),
    ).toBeVisible();
    await command({ type: "delete" });
  } finally {
    await c.close();
  }
});

test("demo role, negotiation and research fit mobile and remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/room/demo");
  await page.getByRole("button", { name: "מתחילות את המשחק" }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "לשלב הבא", exact: true }).click();
    await page.getByRole("button", { name: "כן, לשלב הבא" }).click();
  }
  await page.getByLabel("נקודת מבט בהדגמה").selectOption("MOE");
  await expect(
    page.getByRole("heading", { name: "קודם מעלים את שכר המורים" }),
  ).toBeVisible();
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  let r = await new AxeBuilder({ page }).analyze();
  expect(r.violations).toEqual([]);
  await page
    .getByRole("navigation", { name: "ניווט מהיר" })
    .getByRole("button", { name: "התפקיד", exact: true })
    .click();
  await page.getByRole("button", { name: "מידע למשלחת בלבד" }).click();
  await expect(
    page.getByText("מידע לדוגמה: הבטחה אינה מבטיחה ביצוע."),
  ).toBeVisible();
  r = await new AxeBuilder({ page }).analyze();
  expect(r.violations).toEqual([]);
});

test("keyboard dialog closes with Escape and returns focus to its launcher", async ({
  page,
}) => {
  await page.goto("/");
  const launch = page.getByRole("button", { name: "פתיחת חדר מצב" });
  await launch.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("שם המפגש")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(launch).toBeFocused();
});
