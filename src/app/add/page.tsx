import { listAreas, listCategories, listMarketSections } from "@/lib/businesses";
import { BusinessForm } from "@/components/BusinessForm";
import { whatsappLink } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "List your business free" };

export default async function AddPage() {
  const [categories, areas, sections] = await Promise.all([listCategories(), listAreas(), listMarketSections()]);
  const botNumber = process.env.WHATSAPP_DISPLAY_NUMBER;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-tight">List your business free</h1>
        <p className="text-muted">Takes about 2 minutes. Customers will chat you on WhatsApp.</p>
      </div>
      {botNumber && (
        <a href={whatsappLink(botNumber, "Hi")} className="card flex items-center justify-between gap-3 p-4 hover:border-brand">
          <span>
            <span className="block font-bold">Easier on WhatsApp?</span>
            <span className="text-[14px] text-muted">Send &quot;Hi&quot; and our bot will list you in a chat.</span>
          </span>
          <span className="btn btn-sun">Open WhatsApp</span>
        </a>
      )}
      <BusinessForm categories={categories} areas={areas} sections={sections} />
    </div>
  );
}
