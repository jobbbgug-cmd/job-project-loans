# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server with Turbopack at http://localhost:3000
npm run build    # Production build (Turbopack)
npm run start    # Start production server
```

No test runner or linter is configured yet.

## Database Setup

Run the init script once against a local MySQL instance:

```bash
mysql -u root -p < scripts/init-db.sql
```

Copy `.env.local.example` to `.env.local` and fill in your MySQL credentials and a random `JWT_SECRET`.

## Stack

- **Next.js 15** with the App Router (`app/` directory)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4** — configured via `postcss.config.mjs` using `@tailwindcss/postcss`; no `tailwind.config` file
- **MySQL** via `mysql2/promise` (no ORM)
- **Auth** — passwords hashed with `bcryptjs`; sessions via `jose` JWT stored in an `httpOnly` cookie named `auth_token` (7-day expiry)
- **Geist fonts** — loaded via `next/font/google`, CSS variables `--font-geist-sans` / `--font-geist-mono`

## Architecture

This is a todo-list app with per-user authentication. All routes live under `app/` using Next.js App Router conventions.

### Database schema (`scripts/init-db.sql`)

Two tables: `users` (id, name, email, password_hash) and `todos` (id, user_id FK, title, completed TINYINT, created_at, updated_at).

### Auth flow

- `middleware.ts` — runs on every request; reads `auth_token` cookie and verifies the JWT via `jose`. Unauthenticated requests to protected routes are redirected to `/login`; authenticated users hitting `/login` or `/register` are redirected to `/todos`.
- `lib/auth.ts` — exports `hashPassword`, `verifyPassword`, `signToken`, `verifyToken`, and the `TokenPayload` interface `{ userId, email, name }`.
- `lib/db.ts` — exports a singleton `mysql2` connection pool (uses `global._mysqlPool` to survive hot-reload in dev).

### API routes (`app/api/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | Create user, set cookie |
| POST | `/api/auth/login` | Verify credentials, set cookie |
| POST | `/api/auth/logout` | Clear cookie |
| GET | `/api/auth/me` | Return JWT payload |
| GET | `/api/todos` | List todos for authenticated user |
| POST | `/api/todos` | Create todo |
| PUT | `/api/todos/[id]` | Update title / completed |
| DELETE | `/api/todos/[id]` | Delete todo |

All todo routes verify ownership via `user_id` before mutating. The `completed` column is `TINYINT(1)`; API routes normalize it to a JS boolean before returning JSON.

### Pages

- `app/page.tsx` — redirects to `/todos` (middleware handles the auth redirect if unauthenticated)
- `app/login/page.tsx` — client component with email/password form
- `app/register/page.tsx` — client component with name/email/password form
- `app/todos/page.tsx` — client component; fetches `/api/auth/me` and `/api/todos` on mount; supports add, toggle, delete, and filter (all / active / completed)

Shared UI components live in `components/` when introduced.
