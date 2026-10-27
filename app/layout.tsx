import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "חדר המצב — רפורמה תחת לחץ",
  description:
    "משחק תפקידים חינוכי על החלטות, אחריות ומה שביניהן. חמש משלחות. שישים דקות. מערכת אחת.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <a className="skip-link" href="#main">
          דילוג לתוכן
        </a>
        {children}
      </body>
    </html>
  );
}
