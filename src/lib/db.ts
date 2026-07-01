import { neon } from "@neondatabase/serverless";

export const MAX_MESSAGES = 25;

export type Message = {
  id: number;
  name: string;
  photo: string;
  text: string | null;
  sequence: number;
  created_at: string;
  slot: number;
};

type MessageRow = Omit<Message, "slot">;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
}

function withSlot(message: MessageRow): Message {
  return {
    ...message,
    slot: (message.sequence - 1) % MAX_MESSAGES,
  };
}

export async function getLatestMessages(): Promise<Message[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, photo, text, sequence, created_at
    FROM messages
    ORDER BY sequence DESC
    LIMIT ${MAX_MESSAGES}
  `;
  return (rows as MessageRow[]).reverse().map(withSlot);
}

export async function addMessage(input: {
  name: string;
  photo: string;
  text?: string;
}): Promise<Message> {
  const sql = getSql();
  const name = input.name.trim();
  const photo = input.photo.trim();
  const text = input.text?.trim() ?? "";

  if (!name) {
    throw new Error("Name is required");
  }
  if (name.length > 100) {
    throw new Error("Name is too long (max 100 characters)");
  }
  if (!photo) {
    throw new Error("Photo is required");
  }
  if (!photo.startsWith("data:image/")) {
    throw new Error("Invalid photo format");
  }
  if (photo.length > 500_000) {
    throw new Error("Photo is too large");
  }
  if (text.length > 280) {
    throw new Error("Message is too long (max 280 characters)");
  }

  const rows = await sql`
    INSERT INTO messages (name, photo, text)
    VALUES (${name}, ${photo}, ${text || null})
    RETURNING id, name, photo, text, sequence, created_at
  `;

  const countRows = await sql`SELECT COUNT(*)::int AS count FROM messages`;
  const count = (countRows[0] as { count: number }).count;

  if (count > MAX_MESSAGES) {
    const toDelete = count - MAX_MESSAGES;
    await sql`
      DELETE FROM messages
      WHERE id IN (
        SELECT id FROM messages
        ORDER BY sequence ASC
        LIMIT ${toDelete}
      )
    `;
  }

  return withSlot(rows[0] as MessageRow);
}
