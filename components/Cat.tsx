// Loafing black cat with a crescent moon, from the Midnight Brew menu art.
export default function Cat({ className, size = 64 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size * 0.75} viewBox="0 0 120 90" aria-hidden>
      <path d="M100 22a7 7 0 1 0 6 11a5.5 5.5 0 1 1-6-11z" fill="currentColor" />
      <path d="M86 12l1.2 3.2 3.3 1.2-3.3 1.2L86 21l-1.2-3.4-3.3-1.2 3.3-1.2z" fill="currentColor" />
      <path
        d="M18 84c-8 0-10-10-6-22 5-14 16-22 30-24l2-16 10 11c5-1 10-1 15 0l10-11 2 16c14 3 22 15 23 30 1 10-2 16-9 16z"
        fill="currentColor"
      />
      <path d="M100 74c9-2 14-10 12-20" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="52" rx="5.5" ry="6.5" fill="#fff" />
      <ellipse cx="76" cy="52" rx="5.5" ry="6.5" fill="#fff" />
      <circle cx="51" cy="53" r="3.2" fill="currentColor" />
      <circle cx="75" cy="53" r="3.2" fill="currentColor" />
      <path d="M60 62l3 2.5 3-2.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M40 60l-12-2M40 64l-12 2M86 60l12-2M86 64l12 2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
