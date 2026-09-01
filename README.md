# Payson Mercury Portfolio

A plain HTML/CSS/JavaScript portfolio with a persistent public chat in production and a zero-configuration local development mode.

## Requirements

- Node.js 20 or newer
- npm (included with Node)

No shell-specific tooling is required. The project scripts work in PowerShell, Command Prompt, macOS Terminal, and Linux shells.

## Start working locally

```text
npm install
npm run dev
```

Open `http://127.0.0.1:8787`. To use a different port, run `npm run dev -- --port=3000`.

The local server serves the same pages and chat client as production. Local chat messages are stored append-only in `.local/chat-messages.json`; this file is ignored by Git and can be deleted whenever you want a blank local chat.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local site and local chat API. |
| `npm run test` | Run the chat behavior tests. |
| `npm run build` | Create deployable output in `dist/`. |
| `npm run verify` | Test, build, and verify required deployment files. |
| `npm run clean` | Remove generated `dist/` output. |
| `npm run db:generate` | Generate a new production database migration after editing `db/schema.ts`. |

## Project map

- `index.html` — page content and site structure.
- `css/mercury.css` — all visual styling.
- `theme/` and `assets/` — images and existing Y2K UI assets.
- `js/chat.js` — browser chat client.
- `worker/index.js` — production Worker and D1-backed chat API.
- `db/schema.ts` and `drizzle/` — production database schema and migrations.
- `scripts/` — cross-platform developer scripts.

## Production chat

Production uses a Cloudflare Worker with a D1 database binding named `DB`. The SQL migration lives at `drizzle/0000_glorious_azazel.sql`. Messages are append-only by design; no delete route exists.

For normal visual work, use `npm run dev`. The local server is intentionally separate from the production Worker so you can change HTML, CSS, client JavaScript, and assets without cloud credentials. Before deploying production changes, run `npm run verify`.
