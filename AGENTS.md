# AGENTS.md - Progression Protocol Context

> **Designed for AI Agents (Cursor, Windsurf, Copilot, etc.)**
> This file provides high-level context, architectural standards, and security boundaries. Read this first.

## 1. Project Overview

**Name**: Progression Protocol
**Type**: Gamified Dashboard / Productivity RPG
**Stack**:

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (via `pg` driver)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## 2. Architecture & File Structure

- **`src/app`**: Pages and Server Actions.
  - `page.tsx`: Server Components.
  - `*Client.tsx`: Client Components (suffixed to distinguish).
  - `actions/*.ts`: Server Actions (use `"use server"`).
- **`src/components`**: UI Components.
  - `layout/`: Global layout components (`Sidebar`, `Shell`, `MobileHeader`).
  - `dashboard/`: Feature-specific dashboard widgets.
- **`src/lib`**: Utilities and Business Logic.
  - `db.ts`: **CRITICAL**. Single database connection pool.
  - `game-logic/`: Core RPG formulas (Loot, XP, Damage).
  - `system/`: System-level constants and formulas.

## 3. Critical Security Boundaries (DO NOT CROSS)
>
> 🚨 **SECURITY PROTOCOLS**
> The following rules are absolute. Violation results in immediate task failure.

1. **Secrets Management**:
    - **NEVER** read, print, or modify `.env` or `.env.local` unless explicitly asked to "configure environment".
    - **NEVER** commit secrets to git.
    - **NEVER** hardcode API keys or passwords in code. Use `process.env`.
2. **Database Integrity**:
    - **NEVER** modify `src/lib/db.ts`. This controls the connection pool. Breaking this breaks the app.
    - **NEVER** drop tables (`DROP TABLE`) without explicit user confirmataion.
    - **ALWAYS** use parameterized queries (`db.query('SELECT * FROM users WHERE id = $1', [id])`). **NEVER** utilize string concatenation for SQL queries (SQL Injection risk).
3. **Dependency Safety**:
    - **NEVER** install new npm packages without asking: "I need to install [package]. Is this okay?"
    - **AVOID** external API calls unless the feature specifically requires it.

## 4. Coding Conventions

- **Files**: Use `PascalCase` for React components (`QuestCard.tsx`) and `kebab-case` for utilities (`quest-logic.ts`).
- **Exports**: Use `export function` (Named Exports) over `export default` for better refactoring support.
- **Server Actions**: Always validate input using `zod` and `safeAction` wrapper in `src/lib/action-utils.ts`.
- **Styling**: Use Tailwind utility classes. Avoid arbitrary values (`w-[123px]`) where possible; use standard spacing steps.

## 5. Common Workflows

- **Running Dev Server**: `npm run dev` (Port 3000 or 9999).
- **Database Changes**:
    1. Create a reviewed, numbered SQL file in `database/migrations/NNN_description.sql`.
    2. Preview it with `npm run db:migrate -- --target-database DATABASE --env-file .env.local --check`.
    3. Apply it with `npm run db:migrate -- --target-database DATABASE --env-file .env.local --confirm` after a backup.
    4. Keep one-off TypeScript migrations private and historical; do not add them to the public release package.
    5. **DO NOT** run raw SQL in the terminal unless debugging.
- **Debugging**:
  - Check the active issue or [release checklist](docs/RELEASE_CHECKLIST.md) for the current objective.
  - Use `console.log` on Server Actions (output appears in terminal).

## 6. Known "Gotchas"

- **Mobile Navigation**: The `Shell` component handles the responsive layout. The `Sidebar` is hidden on mobile and toggled via `MobileHeader`.
- **Image handling**: `Next/Image` requires strict `width/height` or `fill`. If `fill`, parent must have `relative`.
- **Hydration Errors**: Ensure initial server state matches client state (e.g., Use `useEffect` for random values or `localStorage`).

---
*Last Updated: 2026-10-12*
