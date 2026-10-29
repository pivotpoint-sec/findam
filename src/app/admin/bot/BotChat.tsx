"use client";

import { useState } from "react";

type Reply = { type: "text"; body: string } | { type: "buttons"; body: string; buttons: { id: string; title: string }[] };
type Line = { who: "you" | "bot"; reply: Reply };

export function BotChat() {
  const [from, setFrom] = useState("08099990001");
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(payload: { text?: string; buttonId?: string; lat?: number; lng?: number }, shown: string) {
    setBusy(true);
    setError(null);
    setLines((l) => [...l, { who: "you", reply: { type: "text", body: shown } }]);
    try {
      const res = await fetch("/api/admin/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setLines((l) => [...l, ...(json.replies as Reply[]).map((r) => ({ who: "bot" as const, reply: r }))]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[14px] font-bold">
        Test from this WhatsApp number
        <input value={from} onChange={(e) => setFrom(e.target.value)} className="field font-normal" />
      </label>

      <div className="flex min-h-80 flex-col gap-2 rounded-2xl bg-[#efe8d6] p-3" aria-live="polite">
        {lines.length === 0 && <p className="m-auto text-[14px] text-muted">Send &quot;Hi&quot; to start.</p>}
        {lines.map((l, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[15px] leading-snug ${
              l.who === "you" ? "self-end rounded-tr-sm bg-[#dcf1e3]" : "self-start rounded-tl-sm bg-white"
            }`}
          >
            {l.reply.body}
            {l.reply.type === "buttons" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {l.reply.buttons.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={busy}
                    onClick={() => send({ buttonId: b.id, text: b.title }, b.title)}
                    className="chip border-brand text-brand"
                  >
                    {b.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-[14px] font-bold text-alert" role="alert">{error}</p>}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          send({ text: input }, input);
          setInput("");
        }}
      >
        <label htmlFor="msg" className="sr-only">Message</label>
        <input id="msg" value={input} onChange={(e) => setInput(e.target.value)} className="field flex-1" placeholder="Type a message" />
        <button className="btn btn-primary" disabled={busy}>Send</button>
      </form>
      <button
        type="button"
        className="btn btn-outline self-start"
        disabled={busy}
        onClick={() => send({ lat: 6.5958, lng: 3.3428 }, "[Location pin: Computer Village]")}
      >
        Send a test location pin
      </button>
    </div>
  );
}
