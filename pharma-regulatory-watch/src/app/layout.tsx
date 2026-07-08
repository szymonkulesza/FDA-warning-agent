import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pharma Regulatory Watch — Rezon Bio',
  description:
    'Monitoring zmian w regulacjach prawnych przemysłu farmaceutycznego dla Rezon Bio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
