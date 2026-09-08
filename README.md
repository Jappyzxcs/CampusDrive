# CampusDrive Frontend — Phase 1

React + Vite + Tailwind CSS scaffold for CampusDrive, built against
Chapters I–III of the thesis (roles, workflows, terminology) plus the
Sprint 3 staff-account clarification (Admin/GSU vs. BAO split).

## What's in Phase 1

- Full `src/` folder structure (components, pages, layouts, hooks,
  context, services, utils, data, routes, constants) — later phases only
  add files into this tree, they don't restructure it.
- Tailwind config with a 4-color institutional palette sampled directly
  from `LSPU_Seal-HD.png` (navy, gold, green, maroon) — see the comment
  block at the top of `tailwind.config.js` for the exact hex math.
- Route map (`src/constants/routes.js`, `src/routes/AppRoutes.jsx`)
  covering every screen listed in the brief. Auth routes are fully built;
  student/admin/guard routes render a labeled placeholder until their
  phase lands, so the whole app is clickable end-to-end today.
- Role-based route guarding (`src/routes/ProtectedRoute.jsx`,
  `src/context/AuthContext.jsx`) against a mock `authService` — swap that
  service for real PHP/Firebase calls later without touching any
  consumer.
- Auth screens: Login and Forgot Password, built on a shared
  `AuthLayout`.
- Splash/loading screen with the LSPU seal, per the brief.

## Role architecture

Per the thesis use-case diagram there are three actors: **Student/Staff**,
**Security Personnel (Guard)**, and **Administrator**. Internally,
"Administrator" is split into two staff accounts (clarified during
Sprint 3 planning) so the office approving applications isn't the same
one issuing stickers:

| Role | Constant | Responsibility |
|---|---|---|
| Student / Faculty | `STUDENT_FACULTY` | Registers vehicles, uploads documents, tracks status |
| Administrator (GSU) | `ADMIN_GSU` | Reviews applications & documents, approves/rejects |
| BAO | `BAO` | Assigns sticker serials, confirms payment, marks pickup |
| Security Guard | `GUARD` | Scans stickers, views verification results |

## Run it

```bash
npm install
npm run dev
```

Mock accounts (see `src/services/authService.js`), password `password`
for all:

- `student@lspu.edu.ph`
- `gsu.admin@lspu.edu.ph`
- `bao@lspu.edu.ph`
- `guard@lspu.edu.ph`

## Next phases

- **Phase 2** — shared components (sidebar, top nav, data tables, status
  badges, modals, toasts), dashboard layouts.
- **Phase 3** — Student/Faculty module.
- **Phase 4** — Administrator (GSU + BAO) module.
- **Phase 5** — Security Guard scanning module.
- **Phase 6** — Mock data (`src/data/*.json`) wired through Context API.

Per the standing delivery rule, later sprints ship only new/changed
files with a note on what changed — not a re-zip of the whole project —
so nothing you've already configured gets overwritten.
