import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FindAm: find any business in Lagos", template: "%s · FindAm" },
  description:
    "Find verified businesses across Lagos, even the ones without an address. Landmark directions, market shop numbers and WhatsApp contact.",
  applicationName: "FindAm",
};

export const viewport: Viewport = {
  themeColor: "#0B6B3A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=DM+Sans:wght@400;500;700&display=swap"
        />
      </head>
      <body className="min-h-dvh bg-cream text-ink">
        <header className="border-b border-line bg-cream/95 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
            <Logo />
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
              <Link href="/search" className="btn">Search</Link>
              <Link href="/markets" className="btn">Markets</Link>
              <Link href="/add" className="btn btn-primary">List your business</Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 pb-8 pt-5 sm:pb-12">{children}</main>

        <footer className="mx-auto flex max-w-3xl flex-col gap-1 px-4 pb-28 text-[13px] text-muted sm:pb-10">
          <p>
            FindAm · Lagos · <Link href="/add" className="underline">List your business free</Link> ·{" "}
            <Link href="/privacy" className="underline">Privacy</Link>
          </p>
          <p>
            Some listings use data from{" "}
            <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noopener">
              © OpenStreetMap contributors
            </a>
            .
          </p>
        </footer>

        {/* Bottom navigation on phones */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-white px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 sm:hidden"
        >
          {[
            { href: "/", label: "Home", icon: "home" as const },
            { href: "/search", label: "Search", icon: "search" as const },
            { href: "/markets", label: "Markets", icon: "market" as const },
            { href: "/add", label: "List free", icon: "plus" as const },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-xs font-bold text-muted"
            >
              <Icon name={item.icon} size={22} />
              {item.label}
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}
