/** Provenance is independent of story branching and never inferred from wording. */
export type ContentKind =
  | "VERIFIED_FACT"
  | "PARTY_POSITION"
  | "FICTIONAL_SCENARIO"
  | "INTERPRETATION"
  | "HYPOTHETICAL_EFFECT";
export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED" | "STALE";
export type Source = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publicationDate: string | null;
  retrievedDate: string | null;
  type:
    "primary_platform" | "party_manifesto" | "research" | "secondary_report";
  status: VerificationStatus;
  excerpt?: string;
  limitations: string;
  verifiedBy?: string;
  verifiedAt?: string;
};
export type ContentClaim = {
  id: string;
  kind: ContentKind;
  text: string;
  sourceIds: string[];
  party?: string;
  quote?: string;
  limitations?: string;
};
export const kindLabels: Record<ContentKind, string> = {
  VERIFIED_FACT: "עובדה מאומתת",
  PARTY_POSITION: "עמדה מפלגתית מתועדת",
  FICTIONAL_SCENARIO: "תרחיש בדיוני / נתוני משחק",
  INTERPRETATION: "פרשנות מקצועית",
  HYPOTHETICAL_EFFECT: "תוצאה אפשרית בסימולציה",
};
export function verifiedSource(s: Source) {
  return (
    s.status === "VERIFIED" &&
    !!s.publisher &&
    !!s.title &&
    /^https:\/\//.test(s.url) &&
    !!s.publicationDate &&
    !!s.retrievedDate &&
    !!s.verifiedBy &&
    !!s.verifiedAt
  );
}
export function presentClaim(
  c: ContentClaim,
  sources: Source[],
): { label: string; text: string; sourceIds: string[]; pending: boolean } {
  const refs = c.sourceIds.map((id) => sources.find((s) => s.id === id));
  const ready = refs.length > 0 && refs.every((s) => s && verifiedSource(s));
  if (c.kind === "PARTY_POSITION") {
    const authentic =
      ready &&
      !!c.party &&
      !!c.quote &&
      refs.some((s) => s?.type === "party_manifesto" && s.excerpt === c.quote);
    if (!authentic)
      return {
        label: "ממתין לאימות",
        text: "עמדה מפלגתית לא תוצג לפני אימות המקור, התאריך והציטוט.",
        sourceIds: [],
        pending: true,
      };
  }
  if (c.kind === "VERIFIED_FACT" && !ready)
    throw Error("טענה אינה יכולה להיות מוצגת כעובדה מאומתת ללא מקורות מאומתים");
  if (
    (c.kind === "INTERPRETATION" || c.kind === "HYPOTHETICAL_EFFECT") &&
    !c.limitations
  )
    throw Error("נדרשת הסתייגות לפרשנות או לתוצאה אפשרית");
  return {
    label: kindLabels[c.kind],
    text: c.text,
    sourceIds: c.sourceIds,
    pending: false,
  };
}
export const initialSources: Source[] = [
  {
    id: "star",
    title: "Experimental Estimates of Education Production Functions",
    publisher: "NBER · Alan B. Krueger",
    url: "https://www.nber.org/papers/w6051",
    publicationDate: "1997-06",
    retrievedDate: null,
    type: "research",
    status: "PENDING",
    limitations: "יש לאמת את הסיכום, תנאי המחקר וההכללה לישראל.",
  },
  {
    id: "eef",
    title: "Reducing class size",
    publisher: "Education Endowment Foundation",
    url: "https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/reducing-class-size",
    publicationDate: null,
    retrievedDate: null,
    type: "research",
    status: "PENDING",
    limitations: "יש לבדוק את תאריך העדכון ואת הראיות שעליהן נשענת הסקירה.",
  },
];
