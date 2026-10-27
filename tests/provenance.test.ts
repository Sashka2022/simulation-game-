import { test } from "node:test";
import assert from "node:assert/strict";
import { presentClaim, initialSources, type Source } from "../lib/provenance";
test("pending or stale sources cannot establish verified authority", () => {
  assert.throws(() =>
    presentClaim(
      {
        id: "authority",
        kind: "VERIFIED_FACT",
        text: "סמכות כלשהי",
        sourceIds: ["eef"],
      },
      initialSources,
    ),
  );
});
test("unverified party quotation and attribution are withheld, not merely styled as pending", () => {
  const c = presentClaim(
    {
      id: "party",
      kind: "PARTY_POSITION",
      text: "טענה לא מאומתת",
      sourceIds: ["missing"],
      party: "מפלגה",
      quote: "ציטוט מומצא",
    },
    [],
  );
  assert.equal(c.pending, true);
  assert.ok(!c.text.includes("ציטוט מומצא"));
  assert.ok(!c.text.includes("טענה לא מאומתת"));
  assert.deepEqual(c.sourceIds, []);
});
test("fiction stays labeled and hypothetical effects require a limitation", () => {
  assert.match(
    presentClaim(
      {
        id: "school",
        kind: "FICTIONAL_SCENARIO",
        text: "68 תלמידים",
        sourceIds: [],
      },
      [],
    ).label,
    /בדיוני/,
  );
  assert.throws(() =>
    presentClaim(
      {
        id: "future",
        kind: "HYPOTHETICAL_EFFECT",
        text: "עשוי להשתפר",
        sourceIds: [],
      },
      [],
    ),
  );
});
test("party quote must exactly match a verified primary source", () => {
  const source: Source = {
    id: "p",
    title: "מסמך לדוגמה לבדיקה",
    publisher: "מפרסם לבדיקה",
    url: "https://example.org/platform",
    publicationDate: "2026-01-01",
    retrievedDate: "2026-10-27",
    type: "party_manifesto",
    status: "VERIFIED",
    excerpt: "ציטוט קצר לבדיקה",
    limitations: "בדיקת מנגנון בלבד",
    verifiedBy: "test",
    verifiedAt: "2026-10-27",
  };
  const claim = {
    id: "c",
    kind: "PARTY_POSITION" as const,
    text: "טקסט לבדיקה",
    sourceIds: ["p"],
    party: "גוף לבדיקה",
    quote: "ציטוט קצר לבדיקה",
  };
  assert.equal(presentClaim(claim, [source]).pending, false);
  assert.equal(
    presentClaim({ ...claim, quote: "ציטוט ששונה" }, [source]).pending,
    true,
  );
});
