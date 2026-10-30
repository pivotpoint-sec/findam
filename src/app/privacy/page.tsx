import Link from "next/link";

export const metadata = { title: "Privacy" };
// Read the contact details from the environment at request time, not build time.
export const dynamic = "force-dynamic";

// A plain-language notice covering what the Nigeria Data Protection Act 2023
// asks for: who we are, what we collect and why, where it comes from, how
// long we keep it, people's rights, and how to complain.
// Set PRIVACY_CONTACT_EMAIL (and ideally PRIVACY_CONTACT_PHONE) in .env.
// Have a Nigerian data protection lawyer review this before launch.

export default function PrivacyPage() {
  const email = process.env.PRIVACY_CONTACT_EMAIL || "[set PRIVACY_CONTACT_EMAIL]";
  const phone = process.env.PRIVACY_CONTACT_PHONE;

  return (
    <article className="flex flex-col gap-4 leading-relaxed">
      <h1 className="font-display text-[28px] font-extrabold">Privacy</h1>

      <section>
        <h2 className="text-lg font-bold">Who we are</h2>
        <p>
          FindAm is a directory of businesses in Lagos. Contact us about your data at{" "}
          <a href={`mailto:${email}`} className="underline">{email}</a>
          {phone ? ` or ${phone}` : ""}.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Business listings</h2>
        <p>
          Listings show a business&apos;s name, what it does, where to find it and how to contact it. This comes from
          the owner, from our field agents, or from public sources such as{" "}
          <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noopener">
            OpenStreetMap
          </a>
          . Each listing says where its details came from, and listings from public sources are marked
          &quot;Unverified&quot; until the owner claims them or an agent visits.
        </p>
        <p>
          We show these details so people can find and contact local businesses, which is what a directory is
          for. If a phone number belongs to you as a person, you can ask us to correct it, hide it or remove the
          listing at any time: use &quot;Ask us to remove it&quot; on the listing, or contact us. We call to confirm it&apos;s
          you, then act within 7 days, and a removed listing is not added back by later imports.
        </p>
        <p>Listings nobody has confirmed for 90 days are hidden from search.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold">People using FindAm</h2>
        <p>
          Your location is only used for the search you&apos;re doing and is never stored. When you tap WhatsApp,
          call or directions, we record that a tap happened (with an anonymous browser id, not your name or
          number) so owners can see how many people found them and so only real customers can review. Reviews show
          the first name you give.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Business owners on WhatsApp</h2>
        <p>
          If you message our WhatsApp, we use your number to manage your listing and send you a weekly check
          message. Reply STOP to turn the weekly message off. We never message a number that hasn&apos;t messaged us
          first.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold">Your rights</h2>
        <p>
          You can ask what we hold about you, where we got it, and to correct, hide or delete it, or object to how
          we use it. If you&apos;re not happy with our answer, you can complain to the Nigeria Data Protection
          Commission.
        </p>
      </section>

      <Link href="/" className="btn btn-outline self-start">Back to FindAm</Link>
    </article>
  );
}
