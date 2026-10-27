"use client";
import { RotateCcw } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="loading-page">
      <RotateCcw size={32} />
      <h1>נדרש רגע לחיבור מחדש</h1>
      <p>
        לא הצלחנו להציג את המסך. החלטות שכבר אושרו נשמרו בשרת; טיוטות במכשיר
        יישארו זמינות באותו דפדפן.
      </p>
      <button className="btn primary" onClick={reset}>
        ניסיון חוזר
      </button>
      <a href="/">חזרה לכניסה</a>
    </main>
  );
}
