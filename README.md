# KelolaKelas Web

Next.js (App Router) web application for KelolaKelas. Parents browse the public class catalog, manage student
profiles, enroll in classes, and follow enrollment and payment status. Tenant members manage classes, publication,
members, roles, settings, and enrollments from the tenant dashboard.

All data is fetched server-side (Server Components and Server Actions) from the KelolaKelas API gateway. The browser
never calls the gateway directly.

## Requirements

- Node.js 20
- A running KelolaKelas API gateway (default `http://localhost:8000`)

## Getting started

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GATEWAY_API_URL` | yes | none | Server-side origin of the API gateway used by every Server Component and Server Action. |
| `NEXT_PUBLIC_APP_URL` | no | `http://localhost:3000` | Public origin of this app, used for canonical and Open Graph URLs. Set it to the deployed origin in production. |
| `AUTH_COOKIE_NAME` | no | `auth_token` | Name of the session cookie. |
| `TENANT_ID_COOKIE_NAME` | no | `tenant_id` | Name of the tenant context cookie. |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint. |
| `npm run test` | Run the Vitest unit tests. |
| `npx tsc --noEmit` | Type-check the project. |

## Project layout

- `app/(public)` — landing page and public class catalog (`/kelas`, `/kelas/[id]`).
- `app/(auth)` — login, registration, logout, and invitation acceptance.
- `app/(dashboard)/dashboard/parent` — parent student management and enrollment status.
- `app/(dashboard)/dashboard/tenant` — tenant dashboard.
- `lib` — gateway client, session helpers, domain helpers, and their tests.
- `proxy.ts` — request proxy that enforces authenticated and role-specific routes.

This project uses a Next.js version with breaking changes from older releases. Read the relevant guide in
`node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).

System architecture, API contracts, and operational documentation live in the `kelolakelas-docs` repository.
