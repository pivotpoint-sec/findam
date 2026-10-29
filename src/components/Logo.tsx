import Link from "next/link";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <Link
      href="/"
      className="font-display font-extrabold tracking-tight text-brand"
      style={{ fontSize: size, letterSpacing: "-0.02em" }}
      aria-label="FindAm home"
    >
      Find<span className="ml-0.5 rounded-md bg-sun px-1.5 text-ink">Am</span>
    </Link>
  );
}
