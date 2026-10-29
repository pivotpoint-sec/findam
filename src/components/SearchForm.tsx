import { Icon } from "./Icon";

type Area = { slug: string; name: string };

/** Plain GET form so search works even before JavaScript loads. */
export function SearchForm({
  areas,
  q = "",
  area = "",
  hidden = {},
}: {
  areas: Area[];
  q?: string;
  area?: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action="/search" method="get" role="search" className="card flex flex-col gap-2.5 p-3">
      <label htmlFor="q" className="sr-only">What do you need?</label>
      <div className="flex min-h-12 items-center gap-2.5 rounded-xl bg-sand px-3">
        <Icon name="search" />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Phone screen, AC repair, buka…"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#6b746f]"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="area" className="sr-only">Area</label>
        <div className="flex flex-1 items-center gap-1.5 pl-1 text-[14px] text-muted">
          <Icon name="pin" size={16} className="text-brand" />
          <select
            id="area"
            name="area"
            defaultValue={area}
            className="min-h-11 min-w-0 flex-1 rounded-lg bg-transparent text-[14px] text-ink"
          >
            <option value="">All of Lagos</option>
            {areas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <button type="submit" className="btn btn-primary px-6">Find am</button>
      </div>
    </form>
  );
}
