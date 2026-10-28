import { readSnapshot, command, closeDatabase } from "../lib/postgres-store";
process.on(
  "message",
  async (message: {
    id: string;
    credential: string;
    action?: Record<string, unknown>;
    commandId: string;
    revision: number;
  }) => {
    try {
      if (message.action)
        await command(
          message.id,
          message.credential,
          message.action as { type: string },
          message.commandId,
          message.revision,
        );
      const s = await readSnapshot(message.id, message.credential);
      process.send?.({ ok: true, revision: s.revision, phase: s.phase });
    } catch (e) {
      process.send?.({ ok: false, error: (e as Error).message });
    } finally {
      await closeDatabase();
      process.disconnect();
    }
  },
);
