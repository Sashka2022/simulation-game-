import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
const config = JSON.parse(await readFile("vercel.json", "utf8"));
const files = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/demo.js": ["demo.js", "text/javascript"],
  "/demo.css": ["demo.css", "text/css"],
  "/preview.css": ["preview.css", "text/css"],
};
const server = createServer(async (req, res) => {
  const file = files[req.url];
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  for (const h of config.headers[0].headers) res.setHeader(h.key, h.value);
  res.setHeader("Content-Type", file[1]);
  res.end(await readFile("dist-demo/" + file[0]));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("Content Security Policy"))
      errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.getByRole("button", { name: "מתחילות את המשחק" }).click();
  await page.getByRole("heading", { name: "הבטחה אחת. מערכת שלמה." }).waitFor();
  await context.setOffline(true);
  await page.getByLabel("נקודת מבט בהדגמה").selectOption("MOE");
  await page
    .getByRole("navigation", { name: "ניווט מהיר" })
    .getByRole("button", { name: "התפקיד", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "משרד החינוך", exact: true })
    .waitFor();
  await page.getByLabel("נקודת מבט בהדגמה").selectOption("projector");
  await page.locator(".projector").waitFor();
  await page.getByRole("button", { name: "חזרה למנחה", exact: true }).click();
  await page.getByRole("button", { name: "לשלב הבא", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  console.log(
    "Static Vercel demo passed: mobile host → team → projector → host, offline after load, with deployment CSP.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
