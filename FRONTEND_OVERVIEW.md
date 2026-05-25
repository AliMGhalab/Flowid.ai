# Flowid.ai — Frontend Overview for Design Team

## What is this project?

**Flowid.ai** is a web app that helps Malaysian factory and plant engineers design industrial fluid systems using AI. The engineer describes their system (e.g. "cooling water loop for a palm oil mill, 50 m³/h, 4 bar") and the AI generates a complete engineering package in under 4 minutes:

- **Bill of Materials (BOM)** — every component needed (pumps, valves, instruments, piping, electrical panels) with Malaysian supplier names and MYR pricing
- **Risk Register** — HAZOP-style hazard analysis for each component
- **Cost Estimate** — broken down by category
- **Piping & Instrumentation notes** — pipe sizing, materials, P&ID symbols
- **PDF + Excel export** — ready to send to procurement or a client

Target users: plant engineers, EPC contractors, consultants across Malaysia (oil & gas, palm oil, food & beverage, pharmaceutical, water treatment, etc.).

---

## Tech stack (don't need to touch any of this)

- **Framework:** Next.js 15 (React) — runs on Vercel
- **Styling:** Tailwind CSS — all styling is done via class names directly in the JSX, there is no separate CSS per component
- **Auth:** Firebase (Google login + email/password)
- **Database:** Firestore (saves projects per user)
- **AI:** Groq / Gemini / Chutes AI APIs (backend only)

---

## Current color theme

The app uses a **dark engineering theme** — dark navy backgrounds, slate cards, blue accent. Here are the exact colors used everywhere:

| Role | Tailwind class | Hex |
|------|---------------|-----|
| Page background | `bg-slate-950` | `#020817` |
| Card background | `bg-slate-900` | `#0f172a` |
| Card border | `border-slate-800` | `#1e293b` |
| Primary text | `text-white` | `#ffffff` |
| Secondary text | `text-slate-400` | `#94a3b8` |
| Muted text | `text-slate-500` | `#64748b` |
| **Brand accent (buttons, links, icons)** | `bg-blue-600` / `text-blue-400` | `#2563eb` / `#60a5fa` |
| Success / cost | `text-green-400` | `#4ade80` |
| Warning / medium risk | `text-yellow-400` | `#facc15` |
| Danger / high risk | `text-red-400` | `#f87171` |
| Focus ring | — | `#3b82f6` (in globals.css) |

---

## Files you should edit (frontend / design)

### 🔴 Most important — touch these first

| File | What's inside |
|------|--------------|
| `src/app/globals.css` | Base CSS variables (`--bg`, `--fg`), scrollbar colors, focus ring color. **Start here to change the overall feel.** |
| `tailwind.config.ts` | Brand color scale. Currently named `brand.*` (blue shades). Change these values to rebrand the whole app at once. |
| `src/components/Navbar.tsx` | Top navigation bar: logo icon, logo text, nav link styles, background blur, user avatar. Appears on every page. |
| `src/app/layout.tsx` | Root layout: sets the body background color (`bg-slate-950`) and the global font (`Inter`). |

### 🟡 Page-by-page

| File | Page | What to style |
|------|------|--------------|
| `src/app/page.tsx` | Homepage (`/`) | Hero section, tagline, all section layouts, comparison table, feature cards, mock BOM preview, CTA buttons, footer. The biggest file — most of the marketing design lives here. |
| `src/app/dashboard/page.tsx` | Dashboard (`/dashboard`) | Project cards grid, card hover states, icon colors, empty state illustration area, stats. |
| `src/app/(auth)/login/page.tsx` | Login (`/login`) | Login card, logo mark, input field styles, button. |
| `src/app/(auth)/signup/page.tsx` | Sign up (`/signup`) | Same as login but with name field. |
| `src/app/new-project/page.tsx` | New project form (`/new-project`) | Multi-section form card, progress/section headings, input styles, submit button + loading state. |
| `src/app/project/[id]/page.tsx` | Project result (`/project/[id]`) | Tab bar, section cards, BOM table, risk badge colors, export buttons, cost summary panel. The most complex page. |

### 🟢 Shared components (small but appear everywhere)

| File | What's inside |
|------|--------------|
| `src/components/Navbar.tsx` | Already listed above — highest priority shared component |
| `src/components/ClientLayout.tsx` | Wraps every page with the Navbar + toast notifications. Mostly structural, but sets the overall page padding/max-width behavior. |

---

## Files you must NOT edit

These are pure logic — no styling lives here:

```
src/app/api/          ← backend AI routes (server only)
src/lib/              ← helper functions (export, firestore, AI parsing)
src/types/            ← TypeScript type definitions
src/components/AuthProvider.tsx     ← Firebase auth logic
src/components/ClientLayoutWrapper.tsx  ← SSR wrapper, no styling
```

---

## How to rebrand the accent color (blue → anything else)

The entire blue accent is applied via three Tailwind classes: `blue-600`, `blue-500`, `blue-400`.

To change brand color globally, do a **find & replace** across all `.tsx` files:

| Find | Replace with |
|------|-------------|
| `blue-600` | `[yourcolor]-600` |
| `blue-500` | `[yourcolor]-500` |
| `blue-400` | `[yourcolor]-400` |

Tailwind color options: `violet`, `indigo`, `teal`, `cyan`, `emerald`, `orange`, `rose`, etc.

Also update `tailwind.config.ts` to match, and update the focus ring in `globals.css` line 36.

---

## How to run the project locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

To build and check for errors before pushing:

```bash
npm run build
```

Any red errors in the build output need to be fixed before deploying.

---

## Page map (what URL = what file)

| URL | File |
|-----|------|
| `/` | `src/app/page.tsx` |
| `/login` | `src/app/(auth)/login/page.tsx` |
| `/signup` | `src/app/(auth)/signup/page.tsx` |
| `/dashboard` | `src/app/dashboard/page.tsx` |
| `/new-project` | `src/app/new-project/page.tsx` |
| `/project/abc123` | `src/app/project/[id]/page.tsx` |

---

## Design direction notes

- Keep the **dark theme** — the target users are engineers looking at this on factory-floor monitors, not a consumer lifestyle app
- The tone is **professional and technical**, not playful
- Blue is currently the brand color because it reads as "technical/industrial" — if rebranding, stay in that family (indigo, teal, cyan work well; avoid pink/orange which read as consumer)
- Cards have a subtle `border-slate-800` outline — important for depth on the dark background, don't remove it
- All buttons use `rounded-xl` (12px radius) — consistent across the app
- Icons come from the `lucide-react` library — use only icons from that package to stay consistent

---

*Questions? Ask Ali or open the project in VS Code — hover any Tailwind class to see the exact CSS it generates.*
