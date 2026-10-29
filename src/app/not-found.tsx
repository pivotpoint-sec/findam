import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h1 className="font-display text-[32px] font-extrabold">We no see am.</h1>
      <p className="text-muted">That page or listing doesn&apos;t exist, or it has closed.</p>
      <Link href="/search" className="btn btn-primary">Search FindAm</Link>
    </div>
  );
}
