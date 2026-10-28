"use client";
import { useEffect, useState } from "react";
import { Type } from "lucide-react";
export default function TextSizeControl() {
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const read = () => {
      let enabled = false;
      try {
        enabled = localStorage.getItem("hadar-large-text") === "true";
      } catch {}
      setLarge(enabled);
      document.documentElement.dataset.textSize = enabled ? "large" : "normal";
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);
  return (
    <button
      type="button"
      className="text-size-control no-print"
      aria-label="הגדלת טקסט"
      aria-pressed={large}
      title={large ? "חזרה לגודל טקסט רגיל" : "הגדלת טקסט"}
      onClick={() => {
        const next = !large;
        setLarge(next);
        document.documentElement.dataset.textSize = next ? "large" : "normal";
        try {
          localStorage.setItem("hadar-large-text", String(next));
        } catch {}
      }}
    >
      <Type size={20} aria-hidden="true" />
      <span>{large ? "טקסט מוגדל" : "הגדלת טקסט"}</span>
    </button>
  );
}
