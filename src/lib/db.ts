import { neon } from "@neondatabase/serverless";
import { uploadPhoto } from "@/lib/cloudinary";

/** Server-side cap — display wall uses a smaller dynamic limit per screen. */
export const MAX_STORED_MESSAGES = 500;

export type Message = {
  id: number;
  name: string;
  photo: string;
  text: string | null;
  sequence: number;
  created_at: string;
};

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
}

export async function getLatestMessages(limit: number): Promise<Message[]> {
  const sql = getSql();
  const safeLimit = Math.max(1, Math.min(limit, MAX_STORED_MESSAGES));

  const rows = await sql`
    SELECT id, name, photo, text, sequence, created_at
    FROM (
      SELECT id, name, photo, text, sequence, created_at
      FROM messages
      ORDER BY sequence DESC
      LIMIT ${safeLimit}
    ) AS latest
    ORDER BY sequence ASC
  `;

  return rows as Message[];
}

async function resolvePhotoUrl(photo: string): Promise<string> {
  const trimmed = photo.trim();

  if (trimmed.startsWith("data:image/")) {
    if (trimmed.length > 8_000_000) {
      throw new Error("Photo is too large");
    }
    return uploadPhoto(trimmed);
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  throw new Error("Invalid photo format");
}

export async function addMessage(input: {
  name: string;
  photo: string;
  text?: string;
}): Promise<Message> {
  const sql = getSql();
  const name = input.name.trim();
  const text = input.text?.trim() ?? "";

  if (!name) {
    throw new Error("Name is required");
  }
  if (name.length > 100) {
    throw new Error("Name is too long (max 100 characters)");
  }
  if (!input.photo.trim()) {
    throw new Error("Photo is required");
  }
  if (text.length > 280) {
    throw new Error("Message is too long (max 280 characters)");
  }

  const photoUrl = await resolvePhotoUrl(input.photo);

  const rows = await sql`
    INSERT INTO messages (name, photo, text)
    VALUES (${name}, ${photoUrl}, ${text || null})
    RETURNING id, name, photo, text, sequence, created_at
  `;

  const countRows = await sql`SELECT COUNT(*)::int AS count FROM messages`;
  const count = (countRows[0] as { count: number }).count;

  if (count > MAX_STORED_MESSAGES) {
    const toDelete = count - MAX_STORED_MESSAGES;
    await sql`
      DELETE FROM messages
      WHERE id IN (
        SELECT id FROM messages
        ORDER BY sequence ASC
        LIMIT ${toDelete}
      )
    `;
  }

  return rows[0] as Message;
}
