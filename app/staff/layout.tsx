import type { Metadata } from "next";

// "Add to Home Screen" on the staff page installs the staff app (opens /staff),
// which is what iPhones and iPads need for push notifications.
export const metadata: Metadata = {
  title: "Midnight Brew Staff",
  manifest: "/staff.webmanifest",
  appleWebApp: { capable: true, title: "MB Staff", statusBarStyle: "default" },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
