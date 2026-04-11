import './globals.css';
import { Manrope } from 'next/font/google';
import AuthenticatedShell from './components/authenticated-shell';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'SmartHire AI',
  description: 'Resume analysis and job matching',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={manrope.className}>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </body>
    </html>
  );
}