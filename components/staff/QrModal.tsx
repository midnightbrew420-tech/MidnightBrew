"use client";
import { useEffect, useState, type MouseEvent } from "react";
import QRCode from "qrcode";
import { BRAND } from "@/lib/brand";

const FILE_NAME = `${BRAND.name.replace(/\s+/g, "-")}-QR.png`;

export default function QrModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [img, setImg] = useState("");
  // Prepared ahead of the tap: iPhone Safari only opens the share sheet if
  // navigator.share() is called straight from the tap, with nothing awaited first.
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const u = window.location.origin + "/";
    setUrl(u);
    QRCode.toDataURL(u, { width: 900, margin: 2, color: { dark: "#111111", light: "#ffffff" } }).then(async (dataUrl) => {
      setImg(dataUrl);
      try {
        const blob = await (await fetch(dataUrl)).blob();
        setFile(new File([blob], FILE_NAME, { type: "image/png" }));
      } catch {
        // No file: the button falls back to a normal download.
      }
    });
  }, []);

  // Phones and tablets (iPhone Safari ignores the download link): open the
  // share sheet, which offers Save Image, Print, AirDrop and so on.
  // Computers keep the normal file download.
  const shareFile = (e: MouseEvent) => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (!file || !touch || !navigator.canShare?.({ files: [file] })) return;
    e.preventDefault();
    navigator.share({ files: [file], title: `${BRAND.name} QR code` }).catch(() => {
      // Closing the share sheet is not an error.
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <h2>Ordering QR code</h2>
        <p className="muted" style={{ marginTop: 0 }}>One code for every table. Print it and place it on tables or the counter.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt="QR code" style={{ width: "100%", maxWidth: 320, borderRadius: 12 }} />}
        <div className="small muted" style={{ margin: "8px 0 4px", wordBreak: "break-all" }}>{url}</div>
        <div className="small muted" style={{ marginBottom: 14 }}>On a phone you can also press and hold the code to save it.</div>
        <div className="row">
          <a className="btn btn-primary grow" href={img} download={FILE_NAME} onClick={shareFile}>
            Save QR code
          </a>
          <button className="btn grow" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
