import { isLive } from "@/lib/whatsapp/client";
import { BotChat } from "./BotChat";

export default function BotTestPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[28px] font-extrabold">Bot test</h1>
        <p className="text-[14px] text-muted">
          Chat with the owner bot as if from WhatsApp. It uses the real database, so listings you create here are real:
          use a test number and close them afterwards. Photos can only be tested on real WhatsApp; reply SKIP here.
        </p>
        <p className="mt-1 text-[13px] font-bold">
          WhatsApp sending is {isLive() ? "ON (real messages go out from the webhook)" : "OFF (dev mode)"}.
        </p>
      </div>
      <BotChat />
    </div>
  );
}
