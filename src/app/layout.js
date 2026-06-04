'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/vocabulary',  label: 'Dictionary'  },
  { href: '/quiz',        label: 'Quiz'        },
  { href: '/speaking',    label: 'Speaking'    },
  { href: '/listening',   label: 'Listening'   },
  { href: '/conversation',label: 'Conversation'},
  { href: '/translate',   label: '🇻🇳 Translate' },
];

function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="navbar">
      <Link href="/" className="nav-logo">Lumina.</Link>
      <div className="nav-links">
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-link ${pathname === href ? 'active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Lumina | Premium English Learning Platform</title>
        <meta name="description" content="Master English with AI-powered vocabulary, speaking, and listening tools." />
      </head>
      <body suppressHydrationWarning>
        <div className="aurora" />
        <div className="app-wrap">
          <Navbar />
          <main className="page-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
