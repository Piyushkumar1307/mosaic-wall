"use client";

import { useCallback, useEffect, useRef, useState, forwardRef } from "react";
import { createPortal } from "react-dom";
import type { Message } from "@/lib/db";

const MAX_SLOTS = 25;
const GRID_COLS = 5;
const CARD_W = 110;
const CARD_H = 154;
const FLOAT_PAD = 14;
const POP_MS = 1400;
const MOVE_MS = 900;
const POLL_MS = 300;
const ENTER_TIMEOUT_MS = POP_MS + MOVE_MS + 800;

type CardPhase = "entering" | "settled" | "exiting";

type DisplayCard = Message & { phase: CardPhase; displaySlot: number };

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickRandomEmptySlot(
  occupied: Set<number>,
  exitingSlots: number[],
  seed: number
): number {
  const empty: number[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    if (!occupied.has(i)) empty.push(i);
  }
  if (empty.length > 0) return empty[seed % empty.length];
  if (exitingSlots.length > 0) return exitingSlots[seed % exitingSlots.length];
  return seed % MAX_SLOTS;
}

function getDisplaySlot(card: DisplayCard): number {
  return card.displaySlot;
}

function cardsSnapshotEqual(a: DisplayCard[], b: DisplayCard[]): boolean {
  if (a.length !== b.length) return false;
  const byId = (list: DisplayCard[]) =>
    [...list].sort((x, y) => x.id - y.id);
  const aSorted = byId(a);
  const bSorted = byId(b);
  for (let i = 0; i < aSorted.length; i++) {
    const left = aSorted[i];
    const right = bSorted[i];
    if (
      left.id !== right.id ||
      left.phase !== right.phase ||
      left.displaySlot !== right.displaySlot
    ) {
      return false;
    }
  }
  return true;
}

const MosaicCard = forwardRef<
  HTMLDivElement,
  {
    message: DisplayCard;
    className?: string;
    style?: React.CSSProperties;
    onAnimationEnd?: (event: React.AnimationEvent<HTMLDivElement>) => void;
  }
>(function MosaicCard(
  { message, className = "", style, onAnimationEnd },
  ref
) {
  const displayName = message.name || "Guest";

  return (
    <div
      ref={ref}
      onAnimationEnd={onAnimationEnd}
      className={`mosaic-card flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-lg shadow-black/20 ${
        message.phase === "exiting" ? "animate-fade-out" : ""
      } ${className}`}
      style={style}
    >
      <div className="aspect-square w-full shrink-0 overflow-hidden bg-slate-100">
        {message.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.photo}
            alt={displayName}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">
            ?
          </div>
        )}
      </div>
      <div className="flex min-h-[48px] flex-1 flex-col justify-center bg-white px-1.5 py-1">
        <p className="text-center text-[10px] font-semibold leading-tight text-slate-800 sm:text-[11px] line-clamp-1">
          {displayName}
        </p>
        {message.text && (
          <p className="mt-0.5 text-center text-[9px] leading-tight text-slate-600 line-clamp-2">
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
});

function FloatingCard({ message }: { message: DisplayCard }) {
  const seed = hashString(`${message.id}`);
  const duration = 3.5 + (seed % 30) / 10;
  const delay = (seed % 20) / 10;

  return (
    <div
      className="floating-card-wrapper absolute inset-0 animate-card-float"
      style={
        {
          "--duration": `${duration}s`,
          "--delay": `${delay}s`,
        } as React.CSSProperties
      }
    >
      <MosaicCard message={message} className="h-full w-full" />
    </div>
  );
}

function EnteringCard({
  message,
  displaySlot,
  slotRefs,
  getCenterPoint,
  onComplete,
}: {
  message: DisplayCard;
  displaySlot: number;
  slotRefs: React.RefObject<(HTMLDivElement | null)[]>;
  getCenterPoint: () => { x: number; y: number };
  onComplete: (id: number) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const centerRef = useRef(getCenterPoint());
  const center = centerRef.current;

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(message.id);
  }, [message.id, onComplete]);

  useEffect(() => {
    const startLeft = center.x - CARD_W / 2;
    const startTop = center.y - CARD_H / 2;

    let finishTimer: ReturnType<typeof setTimeout>;
    const safetyTimer = setTimeout(finish, ENTER_TIMEOUT_MS);

    const popTimer = setTimeout(() => {
      const card = cardRef.current;
      const target = slotRefs.current[displaySlot];

      if (!card || !target) {
        finish();
        return;
      }

      const targetRect = target.getBoundingClientRect();

      card.classList.remove("animate-pop-enter");
      card.style.animation = "none";
      card.style.transform = "scale(1)";
      card.style.left = `${startLeft}px`;
      card.style.top = `${startTop}px`;
      card.style.transition = "none";

      void card.offsetHeight;

      card.style.transition = `left ${MOVE_MS}ms ease-in-out, top ${MOVE_MS}ms ease-in-out`;
      card.style.left = `${targetRect.left}px`;
      card.style.top = `${targetRect.top}px`;

      finishTimer = setTimeout(finish, MOVE_MS + 50);
    }, POP_MS);

    return () => {
      clearTimeout(popTimer);
      clearTimeout(finishTimer);
      clearTimeout(safetyTimer);
    };
  }, [displaySlot, message.id, slotRefs, finish, center]);

  return (
    <>
      <div className="enter-backdrop pointer-events-none fixed inset-0 z-[9998]" />
      <div
        ref={cardRef}
        className="pointer-events-none fixed z-[9999] animate-pop-enter"
        style={{
          left: center.x - CARD_W / 2,
          top: center.y - CARD_H / 2,
          width: CARD_W,
          height: CARD_H,
        }}
      >
        <MosaicCard message={message} className="h-full w-full" />
      </div>
    </>
  );
}

export default function DisplayPage() {
  const [cards, setCards] = useState<DisplayCard[]>([]);
  const [mounted, setMounted] = useState(false);
  const [gridScale, setGridScale] = useState(1);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>(
    Array.from({ length: MAX_SLOTS }, () => null)
  );
  const stuckTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const exitingTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const forceSettleStuck = useCallback((id: number) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === id && c.phase === "entering"
          ? { ...c, phase: "settled" as const }
          : c
      )
    );
  }, []);

  const getCenterPoint = useCallback(() => {
    const area = gridAreaRef.current;
    if (!area) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    const rect = area.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, []);

  const settleCard = useCallback((id: number) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, phase: "settled" as const } : c))
    );
  }, []);

  const settledBySlot = new Map<number, DisplayCard>();
  const enteringCards: DisplayCard[] = [];
  const exitingCards: DisplayCard[] = [];

  for (const card of cards) {
    const slot = getDisplaySlot(card);
    if (card.phase === "entering") {
      enteringCards.push(card);
    } else if (card.phase === "exiting") {
      exitingCards.push(card);
    } else {
      settledBySlot.set(slot, card);
    }
  }

  const activeEntering =
    enteringCards.length > 0
      ? enteringCards.reduce((earliest, card) =>
          card.id < earliest.id ? card : earliest
        )
      : null;

  const visibleCount = cards.filter((c) => c.phase !== "exiting").length;

  useEffect(() => {
    setMounted(true);
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function updateGridScale() {
      const area = gridAreaRef.current;
      if (!area) return;

      const gapX = 8;
      const gapY = 12;
      const gridW = GRID_COLS * CARD_W + (GRID_COLS - 1) * gapX;
      const gridH = GRID_COLS * CARD_H + (GRID_COLS - 1) * gapY;
      const availW = area.clientWidth;
      const availH = area.clientHeight - FLOAT_PAD * 2;

      setGridScale(Math.min(1, availW / gridW, availH / gridH));
    }

    updateGridScale();
    window.addEventListener("resize", updateGridScale);
    return () => window.removeEventListener("resize", updateGridScale);
  }, []);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/messages?_=${Date.now()}`, {
          cache: "no-store",
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        if (!res.ok || !active) return;
        const data = await res.json();
        const messages: Message[] = data.messages ?? [];

        setCards((prev) => {
          const next: DisplayCard[] = [];
          const exiting: DisplayCard[] = [];
          const isInitialLoad = !initialLoadDoneRef.current;

          const occupied = new Set<number>();
          for (const c of prev.filter((p) => p.phase !== "exiting")) {
            occupied.add(getDisplaySlot(c));
          }

          const exitingSlots = prev
            .filter((p) => p.phase === "exiting")
            .map((p) => getDisplaySlot(p));

          for (const msg of messages) {
            const existing = prev.find((c) => c.id === msg.id);

            if (existing) {
              next.push({
                ...msg,
                displaySlot: existing.displaySlot,
                phase:
                  existing.phase === "entering" ? "entering" : "settled",
              });
              knownIdsRef.current.add(msg.id);
            } else if (!isInitialLoad && !knownIdsRef.current.has(msg.id)) {
              const displaySlot = pickRandomEmptySlot(
                occupied,
                exitingSlots,
                hashString(String(msg.id))
              );
              occupied.add(displaySlot);
              knownIdsRef.current.add(msg.id);
              next.push({ ...msg, phase: "entering", displaySlot });
            } else {
              const displaySlot = pickRandomEmptySlot(
                occupied,
                exitingSlots,
                hashString(String(msg.id))
              );
              occupied.add(displaySlot);
              knownIdsRef.current.add(msg.id);
              next.push({ ...msg, phase: "settled", displaySlot });
            }
          }

          for (const card of prev) {
            if (
              card.phase !== "exiting" &&
              !messages.some((m) => m.id === card.id)
            ) {
              exiting.push({ ...card, phase: "exiting" });
            }
          }

          if (isInitialLoad) {
            initialLoadDoneRef.current = true;
          }

          const result = [...next, ...exiting];
          if (cardsSnapshotEqual(prev, result)) return prev;
          return result;
        });
      } catch {
        // ignore transient errors
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const enteringIds = new Set(
      cards.filter((c) => c.phase === "entering").map((c) => c.id)
    );

    for (const [id, timer] of stuckTimersRef.current) {
      if (!enteringIds.has(id)) {
        clearTimeout(timer);
        stuckTimersRef.current.delete(id);
      }
    }

    for (const card of cards) {
      if (card.phase !== "entering") continue;
      if (stuckTimersRef.current.has(card.id)) continue;

      const timer = setTimeout(() => {
        forceSettleStuck(card.id);
        stuckTimersRef.current.delete(card.id);
      }, ENTER_TIMEOUT_MS + 500);

      stuckTimersRef.current.set(card.id, timer);
    }
  }, [cards, forceSettleStuck]);

  useEffect(() => {
    const exitingIds = new Set(
      cards.filter((c) => c.phase === "exiting").map((c) => c.id)
    );

    for (const [id, timer] of exitingTimersRef.current) {
      if (!exitingIds.has(id)) {
        clearTimeout(timer);
        exitingTimersRef.current.delete(id);
      }
    }

    for (const card of cards) {
      if (card.phase !== "exiting") continue;
      if (exitingTimersRef.current.has(card.id)) continue;

      const timer = setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        exitingTimersRef.current.delete(card.id);
      }, 500);

      exitingTimersRef.current.set(card.id, timer);
    }
  }, [cards]);

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950">
      <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,#38bdf8_0%,transparent_40%),radial-gradient(circle_at_80%_70%,#a78bfa_0%,transparent_35%)]" />

      <header className="relative z-10 shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1 text-center sm:px-6">
        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
          Live Mosaic
        </p>
        <h1 className="mt-0.5 text-lg font-bold text-white sm:text-xl">
          Photo Wall
        </h1>
        <p className="mt-0.5 text-[10px] text-slate-400 sm:text-xs">
          Showing latest {visibleCount} of 25 entries
        </p>
      </header>

      <div
        ref={gridAreaRef}
        className="relative z-0 mx-auto flex w-full max-w-4xl flex-1 min-h-0 items-center justify-center overflow-visible px-2 pb-2 sm:px-4"
        style={{ paddingTop: FLOAT_PAD, paddingBottom: FLOAT_PAD }}
      >
        <div
          className="grid gap-x-2 gap-y-3 sm:gap-x-3 sm:gap-y-4"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, ${CARD_W}px)`,
            gridTemplateRows: `repeat(${GRID_COLS}, ${CARD_H}px)`,
            transform: `scale(${gridScale})`,
            transformOrigin: "center center",
          }}
        >
          {Array.from({ length: MAX_SLOTS }, (_, slot) => {
            const card = settledBySlot.get(slot);
            const enteringAtSlot = enteringCards.find(
              (c) => getDisplaySlot(c) === slot
            );
            const exitingAtSlot = exitingCards.find(
              (c) => getDisplaySlot(c) === slot
            );
            const isActiveEntering = enteringAtSlot?.id === activeEntering?.id;

            return (
              <div
                key={slot}
                ref={(el) => {
                  slotRefs.current[slot] = el;
                }}
                className="relative overflow-visible"
                style={{ width: CARD_W, height: CARD_H }}
              >
                {exitingAtSlot && (
                  <div className="absolute inset-0">
                    <MosaicCard message={exitingAtSlot} className="h-full w-full" />
                  </div>
                )}
                {card && !exitingAtSlot && (
                  <FloatingCard message={card} />
                )}
                {enteringAtSlot &&
                  !exitingAtSlot &&
                  !isActiveEntering && (
                    <FloatingCard
                      message={{ ...enteringAtSlot, phase: "settled" }}
                    />
                  )}
              </div>
            );
          })}
        </div>

        {mounted &&
          activeEntering &&
          createPortal(
            <EnteringCard
              key={activeEntering.id}
              message={activeEntering}
              displaySlot={getDisplaySlot(activeEntering)}
              slotRefs={slotRefs}
              getCenterPoint={getCenterPoint}
              onComplete={settleCard}
            />,
            document.body
          )}

        {visibleCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <p className="text-center text-base text-slate-500 sm:text-lg">
              Waiting for photos...
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
