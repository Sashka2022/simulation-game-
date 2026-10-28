import { test, expect, type APIRequestContext } from "@playwright/test";
import { performance } from "node:perf_hooks";
for (const size of [5, 10, 20, 40, 60])
  test(`${size} independent HTTP clients: shared state, unequal groups and exactly one official submission`, async ({
    playwright,
    baseURL,
  }) => {
    test.setTimeout(120000);
    const host = await playwright.request.newContext({ baseURL });
    const clients: APIRequestContext[] = [];
    let id = "";
    try {
      const create = await host.post("/api/session", {
        data: { type: "create", name: `עומס ${size}` },
      });
      expect(create.ok(), await create.text()).toBeTruthy();
      const room = await create.json();
      id = room.id;
      const url = "/api/room/" + id;
      const read = async (c: APIRequestContext) => {
        const response = await c.get(url);
        expect(response.ok(), await response.text()).toBeTruthy();
        return response.json();
      };
      let s = await read(host);
      const code = s.code;
      const roles = ["MOE", "FIN", "UNION", "LOCAL", "PRINCIPALS"];
      for (let i = 0; i < size; i++)
        clients.push(await playwright.request.newContext({ baseURL }));
      const joins = await Promise.all(
        clients.map((c, i) =>
          c.post("/api/session", {
            data: {
              type: "join",
              name: `מורה ${i}`,
              code,
              role: roles[i < 5 ? i : 0],
            },
          }),
        ),
      );
      for (const response of joins)
        expect(response.ok(), await response.text()).toBeTruthy();
      s = await read(host);
      expect(s.membership.members).toHaveLength(size);
      expect(
        s.teams.find((t: { role: string }) => t.role === "MOE").count,
      ).toBe(size - 4);
      for (const type of ["start", "advance"]) {
        const response = await host.post(url, {
          data: {
            commandId: crypto.randomUUID(),
            revision: s.revision,
            action: { type },
          },
        });
        expect(response.ok()).toBeTruthy();
        s = await read(host);
      }
      const snapshots = await Promise.all(clients.map((c) => read(c)));
      for (const snap of snapshots) expect(snap.phase).toBe("CRISIS1");
      const group = clients.filter((_, i) => i === 0 || i >= 5);
      const attempts = await Promise.all(
        group.map((c) =>
          c.post(url, {
            data: {
              commandId: crypto.randomUUID(),
              revision: s.revision,
              action: {
                type: "proposal",
                roleScope: "MOE",
                option: "A",
                action: "שימור",
                price: "זמן",
                condition: "תקציב",
                owner: "חינוך",
              },
            },
          }),
        ),
      );
      expect(attempts.filter((r) => r.ok())).toHaveLength(1);
      s = await read(host);
      expect(
        s.proposals.filter(
          (p: { team: string; phase: string }) =>
            p.team === "MOE" && p.phase === "CRISIS1",
        ),
      ).toHaveLength(1);
      const times: number[] = [];
      for (let round = 0; round < 3; round++)
        await Promise.all(
          clients.map(async (c) => {
            const start = performance.now();
            const snap = await read(c);
            times.push(performance.now() - start);
            expect(snap.proposals).toHaveLength(1);
          }),
        );
      times.sort((a, b) => a - b);
      console.log(
        JSON.stringify({
          httpClients: size,
          snapshotP50Ms: Math.round(times[Math.floor(times.length * 0.5)]),
          snapshotP95Ms: Math.round(times[Math.floor(times.length * 0.95)]),
          errors: 0,
        }),
      );
    } finally {
      if (id) {
        const s = await (await host.get("/api/room/" + id)).json();
        await host.post("/api/room/" + id, {
          data: {
            commandId: crypto.randomUUID(),
            revision: s.revision,
            action: { type: "delete" },
          },
        });
      }
      await Promise.all([host, ...clients].map((c) => c.dispose()));
    }
  });
