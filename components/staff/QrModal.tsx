"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BRAND } from "@/lib/brand";

export default function QrModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [img, setImg] = useState("");

  useEffect(() => {
    const u = window.location.origin + "/";
    setUrl(u);
    QRCode.toDataURL(u, { width: 900, margin: 2, color: { dark: "#111111", light: "#ffffff" } }).then(setImg);
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <h2>Ordering QR code</h2>
        <p className="muted" style={{ marginTop: 0 }}>One code for every table. Print it and place it on tables or the counter.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt="QR code" style={{ width: "100%", maxWidth: 320, borderRadius: 12 }} />}
        <div className="small muted" style={{ margin: "8px 0 14px", wordBreak: "break-all" }}>{url}</div>
        <div className="row">
          <a className="btn btn-primary grow" href={img} download={`${BRAND.name.replace(/\s+/g, "-")}-QR.png`}>Download PNG</a>
          <button className="btn grow" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
