import "server-only";
import type { Action } from "./engine";
import type { Role } from "./content";
import { ServiceError } from "./errors";

// Never open a local file on Vercel: each function instance has temporary storage.
async function store() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL)
    return import("./postgres-store");
  if (process.env.VERCEL)
    throw new ServiceError(
      "המשחק החי עדיין אינו מוגדר באתר. אפשר להמשיך במצב הדגמה.",
      "DATABASE_REQUIRED",
    );
  return import("./sqlite-store");
}
export async function newRoom(name: string) {
  return (await store()).newRoom(name);
}
export async function joinRoom(
  code: string,
  role: Role,
  name = "משתתפת",
  credential = "",
) {
  return (await store()).joinRoom(code, role, name, credential);
}
export async function recover(code: string, key: string) {
  return (await store()).recover(code, key);
}
export async function rateLimit(key: string, max: number) {
  return (await store()).rateLimit(key, max);
}
export async function readSnapshot(
  id: string,
  credential: string,
  projector?: string,
) {
  return (await store()).readSnapshot(id, credential, projector);
}
export async function command(
  id: string,
  credential: string,
  action: Action,
  commandId: string,
  revision: number,
) {
  return (await store()).command(id, credential, action, commandId, revision);
}
export async function checkDatabase() {
  return (await store()).checkDatabase();
}

export async function inspectRoom(code: string) {
  return (await store()).inspectRoom(code);
}
