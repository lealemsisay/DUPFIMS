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
- Backend credentials authentication with bcrypt password hashes and opaque,
  revocable database sessions
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
- Hashed-password verification and an 8-hour server-side session
- Protected dashboard route and a protected, uncached metrics API
- PostgreSQL-backed dashboard metrics, campus scoping, role permissions, and
  empty states; inaccessible metrics display as restricted
- Prisma schema foundation for users, roles, permissions, campuses, students,
  disciplinary cases, information submissions, messages, notifications,
  audit logs, organizational units, and time-bounded campus delegations
- Idempotent role/permission and initial administrator seed; no demo data
- Database-backed System Administrator user management for account creation,
  profile updates, role changes, campus/unit assignments, activation,
  suspension, password resets, search/filter/pagination, and per-account audit
  history
- Server-enforced user-management authorization; password hashes are omitted
  from API responses, changes are audited transactionally, and account
  mutations revoke sessions where needed
- Initial administrator account is protected from user-management edits,
  role changes, deactivation, and password resets; users cannot change their
  own role or status
- Supported role catalog includes separate records for each University Vice
  President seat; notifications and dashboard metrics remain permission- and
  account-scoped
- System Administrator navigation and dashboard are limited to Dashboard,
  User Management, Campus Management, My Profile, and Logout. Its dashboard
  reports account counts, campus count, audited account/campus activity, and
  database connectivity without querying student, case, submission, message,
  or notification records
- System Administrators can provision one Peace Forum President and the
  appointed Peace Forum and university leadership roles. Peace Forum
  Presidents can manage only representative and organizational-unit accounts.
  The backend scopes list, detail, edit, role, status, and reset operations to
  the manager's authority; neither manager may change their own role
- Peace Forum President permissions include authorized case oversight,
  submission review, and executive-account management. University Vice
  President seats use independent role records and personal user inboxes; a
  portfolio-specific permission matrix requires official portfolio decisions
- Representative delegations are granted by the Peace Forum President for a
  selected campus and explicit start/end times; revocations and grants are
  retained in the audit history. Delegation access checks exclude revoked and
  expired grants
- Campus Management supports create, edit, activate, and deactivate actions.
  Deactivation never deletes historical student or case records, and the
  technical administration interface does not expose record counts
- Responsive client-side dashboard navigation with separate routes for
  students, cases, information, notifications, messages, reports, users,
  campuses, settings, and profile
- Existing module routes render clearly marked under-development states where
  no module API or workflow exists; student, case, and information API paths
  enforce role permissions and return an explicit not-implemented response
  for authorized requests rather than simulated records or success responses
- Dashboard metrics, campus rows, notifications, and recent activity entries
  link to their corresponding modules
- Initial-account creation and login require the local PostgreSQL database and
  values in the ignored `backend/.env`; do not run the seed until those are
  configured

Dependency audit note: `npm audit --omit=dev` currently reports three high
advisories through the Prisma 6 CLI configuration dependency. npm only offered
a fix by upgrading Prisma to v7, which is a breaking migration and was not
applied without database-backed verification. Reassess this before production.

Firebase notification and storage integrations and the remaining application
modules are intentionally not implemented in Phase 1.

## User management API

The System Administrator can provision the initial institutional appointments;
the Peace Forum President can manage only Peace Forum representatives and unit
members. Both use the following PostgreSQL-backed endpoints after completing
the first-login password change, with server-side role-scoped account access:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/users/options` | Roles, active campuses, and organizational units |
| `GET` | `/api/users` | Search, filter, and paginate accounts |
| `POST` | `/api/users` | Create an account with a bcrypt-hashed initial password |
| `GET` | `/api/users/:id` | View account details |
| `GET` | `/api/users/:id/audit` | View immutable account history |
| `PUT` | `/api/users/:id` | Update profile and campus/unit assignment |
| `PATCH` | `/api/users/:id/role` | Change the assigned supported role |
| `PATCH` | `/api/users/:id/status` | Activate, deactivate, or suspend an account |
| `POST` | `/api/users/:id/reset-password` | Reset credentials and require a first-login change |
| `GET` | `/api/users/:id/delegations` | Peace Forum President: view representative delegations |
| `POST` | `/api/users/:id/delegations` | Peace Forum President: grant a campus/time-bounded delegation |
| `DELETE` | `/api/users/:id/delegations/:delegationId` | Peace Forum President: revoke a delegation |

System Administrator-only campus endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/campuses` | List technical campus records |
| `POST` | `/api/campuses` | Create campus |
| `PUT` | `/api/campuses/:id` | Edit campus identifier/name |
| `PATCH` | `/api/campuses/:id/status` | Activate/deactivate without deleting history |
| `GET` | `/api/system/health` | Check application database connectivity |

The System Administrator receives no `student:read`, `case:read`,
`case:manage`, `information:read`, `information:manage`, `messages:read`, or
`notifications:read` permission. Authenticated case and information API
requests are permission-guarded; the data workflows themselves remain
unimplemented and authorized requests return HTTP 501.

The migration adds normalized case-insensitive username/email uniqueness,
account contact and last-login fields, a protected-account marker, and the
suspended status. It is applied through Prisma migrations; no schema reset is
required.

The black Next.js icon shown in the lower-left corner during development is
the Next.js Dev Tools indicator, not a DUPFIMS status or control.
