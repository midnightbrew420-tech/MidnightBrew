"use client";
import { useLang } from "@/lib/i18n";

// ไทย / EN switch, shown next to the cart (customers) and in the staff header.
export default function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label="Language / ภาษา">
      <button type="button" className={lang === "th" ? "on" : ""} aria-pressed={lang === "th"} onClick={() => setLang("th")}>
        ไทย
      </button>
      <button type="button" className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>
        EN
      </button>
    </div>
  );
}
