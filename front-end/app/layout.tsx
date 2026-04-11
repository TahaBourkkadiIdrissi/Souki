import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Souki Front-End',
  description: 'Application React Next.js pour le projet Souki',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
