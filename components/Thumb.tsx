import type { MenuItem } from "@/lib/types";

// Line drawings that now have a real picture next to them in /public/menu/.
// An item still pointing at one of these drawings shows the picture instead,
// so the menu looks right even before (or without) the database update.
const HAS_PHOTO = new Set([
  "americano-yuzu", "cappuccino", "coconut-americano", "eight-coffee",
  "extra-shot", "hash-browns", "lemon-soda", "oat-milk",
]);

function photoFor(url: string) {
  const m = url.match(/\/menu\/([a-z0-9-]+)\.svg$/);
  return m && HAS_PHOTO.has(m[1]) ? url.replace(/\.svg$/, ".jpg") : url;
}

export default function Thumb({ item, size = 92 }: { item: MenuItem; size?: number }) {
  const style = { width: size, height: size };
  if (item.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="thumb" style={style} src={photoFor(item.image_url)} alt={item.name} loading="lazy" />;
  }
  return (
    <div className="thumb" style={style} aria-hidden>
      {item.name.charAt(0)}
    </div>
  );
}
