# Mosaic Wall

A live message wall with two views:

- **Submit page** (`/`) — take a photo, enter your name, and send to the wall
- **Display wall** (`/display`) — shows up to 25 photo cards with names on white floating tiles with animation. When a 26th entry arrives, the oldest is removed.

Messages are stored in **Neon Postgres**.

## Setup

### 1. Create a Neon database

1. Go to [neon.tech](https://neon.tech) and create a free project.
2. Copy the connection string from the dashboard.

### 2. Configure environment

```bash
cp .env.example .env
```

Paste your Neon connection string into `DATABASE_URL` in `.env`.

### 3. Install and initialize

```bash
npm install
npm run db:init
```

### 4. Run locally

```bash
npm run dev
```

- Submit photos: [http://localhost:3000](http://localhost:3000)
- Display wall: [http://localhost:3000/display](http://localhost:3000/display)

Open the submit page on your phone (use your computer's local IP on the same Wi‑Fi, or deploy to Vercel).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add `DATABASE_URL` as an environment variable (your Neon connection string).
4. Deploy. Run `npm run db:init` once locally against the production DB, or run the SQL in `scripts/schema.sql` from the Neon SQL editor.

## How it works

- `POST /api/messages` — saves a name + photo (compressed JPEG as base64) and trims the table to the latest 25 rows.
- `GET /api/messages` — returns the current 25 entries (oldest first).
- The display page polls every 2 seconds and animates new photos in; removed entries fade out.
