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
  const minMessageSize = 8;
  const pad = 10;
  const nameLines = nameSize * 1.3 * 2;
  const messageLines = minMessageSize * 1.35 * 3;
  return Math.ceil(pad * 2 + nameLines + 4 + messageLines);
}

/** Estimate font size so text fits within maxLines inside card width. */
export function fitCardTextSize(
  text: string,
  cardW: number,
  {
    maxSize,
    minSize,
    maxLines,
  }: { maxSize: number; minSize: number; maxLines: number }
): number {
  if (!text.trim()) return maxSize;

  const innerW = Math.max(cardW - 20, 48);
  const lineHeight = 1.35;

  for (let size = maxSize; size >= minSize; size -= 0.5) {
    const charWidth = size * 0.48;
    const charsPerLine = Math.max(1, innerW / charWidth);
    const linesNeeded = Math.ceil(text.length / charsPerLine);
    const maxHeight = size * lineHeight * maxLines;
    const estimatedHeight = size * lineHeight * linesNeeded;

    if (linesNeeded <= maxLines && estimatedHeight <= maxHeight + 0.5) {
      return Math.round(size * 10) / 10;
    }
  }

  return minSize;
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
