import type { MenuItem } from "@/lib/types";

export default function Thumb({ item, size = 92 }: { item: MenuItem; size?: number }) {
  const style = { width: size, height: size };
  if (item.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="thumb" style={style} src={item.image_url} alt={item.name} loading="lazy" />;
  }
  return (
    <div className="thumb" style={style} aria-hidden>
      {item.name.charAt(0)}
    </div>
  );
}
