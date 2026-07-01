"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/db";

const GRID_POSITIONS = [
  { top: "6%", left: "4%", width: "18%" },
  { top: "8%", left: "26%", width: "16%" },
  { top: "5%", left: "48%", width: "17%" },
  { top: "7%", left: "70%", width: "15%" },
  { top: "6%", left: "88%", width: "10%" },
  { top: "28%", left: "2%", width: "17%" },
  { top: "30%", left: "22%", width: "18%" },
  { top: "27%", left: "44%", width: "16%" },
  { top: "29%", left: "64%", width: "17%" },
  { top: "28%", left: "85%", width: "12%" },
  { top: "50%", left: "5%", width: "16%" },
  { top: "52%", left: "25%", width: "17%" },
  { top: "49%", left: "46%", width: "18%" },
  { top: "51%", left: "68%", width: "15%" },
  { top: "50%", left: "86%", width: "12%" },
  { top: "72%", left: "3%", width: "17%" },
  { top: "74%", left: "24%", width: "16%" },
  { top: "71%", left: "44%", width: "17%" },
  { top: "73%", left: "65%", width: "16%" },
  { top: "72%", left: "84%", width: "13%" },
  { top: "90%", left: "8%", width: "15%" },
  { top: "91%", left: "28%", width: "16%" },
  { top: "89%", left: "48%", width: "17%" },
  { top: "90%", left: "68%", width: "16%" },
  { top: "91%", left: "86%", width: "12%" },
];

type DisplayCard = Message & { exiting?: boolean };

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function MessageCard({ message }: { message: DisplayCard }) {
  const pos = GRID_POSITIONS[message.slot];
  const seed = hashString(`${message.id}-${message.slot}`);
  const rotate = ((seed % 7) - 3) * 1.2;
  const duration = 3.5 + (seed % 30) / 10;
  const delay = (seed % 20) / 10;
  const displayName = message.name || "Guest";

  return (
    <div
      className={`absolute pointer-events-none ${
        message.exiting ? "animate-fade-out" : "animate-fade-in"
      }`}
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div
        className="animate-float overflow-hidden rounded-xl bg-white shadow-xl shadow-black/20 border border-slate-200/80"
        style={
          {
            "--rotate": `${rotate}deg`,
            "--duration": `${duration}s`,
            "--delay": `${delay}s`,
          } as React.CSSProperties
        }
      >
        {message.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.photo}
            alt={displayName}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="aspect-square w-full bg-slate-100 flex items-center justify-center text-slate-400 text-2xl">
            ?
          </div>
        )}
        <p className="px-2 pt-2 text-slate-800 text-xs sm:text-sm font-semibold leading-snug break-words text-center">
          {displayName}
        </p>
        {message.text && (
          <p className="px-2 pb-2 text-slate-600 text-[10px] sm:text-xs leading-snug break-words text-center line-clamp-3">
            {message.text}
          </p>
        )}
        {!message.text && <div className="pb-1" />}
      </div>
    </div>
  );
}

export default function DisplayPage() {
  const [cards, setCards] = useState<DisplayCard[]>([]);
  const prevBySlotRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/messages", { cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json();
        const messages: Message[] = data.messages ?? [];

        setCards((prev) => {
          const prevBySlot = new Map(prev.map((c) => [c.slot, c]));
          const next: DisplayCard[] = [];
          const exiting: DisplayCard[] = [];

          for (const msg of messages) {
            const previous = prevBySlot.get(msg.slot);
            if (previous && previous.id !== msg.id) {
              exiting.push({ ...previous, exiting: true });
            }
            const wasSeen = previous?.id === msg.id;
            next.push(wasSeen ? { ...msg, exiting: false } : { ...msg });
          }

          for (const card of prev) {
            if (!messages.some((m) => m.slot === card.slot) && !card.exiting) {
              exiting.push({ ...card, exiting: true });
            }
          }

          prevBySlotRef.current = new Map(messages.map((m) => [m.slot, m.id]));
          return [...next, ...exiting];
        });
      } catch {
        // ignore transient errors
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const card of cards) {
      if (card.exiting) {
        timers.push(
          setTimeout(() => {
            setCards((prev) => prev.filter((c) => c.id !== card.id || !c.exiting));
          }, 500)
        );
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [cards]);

  const visibleCount = cards.filter((c) => !c.exiting).length;

  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,#38bdf8_0%,transparent_40%),radial-gradient(circle_at_80%_70%,#a78bfa_0%,transparent_35%)]" />

      <header className="relative z-10 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-4 text-center sm:px-6">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
          Live Mosaic
        </p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mt-2">
          Photo Wall
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Showing latest {visibleCount} of 25 entries
        </p>
      </header>

      <div className="relative z-0 mx-auto h-[calc(100dvh-120px)] max-w-7xl">
        {cards.map((message) => (
          <MessageCard
            key={`${message.id}-${message.exiting ? "out" : "in"}`}
            message={message}
          />
        ))}

        {visibleCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <p className="text-slate-500 text-base sm:text-lg text-center">
              Waiting for photos...
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
