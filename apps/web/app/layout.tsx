import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OpsPilot AI',
  description: 'AI-Powered Incident Intelligence for Modern Engineering Teams',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
