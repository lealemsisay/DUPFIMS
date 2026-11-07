# Dilla University Peace Forum Information Management System

DUPFIMS is a single Next.js application foundation for coordinating Peace Forum
information at Dilla University. Its login and dashboard shell follow the
provided Dilla University Portal screenshot's green header, blue service cards,
serif typography, compact account panel, and supplied Dilla University logo.

## Technology

- Next.js App Router, React, and TypeScript frontend
- Standalone Express and TypeScript backend API
- Tailwind CSS 4 and Lucide React
- PostgreSQL with Prisma
- Auth.js credentials authentication with bcrypt password hashes and JWT
  sessions
- Zod and React Hook Form for login validation

## Requirements

- Node.js 20.9 or newer
- PostgreSQL 14 or newer

## Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create application and initial administrator environment files:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item backend/.env.example backend/.env
   ```

3. Set `DATABASE_URL` in `.env` to the PostgreSQL database
   `dilla_peace_forum`. Generate an `AUTH_SECRET` with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. Set `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_USERNAME`, optional
   `INITIAL_ADMIN_EMAIL`, and a 6-12-character case-sensitive password in
   `backend/.env`. Do not put these credentials in source control or reuse the
   PostgreSQL password. Short passwords are less resistant to guessing; use
   the longest unique value the policy permits and change it at first login.

5. Apply the schema and create the initial administrator:

   ```powershell
   npm run db:migrate -- --name init
   npm run db:seed
   ```

   The seed command creates the role/permission catalog, then creates the
   active System Administrator once, with a bcrypt password hash and
   `mustChangePassword` enabled. New accounts default to requiring a password
   change. Re-running the seed does not duplicate the
   account or replace its password. The administrator receives no
   disciplinary-case permissions by default.

6. Start the frontend and backend in separate VS Code terminals:

   ```powershell
   npm run dev:backend
   ```

   In another terminal:

   ```powershell
   npm run dev:frontend
   ```

   Alternatively, run the **DUPFIMS Backend Dev** and **DUPFIMS Frontend Dev**
   tasks from VS Code's Terminal → Run Task menu. The frontend is at
   `http://localhost:3000`; its `/api/...` requests are proxied to the backend
   at `http://127.0.0.1:4000`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `AUTH_SECRET` | Secret used by Auth.js to sign and encrypt session tokens |
| `AUTH_URL` | Canonical application URL, for example `http://localhost:3000` |
| `BACKEND_API_URL` | Backend URL used by the Next.js proxy and server-side pages |
| `INITIAL_ADMIN_NAME` | Initial administrator full name, in `backend/.env` |
| `INITIAL_ADMIN_USERNAME` | Initial administrator username, in `backend/.env` |
| `INITIAL_ADMIN_EMAIL` | Optional initial administrator email, in `backend/.env` |
| `INITIAL_ADMIN_PASSWORD` | Initial login password, in `backend/.env` |
| `BACKEND_PORT` | Backend API port, default `4000`, in `backend/.env` |
| `FRONTEND_ORIGINS` | Allowed frontend origins, in `backend/.env` |

Environment files are ignored by git. Never put credentials in the tracked
example files or client-side code.

## Current implementation status

- Portal-inspired, responsive login screen and university header
- Separate Express backend API and Next.js frontend, with proxied same-origin
  API requests and database-backed opaque session cookies
- `POST /api/auth/login` and `POST /api/auth/logout`, with bcrypt password
  verification and hashed, revocable session tokens
- First-login password change at `/api/auth/change-password`; password-change
  requirements protect the dashboard and permission-guarded APIs
- Hashed-password verification and an 8-hour server-side Auth.js session
- Protected dashboard route and a protected, uncached metrics API
- PostgreSQL-backed dashboard metrics, campus scoping, role permissions, and
  empty states; inaccessible metrics display as restricted
- Prisma schema foundation for users, roles, permissions, campuses, students,
  disciplinary cases, information submissions, messages, notifications,
  audit logs, organizational units, and time-bounded campus delegations
- Idempotent role/permission and initial administrator seed; no demo data
- Responsive dashboard navigation; modules outside Phase 1 are visibly
  disabled rather than linking to non-existent pages
- Initial-account creation and login require the local PostgreSQL database and
  values in the ignored `backend/.env`; do not run the seed until those are
  configured

Dependency audit note: `npm audit --omit=dev` currently reports three high
advisories through the Prisma 6 CLI configuration dependency. npm only offered
a fix by upgrading Prisma to v7, which is a breaking migration and was not
applied without database-backed verification. Reassess this before production.

Firebase notification and storage integrations and the remaining application
modules are intentionally not implemented in Phase 1.
