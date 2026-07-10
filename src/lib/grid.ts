export type GridLayout = {
  cols: number;
  rows: number;
  totalSlots: number;
  centerSlot: number;
  maxDisplaySlots: number;
  cardW: number;
  cardH: number;
  gapX: number;
  gapY: number;
};

const CARD_ASPECT = 178 / 110;
const MIN_CARD_W = 96;
const MIN_COLS = 3;
const MAX_COLS = 14;

export function getCenterSlot(cols: number, rows: number): number {
  return Math.floor(rows / 2) * cols + Math.floor(cols / 2);
}

/** Slot indices in left-to-right, top-to-bottom order, skipping the center gap. */
export function getFillSlotOrder(layout: GridLayout): number[] {
  const order: number[] = [];
  for (let i = 0; i < layout.totalSlots; i++) {
    if (i !== layout.centerSlot) order.push(i);
  }
  return order;
}

export function computeGridLayout(width: number, height: number): GridLayout {
  const gapX = 12;
  const gapY = 16;

  let cols = Math.floor((width + gapX) / (MIN_CARD_W + gapX));
  cols = Math.max(MIN_COLS, Math.min(MAX_COLS, cols));

  const cardW = (width - (cols - 1) * gapX) / cols;
  const cardH = cardW * CARD_ASPECT;

  let rows = Math.floor((height + gapY) / (cardH + gapY));
  rows = Math.max(2, rows);

  // Shrink rows if the grid would overflow vertically.
  while (rows > 2 && rows * cardH + (rows - 1) * gapY > height) {
    rows -= 1;
  }

  const totalSlots = cols * rows;
  const centerSlot = getCenterSlot(cols, rows);

  return {
    cols,
    rows,
    totalSlots,
    centerSlot,
    maxDisplaySlots: totalSlots - 1,
    cardW,
    cardH,
    gapX,
    gapY,
  };
}
