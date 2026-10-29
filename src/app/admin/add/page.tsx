import { listAreas, listCategories, listMarketSections } from "@/lib/businesses";
import { BusinessForm } from "@/components/BusinessForm";

export default async function AgentAddPage() {
  const [categories, areas, sections] = await Promise.all([listCategories(), listAreas(), listMarketSections()]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[28px] font-extrabold">Add a verified business</h1>
        <p className="text-[14px] text-muted">
          For field agents on a visit. Stand at the entrance, drop the pin, take the entrance photo. The listing goes live
          with the &quot;Visited by FindAm agent&quot; badge. When the owner messages our WhatsApp from the same number, it links to them.
        </p>
      </div>
      <BusinessForm categories={categories} areas={areas} sections={sections} mode="agent" />
    </div>
  );
}
