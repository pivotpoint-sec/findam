import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { listAreas, listCategories, listMarketSections } from "@/lib/businesses";
import { displayPhone } from "@/lib/format";
import { updateListing } from "../../actions";

type Row = {
  id: string; name: string; description: string | null; landmark_directions: string | null;
  shop_number: string | null; whatsapp: string | null; phone: string | null; hours_note: string | null;
  price_min_ngn: number | null; price_max_ngn: number | null; category_id: number | null;
  area_id: number | null; market_section_id: number | null;
};

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [b, categories, areas, sections] = await Promise.all([
    queryOne<Row>(
      `SELECT id, name, description, landmark_directions, shop_number, whatsapp, phone, hours_note,
              price_min_ngn, price_max_ngn, category_id, area_id, market_section_id
       FROM businesses WHERE id = $1`,
      [id],
    ),
    listCategories(),
    listAreas(),
    listMarketSections(),
  ]);
  if (!b) notFound();

  const input = (name: keyof Row, label: string, value: string | number | null) => (
    <label className="flex flex-col gap-1 text-[14px] font-bold">
      {label}
      <input name={name} defaultValue={value ?? ""} className="field font-normal" />
    </label>
  );

  return (
    <form action={updateListing} className="flex flex-col gap-4">
      <h1 className="font-display text-[28px] font-extrabold">Edit {b.name}</h1>
      <input type="hidden" name="id" value={b.id} />
      {input("name", "Name", b.name)}
      {input("description", "Description", b.description)}
      <label className="flex flex-col gap-1 text-[14px] font-bold">
        Landmark directions
        <textarea name="landmark_directions" defaultValue={b.landmark_directions ?? ""} className="field min-h-24 font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-[14px] font-bold">
        Category
        <select name="category_id" defaultValue={b.category_id ?? ""} className="field font-normal">
          {categories.filter((c) => c.parent_id).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[14px] font-bold">
        Area
        <select name="area_id" defaultValue={b.area_id ?? ""} className="field font-normal">
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[14px] font-bold">
        Market section
        <select name="market_section_id" defaultValue={b.market_section_id ?? ""} className="field font-normal">
          <option value="">Not in a market</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>
      {input("shop_number", "Shop number", b.shop_number)}
      {input("whatsapp", "WhatsApp", displayPhone(b.whatsapp))}
      {input("phone", "Phone", displayPhone(b.phone))}
      {input("hours_note", "Hours", b.hours_note)}
      <div className="grid grid-cols-2 gap-3">
        {input("price_min_ngn", "Lowest price (₦)", b.price_min_ngn)}
        {input("price_max_ngn", "Highest price (₦)", b.price_max_ngn)}
      </div>
      <button className="btn btn-primary self-start">Save changes</button>
    </form>
  );
}
