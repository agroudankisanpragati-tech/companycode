import type { Metadata, Viewport } from 'next';
// @ts-ignore: allow side-effect CSS import without module declarations
import '../styles/globals.css';
import { AdminProvider } from '@/components/admin/AdminProvider';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Agroudan Kisan Pragati Admin',
  description: 'Admin dashboard for Agroudan Kisan Pragati',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AdminProvider>{children}</AdminProvider>
      </body>
    </html>
  );
}