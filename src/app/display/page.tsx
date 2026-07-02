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
const MOVE_MS = 1000;
const POLL_MS = 500;

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
  getCenterPoint,
  getSlotElement,
  onComplete,
}: {
  message: DisplayCard;
  getCenterPoint: () => { x: number; y: number };
  getSlotElement: () => HTMLDivElement | null;
  onComplete: (id: number) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<"pop" | "move">("pop");
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const completedRef = useRef(false);
  const displaySlot = getDisplaySlot(message);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(message.id);
  }, [message.id, onComplete]);

  useEffect(() => {
    const updateCenter = () => setCenter(getCenterPoint());
    updateCenter();
    window.addEventListener("resize", updateCenter);
    return () => window.removeEventListener("resize", updateCenter);
  }, [getCenterPoint]);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setStage((current) => (current === "pop" ? "move" : current));
    }, POP_MS + 100);

    return () => clearTimeout(fallbackTimer);
  }, []);

  const handlePopEnd = useCallback(
    (event: React.AnimationEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (stage !== "pop") return;
      const name = event.animationName;
      if (name !== "pop-center" && !name.endsWith("pop-center")) return;
      setStage("move");
    },
    [stage]
  );

  useEffect(() => {
    if (stage !== "move") return;

    let moveTimer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    let cleaned = false;

    function runMove() {
      const card = cardRef.current;
      const target = getSlotElement();

      if (!card || !target) {
        attempts += 1;
        if (attempts < 30) {
          moveTimer = setTimeout(runMove, 50);
          return;
        }
        finish();
        return;
      }

      const cardRect = card.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const dx =
        targetRect.left +
        targetRect.width / 2 -
        (cardRect.left + cardRect.width / 2);
      const dy =
        targetRect.top +
        targetRect.height / 2 -
        (cardRect.top + cardRect.height / 2);

      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.propertyName !== "transform" || cleaned) return;
        cleaned = true;
        card.removeEventListener("transitionend", onTransitionEnd);
        clearTimeout(moveTimer);
        finish();
      };

      card.addEventListener("transitionend", onTransitionEnd);
      card.classList.remove("animate-pop-enter");
      card.style.animation = "none";
      card.style.transform = "translate(-50%, -50%) scale(1)";

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.transition = `transform ${MOVE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
          card.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`;
        });
      });

      moveTimer = setTimeout(() => {
        if (cleaned) return;
        cleaned = true;
        card.removeEventListener("transitionend", onTransitionEnd);
        finish();
      }, MOVE_MS + 200);
    }

    runMove();
    return () => {
      cleaned = true;
      clearTimeout(moveTimer);
    };
  }, [stage, getSlotElement, finish]);

  return (
    <>
      <div className="enter-backdrop pointer-events-none fixed inset-0 z-[9998] animate-backdrop-in" />
      <div
        ref={cardRef}
        className="pointer-events-none fixed z-[9999] animate-pop-enter"
        style={{
          left: center.x,
          top: center.y,
          width: CARD_W,
          height: CARD_H,
        }}
        onAnimationEnd={handlePopEnd}
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

  const getSlotElement = useCallback(
    (slot: number) => () => slotRefs.current[slot],
    []
  );

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
  const enteringSlotSet = new Set<number>();

  for (const card of cards) {
    const slot = getDisplaySlot(card);
    if (card.phase === "entering") {
      enteringCards.push(card);
      enteringSlotSet.add(slot);
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
        const res = await fetch("/api/messages", { cache: "no-store" });
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

          return [...next, ...exiting];
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
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const card of cards) {
      if (card.phase === "exiting") {
        timers.push(
          setTimeout(() => {
            setCards((prev) => prev.filter((c) => c.id !== card.id));
          }, 500)
        );
      }
    }
    return () => timers.forEach(clearTimeout);
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
            const exitingAtSlot = exitingCards.find(
              (c) => getDisplaySlot(c) === slot
            );
            const isEntering = enteringSlotSet.has(slot);

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
                {card && !exitingAtSlot && !isEntering && (
                  <FloatingCard message={card} />
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
              getCenterPoint={getCenterPoint}
              getSlotElement={getSlotElement(getDisplaySlot(activeEntering))}
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
