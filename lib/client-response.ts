/** Hosting gateways may return HTML on timeout; keep those diagnostics out of the UI. */
export async function responseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new Error("החיבור למשחק אינו זמין כרגע. נסו שוב בעוד רגע.");
  }
}
