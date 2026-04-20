import './globals.css';
import { Manrope } from 'next/font/google';
import AuthenticatedShell from './components/authenticated-shell';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
});

const siteUrl = new URL('https://smarthire-ai-lrq8.vercel.app');

export const metadata = {
  metadataBase: siteUrl,
  title: 'SmartHire AI — Enterprise Hiring Intelligence',
  description: 'AI-powered resume analysis, candidate scoring, and skill gap planning for multinational hiring teams.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'SmartHire AI — Enterprise Hiring Intelligence',
    description: 'AI-powered resume analysis, candidate scoring, and skill gap planning for multinational hiring teams.',
    images: ['/og-image.svg'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SmartHire AI — Enterprise Hiring Intelligence',
    description: 'AI-powered resume analysis, candidate scoring, and skill gap planning for multinational hiring teams.',
    images: ['/og-image.svg'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`smarthire-dark ${manrope.className}`}>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </body>
    </html>
  );
}