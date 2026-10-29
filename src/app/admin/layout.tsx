import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/pending", label: "New listings" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/stale", label: "To revisit" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/add", label: "Agent: add" },
  { href: "/admin/bot", label: "Bot test" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Admin" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="chip shrink-0 whitespace-nowrap">
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
