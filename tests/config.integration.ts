import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDatabase, newRoom } from "../lib/store";
import { ServiceError } from "../lib/errors";
test("Vercel never silently falls back to temporary SQLite when no shared database is bound", async () => {
  const before = {
    VERCEL: process.env.VERCEL,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    DATA_DIR: process.env.DATA_DIR,
  };
  const root = await mkdtemp(join(tmpdir(), "hadar-config-"));
  const dir = join(root, "must-not-exist");
  try {
    process.env.VERCEL = "1";
    process.env.DATA_DIR = dir;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    for (const operation of [() => checkDatabase(), () => newRoom("test")])
      await assert.rejects(
        operation,
        (e) => e instanceof ServiceError && e.code === "DATABASE_REQUIRED",
      );
    await assert.rejects(access(dir));
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(root, { recursive: true, force: true });
  }
});
