"use client";

import { useCallback, useEffect, useRef, useState, forwardRef } from "react";
import { createPortal } from "react-dom";
import type { Message } from "@/lib/db";
import {
  computeGridLayout,
  fitCardTextSize,
  getFillSlotOrder,
  type GridLayout,
} from "@/lib/grid";
import { BrandHeader } from "@/components/BrandHeader";

const FLOAT_PAD = 14;
const POP_MS = 1400;
const HOLD_MS = 2000;
const MOVE_MS = 900;
const POLL_MS = 300;
const ENTER_TIMEOUT_MS = POP_MS + HOLD_MS + MOVE_MS + 800;

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
    cardW?: number;
    className?: string;
    style?: React.CSSProperties;
    onAnimationEnd?: (event: React.AnimationEvent<HTMLDivElement>) => void;
  }
>(function MosaicCard(
  { message, cardW = 128, className = "", style, onAnimationEnd },
  ref
) {
  const displayName = message.name || "Guest";
  const nameSize = fitCardTextSize(displayName, cardW, {
    maxSize: Math.min(17, cardW * 0.115),
    minSize: 10,
    maxLines: 2,
  });
  const messageSize = message.text
    ? fitCardTextSize(message.text, cardW, {
        maxSize: Math.min(15, cardW * 0.095),
        minSize: 7,
        maxLines: 3,
      })
    : 0;

  return (
    <div
      ref={ref}
      onAnimationEnd={onAnimationEnd}
      className={`mosaic-card flex w-full flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-lg shadow-black/20 ${
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
            className="h-full w-full object-cover object-center"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">
            ?
          </div>
        )}
      </div>
      <div className="shrink-0 bg-white px-2.5 pt-2 pb-2.5">
        <p
          className="text-center font-semibold leading-snug text-slate-900 break-words"
          style={{
            fontSize: nameSize,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {displayName}
        </p>
        {message.text && (
          <p
            className="mt-1 text-center font-medium leading-snug text-slate-700 break-words"
            style={{
              fontSize: messageSize,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
});

function FloatingCard({
  message,
  cardW,
}: {
  message: DisplayCard;
  cardW: number;
}) {
  const seed = hashString(`${message.id}`);
  const duration = 3.5 + (seed % 30) / 10;
  const delay = (seed % 20) / 10;

  return (
    <div
      className="floating-card-wrapper absolute inset-x-0 top-0 animate-card-float"
      style={
        {
          "--duration": `${duration}s`,
          "--delay": `${delay}s`,
        } as React.CSSProperties
      }
    >
      <MosaicCard message={message} cardW={cardW} className="w-full" />
    </div>
  );
}

function EnteringCard({
  message,
  displaySlot,
  cardW,
  cardH,
  slotRefs,
  getCenterPoint,
  onComplete,
}: {
  message: DisplayCard;
  displaySlot: number;
  cardW: number;
  cardH: number;
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
    const startLeft = center.x - cardW / 2;
    const startTop = center.y - cardH / 2;

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
    }, POP_MS + HOLD_MS);

    return () => {
      clearTimeout(popTimer);
      clearTimeout(finishTimer);
      clearTimeout(safetyTimer);
    };
  }, [displaySlot, message.id, slotRefs, finish, center, cardW, cardH]);

  return (
    <>
      <div className="enter-backdrop pointer-events-none fixed inset-0 z-[9998]" />
      <div
        ref={cardRef}
        className="pointer-events-none fixed z-[9999] animate-pop-enter"
        style={{
          left: center.x - cardW / 2,
          top: center.y - cardH / 2,
          width: cardW,
          height: cardH,
        }}
      >
        <MosaicCard message={message} cardW={cardW} className="w-full" />
      </div>
    </>
  );
}

const DEFAULT_LAYOUT = computeGridLayout(900, 700);

export default function DisplayPage() {
  const [cards, setCards] = useState<DisplayCard[]>([]);
  const [mounted, setMounted] = useState(false);
  const [layout, setLayout] = useState<GridLayout>(DEFAULT_LAYOUT);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(layout);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stuckTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const exitingTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  layoutRef.current = layout;

  useEffect(() => {
    slotRefs.current = Array.from(
      { length: layout.totalSlots },
      () => null
    );
  }, [layout.totalSlots]);

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
    const centerSlot = slotRefs.current[layout.centerSlot];
    if (centerSlot) {
      const rect = centerSlot.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    const area = gridAreaRef.current;
    if (!area) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    const rect = area.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, [layout.centerSlot]);

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
    function updateLayout() {
      const area = gridAreaRef.current;
      if (!area) return;

      const availW = area.clientWidth;
      const availH = area.clientHeight - FLOAT_PAD * 2;
      if (availW <= 0 || availH <= 0) return;

      setLayout(computeGridLayout(availW, availH));
    }

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const currentLayout = layoutRef.current;
        const res = await fetch(
          `/api/messages?limit=${currentLayout.maxDisplaySlots}&_=${Date.now()}`,
          {
            cache: "no-store",
            headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
          }
        );
        if (!res.ok || !active) return;
        const data = await res.json();
        const messages: Message[] = data.messages ?? [];
        const slotOrder = getFillSlotOrder(currentLayout);
        const sorted = [...messages].sort((a, b) => a.sequence - b.sequence);

        setCards((prev) => {
          const next: DisplayCard[] = [];
          const exiting: DisplayCard[] = [];
          const isInitialLoad = !initialLoadDoneRef.current;

          sorted.forEach((msg, index) => {
            const displaySlot = slotOrder[index] ?? slotOrder[slotOrder.length - 1];
            const existing = prev.find((c) => c.id === msg.id);

            if (existing) {
              next.push({
                ...msg,
                displaySlot,
                phase:
                  existing.phase === "entering" ? "entering" : "settled",
              });
              knownIdsRef.current.add(msg.id);
            } else if (!isInitialLoad && !knownIdsRef.current.has(msg.id)) {
              knownIdsRef.current.add(msg.id);
              next.push({ ...msg, phase: "entering", displaySlot });
            } else {
              knownIdsRef.current.add(msg.id);
              next.push({ ...msg, phase: "settled", displaySlot });
            }
          });

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
    <main className="relative flex h-dvh w-full flex-col items-center overflow-hidden bg-black">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/display-bg.png)" }}
      />

      <BrandHeader
        center={
          <h1 className="whitespace-nowrap text-xl font-extrabold tracking-wide text-white sm:text-2xl md:text-3xl">
            Automation Wall
          </h1>
        }
      />

      <div
        ref={gridAreaRef}
        className="relative z-0 flex w-full max-w-7xl flex-1 min-h-0 items-center justify-center overflow-visible px-3 pb-2 mx-auto sm:px-6"
        style={{ paddingTop: FLOAT_PAD, paddingBottom: FLOAT_PAD }}
      >
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${layout.rows}, ${layout.cardH}px)`,
            columnGap: layout.gapX,
            rowGap: layout.gapY,
          }}
        >
          {Array.from({ length: layout.totalSlots }, (_, slot) => {
            const card = settledBySlot.get(slot);
            const enteringAtSlot = enteringCards.find(
              (c) => getDisplaySlot(c) === slot
            );
            const exitingAtSlot = exitingCards.find(
              (c) => getDisplaySlot(c) === slot
            );
            const isCenterGap = slot === layout.centerSlot;
            const isActiveEntering = enteringAtSlot?.id === activeEntering?.id;

            return (
              <div
                key={slot}
                ref={(el) => {
                  slotRefs.current[slot] = el;
                }}
                className={`relative flex min-w-0 flex-col justify-start overflow-visible ${
                  isCenterGap
                    ? "rounded-xl border border-dashed border-yellow-400/25"
                    : ""
                }`}
                style={{ height: layout.cardH }}
                aria-hidden={isCenterGap}
              >
                {exitingAtSlot && !isCenterGap && (
                  <div className="absolute inset-x-0 top-0">
                    <MosaicCard
                      message={exitingAtSlot}
                      cardW={layout.cardW}
                      className="w-full"
                    />
                  </div>
                )}
                {card && !exitingAtSlot && !isCenterGap && (
                  <FloatingCard message={card} cardW={layout.cardW} />
                )}
                {enteringAtSlot &&
                  !exitingAtSlot &&
                  !isActiveEntering &&
                  !isCenterGap && (
                    <FloatingCard
                      message={{ ...enteringAtSlot, phase: "settled" }}
                      cardW={layout.cardW}
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
              cardW={layout.cardW}
              cardH={layout.cardH}
              slotRefs={slotRefs}
              getCenterPoint={getCenterPoint}
              onComplete={settleCard}
            />,
            document.body
          )}

        {visibleCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <p className="text-center text-base text-slate-300 sm:text-lg">
              Waiting for photos...
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
