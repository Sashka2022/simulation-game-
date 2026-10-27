import { Layers3 } from "lucide-react";
export default function NotFound() {
  return (
    <main id="main" className="loading-page">
      <Layers3 size={36} />
      <h1>החדר הזה לא נמצא</h1>
      <p>בדקו את הקישור שקיבלתן, או חזרו לעמוד הכניסה והזינו את קוד המפגש.</p>
      <a className="btn primary" href="/">
        לעמוד הכניסה
      </a>
    </main>
  );
}
