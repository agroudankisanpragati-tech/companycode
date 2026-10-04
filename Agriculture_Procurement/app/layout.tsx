import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAPP | Agricultural Procurement",
  description: "Secure crop procurement, transaction-linked settlement, notifications, grievances, and analytics.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  );
}
