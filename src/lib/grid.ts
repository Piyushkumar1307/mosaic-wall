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

const MIN_CARD_W = 128;
const MIN_COLS = 3;
const MAX_COLS = 7;

/** Text strip height — square photo + this = total card height. */
export function computeTextBlockH(cardW: number): number {
  const nameSize = Math.max(13, Math.min(17, cardW * 0.115));
  const messageSize = Math.max(12, Math.min(15, cardW * 0.095));
  const pad = 10;
  const nameLines = nameSize * 1.3 * 2;
  const messageLines = messageSize * 1.35 * 2;
  return Math.ceil(pad * 2 + nameLines + 4 + messageLines);
}

export function computeCardH(cardW: number): number {
  return cardW + computeTextBlockH(cardW);
}

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
  const cardH = computeCardH(cardW);

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
