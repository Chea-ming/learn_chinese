import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '汉语 – Learn Mandarin',
  description: 'Learn Mandarin Chinese phrase by phrase.',
};

interface Crumb {
  label: string;
  href?: string;
}

// The header is a server component; breadcrumbs are passed as props from each page layout.
// Because the header needs crumbs from the current route, each page renders the header directly.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

// ── Shared Header component (used by every page as a server component) ──
export function SiteHeader({ crumbs = [] }: { crumbs?: Crumb[] }) {
  return (
    <header>
      <Link href="/" className="logo">
        <span className="logo-zh">汉语</span>
        <span className="logo-en">Hànyǔ</span>
      </Link>

      {crumbs.length > 0 && (
        <nav className="breadcrumb" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="crumb-sep">/</span>}
              {c.href ? (
                <Link href={c.href} className="crumb">{c.label}</Link>
              ) : (
                <span className="crumb last">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
    </header>
  );
}
