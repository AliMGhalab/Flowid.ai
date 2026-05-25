# Flowid.ai

> **AI-powered fluid system engineering for Malaysian industry.**
> Generate a procurement-ready Bill of Materials, HAZOP risk register, P&ID diagram, and AACE-compliant cost estimate in under 4 minutes — with 12 server-side integrity checks before output reaches the engineer.

🔗 **Live demo:** [flowid-ai.vercel.app](https://flowid-ai.vercel.app)
🏆 **Submitted to:** AIC Hackathon 2026 (Slido 2311517)

---

## Table of Contents

1. [What it is](#what-it-is)
2. [Key features](#key-features)
3. [Architecture overview](#architecture-overview)
4. [System requirements](#system-requirements)
5. [Quick start](#quick-start)
6. [Configuration guide](#configuration-guide)
7. [Project structure](#project-structure)
8. [How the multi-agent pipeline works](#how-the-multi-agent-pipeline-works)
9. [Reliability — the 12 server-side checks](#reliability--the-12-server-side-checks)
10. [Tech stack](#tech-stack)
11. [Deployment](#deployment)
12. [Disclaimer & licensing](#disclaimer--licensing)
13. [Team & contact](#team--contact)

---

## What it is

Malaysian engineers spend **60–80% of project time on documentation** — Bills of Materials, cost estimates, HAZOP risk registers, compliance citations, vendor RFQs. Engineering consultants charge RM 15,000–50,000 for the same documentation work, with 2–6 week turnarounds.

**Flowid.ai automates the documentation, keeps the engineer in charge of the judgement.**

The engineer describes a project. A 6-agent AI pipeline generates a complete feasibility-grade engineering specification. A 12-check server-side validation layer audits every output for cost integrity, engineering math correctness, material compatibility, and HAZOP coverage. The licensed PE then reviews, modifies, and stamps the result before procurement.

This is a **feasibility tool, not a stamped design.** Every output carries an explicit engineering disclaimer; the licensed PE remains in the loop.

---

## Key features

| Feature | Description |
|---|---|
| **Multi-agent AI pipeline** | 6 specialised agents (Planner, BOM, Hydraulics, HAZOP, Cost, P&ID) with 3-provider fallback chain |
| **Server-side validation** | 12 integrity checks running on every project (cost reconciliation, math verification, material compatibility, BOM↔P&ID consistency, HAZOP coverage) |
| **AACE Class 4–5 cost methodology** | Equipment cost = verified BOM sum. Other lines computed per Lang Factor Method with industry-standard percentages and cited sources |
| **Process Flow Diagram (P&ID)** | Auto-generated diagram rendered with Mermaid.js, downloadable as SVG |
| **Engineer Action Plan** | Auto-generated "What to Revise" checklist + 4-step PE workflow guidance |
| **AI confidence scoring** | Each component rated 0–100% for selection confidence and expected service lifespan |
| **Component alternatives** | Two alternatives per component from different Malaysian suppliers, with cost comparison |
| **Malaysian-first** | Real Malaysian supplier directory · MYR pricing · DOSH / BOMBA / SIRIM / PETRONAS PTS / DOE compliance citations · East Malaysia logistics premiums |
| **PDF + Excel export** | 12-section PDF engineering report and 7-sheet Excel BOM workbook |
| **Live price verification** | Optional Tavily integration to query Malaysian supplier websites |
| **Persistent storage** | Firestore-backed — projects survive across sessions, devices, and users |

---

## Architecture overview

```
┌────────────────────────────────────────────────────────────────────┐
│                       ENGINEER INPUT FORM                          │
│      (industry · fluid type · state · budget · scale)              │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                ┌────────────▼────────────┐
                │      🧭 PLANNER         │
                │  process parameters     │
                └────────────┬────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │           ┌────────┼────────┐           │
        ▼           ▼        ▼        ▼           ▼
   ┌────────┐ ┌──────────┐ ┌─────┐ ┌──────┐ ┌─────────┐
   │📦 BOM  │ │💧 Hydra. │ │⚠️ H.│ │💰 $$ │ │🔧 P&ID │
   └────┬───┘ └────┬─────┘ └──┬──┘ └──┬───┘ └────┬────┘
        │          │          │       │           │
        └──────────┴──────────┼───────┴───────────┘
                              │
                  ┌───────────▼───────────┐
                  │ 🛡 VALIDATION LAYER   │
                  │  12 integrity checks  │
                  │  · cost = BOM sum     │
                  │  · math re-verified   │
                  │  · material compat.   │
                  │  · HAZOP coverage     │
                  │  · BOM↔P&ID consistent│
                  └───────────┬───────────┘
                              │
                  ┌───────────▼───────────┐
                  │ 💾 FIRESTORE STORAGE  │
                  └───────────┬───────────┘
                              │
                  ┌───────────▼───────────┐
                  │ 👷 PE REVIEW & STAMP  │
                  └───────────────────────┘

Fallback chain: Cerebras Qwen 235B → Mistral Medium → SambaNova Llama 3.3 70B
35-second per-provider timeout · automatic skip on 429 / 5xx / timeout
```

A full visual diagram is in [`pitch/Agent_Framework_Diagram.png`](pitch/Agent_Framework_Diagram.png).

---

## System requirements

### Local development
- **Node.js** ≥ 18.17 (tested on 20.x)
- **npm** ≥ 9 (comes with Node)
- **Git** for cloning the repo
- ~500 MB free disk space for `node_modules`

### External services (for full functionality)
- **Firebase** project — required (authentication + Firestore database)
- At least one **AI provider** API key — required (Cerebras recommended, free tier sufficient)
- **Vercel** account — required for production deployment (free tier works)
- **Tavily** API key — optional (for live price verification feature)

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/AliMGhalab/Flowid.ai.git
cd Flowid.ai

# 2. Install dependencies (Next.js, Firebase SDK, AI clients, etc.)
npm install

# 3. Create your local environment file
cp .env.local.example .env.local
#   Then open .env.local and fill in the values — see "Configuration guide" below.

# 4. Run the dev server
npm run dev

# 5. Open http://localhost:3000 in your browser
#    Sign in (email/password or Google), then click "New Project".
```

For a production build:

```bash
npm run build      # type-check + compile
npm run start      # serve the built app
```

---

## Configuration guide

All configuration is via environment variables in `.env.local`. The example file `.env.local.example` has the complete list with instructions.

### Step 1 — Firebase setup (required, ~5 min)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Under **Authentication → Sign-in method**: enable **Email/Password** and **Google**.
3. Under **Authentication → Settings → Authorized domains**: add your local + production domains.
4. Under **Build → Firestore Database**: create database (in production mode is fine).
5. Paste these **Firestore security rules** in the Rules tab:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read, update, delete: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

6. Under **Project Settings → General → Your apps**: register a web app and copy the `firebaseConfig` values into `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc
```

### Step 2 — Google OAuth setup (only if using Google sign-in)

1. Open [console.cloud.google.com](https://console.cloud.google.com) → select your Firebase project
2. **APIs & Services → Credentials → OAuth 2.0 Client IDs** → click the auto-created web client
3. Under **Authorised JavaScript origins** add:
   - `http://localhost:3000`
   - `https://your-production-domain.com`
4. Under **Authorised redirect URIs** add:
   - `http://localhost:3000/__/auth/handler`
   - `https://your-production-domain.com/__/auth/handler`

### Step 3 — AI provider keys (at least one required)

Add **at least one** of the following keys to `.env.local`. The fallback chain tries them in priority order:

| Priority | Provider | Where to get it | Free tier |
|---|---|---|---|
| Primary | **Cerebras** (recommended) | [cloud.cerebras.ai](https://cloud.cerebras.ai) | 30 RPM, 1M tokens/day |
| Fallback 1 | **Mistral** | [console.mistral.ai](https://console.mistral.ai) | 1 RPS, ~500k tokens/day |
| Fallback 2 | **SambaNova** | [cloud.sambanova.ai](https://cloud.sambanova.ai) | 20 RPM |
| Optional | **Gemini** | [aistudio.google.com](https://aistudio.google.com) | 1500 RPD |
| Optional | **Chutes** (DeepSeek V3) | [chutes.ai](https://chutes.ai) | Paid |

```env
CEREBRAS_API_KEY=csk-...
MISTRAL_API_KEY=...
SAMBANOVA_API_KEY=...
GEMINI_API_KEY=AIzaSy...
CHUTES_API_KEY=cpk_...
```

### Step 4 — Tavily (optional)

For the "Check Live Prices" button to query supplier websites:

```env
TAVILY_API_KEY=tvly-...
```

Get a free key at [app.tavily.com](https://app.tavily.com).

---

## Project structure

```
Flowid.ai/
├── src/
│   ├── app/                          ← Next.js 15 App Router pages
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── api/
│   │   │   ├── generate/route.ts     ← AI pipeline + validation (heart of the app)
│   │   │   └── price-check/route.ts  ← Tavily live price queries
│   │   ├── dashboard/page.tsx
│   │   ├── new-project/page.tsx      ← project intake form + multi-agent loading UI
│   │   ├── project/[id]/page.tsx     ← project result page with 8 tabs
│   │   ├── layout.tsx
│   │   ├── page.tsx                  ← marketing homepage
│   │   └── globals.css
│   ├── components/
│   │   ├── AuthProvider.tsx          ← Firebase Auth context
│   │   ├── ClientLayoutWrapper.tsx   ← SSR safety wrapper
│   │   ├── EngineerActionPlan.tsx    ← "what to revise + how to use" component
│   │   ├── HomeCTAs.tsx              ← auth-aware homepage buttons
│   │   ├── Navbar.tsx
│   │   ├── ProcessFlowDiagram.tsx    ← P&ID renderer (Mermaid.js + SVG download)
│   │   └── ValidationNotes.tsx       ← shows the 12-check audit results
│   ├── lib/
│   │   ├── exportProject.ts          ← PDF + Excel generation
│   │   ├── firebase.ts               ← Firebase initialisation
│   │   ├── firestore.ts              ← project save/load helpers
│   │   ├── fluidLabels.ts            ← user-facing fluid name map
│   │   └── priceSearch.ts            ← Tavily integration
│   └── types/
│       └── index.ts                  ← shared TypeScript interfaces
├── public/                           ← static assets
├── pitch/                            ← AIC submission deliverables
│   ├── Flowid_AI_Pitch_Deck.pptx
│   ├── Agent_Framework_Diagram.svg
│   ├── Agent_Framework_Diagram.png
│   ├── build-deck.js
│   └── svg-to-png.js
├── .env.local.example
├── FRONTEND_OVERVIEW.md              ← internal design brief for collaborators
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── README.md                         ← you are here
```

---

## How the multi-agent pipeline works

When an engineer submits a project, the `/api/generate` endpoint orchestrates the following:

1. **Request validation** — input checked against the `ProjectInput` schema
2. **Provider selection** — first available AI provider from the priority chain
3. **Single AI call** generates the entire structured response (all 6 "agents" in one prompt for token efficiency; the UI animates them sequentially)
4. **JSON repair** — handles truncation, markdown fences, trailing prose
5. **Cleanup pass** — drops malformed components, edges, risks before validation
6. **Cost reconciliation** — equipment cost is ALWAYS recomputed from the BOM sum; AACE percentages applied to other lines if AI's estimates drift out of typical range
7. **Engineering math verification** — NPSH margin, TDH, Reynolds, motor sizing re-computed server-side; corrected in place if AI drifted
8. **12-check validation suite** runs (see next section)
9. **Persist to Firestore** with the full validation report
10. **Return to client** — UI renders the project page with all tabs

If a provider fails (429, 5xx, timeout, parse error), the chain automatically advances to the next provider. Per-provider timeout is 35 seconds, leaving headroom under Vercel's 60-second function limit.

---

## Reliability — the 12 server-side checks

Every project is audited after AI generation. Results are visible to the engineer in the **Validation Notes** panel on the project page.

| # | Category | Check |
|---|---|---|
| 1 | Cost | Equipment cost equals sum of BOM line items |
| 2 | Cost | No single component exceeds 50% of total (decimal-error trap) |
| 3 | Math | NPSH margin = NPSHa − NPSHr (re-verified) |
| 4 | Math | Total Dynamic Head = static head + friction head |
| 5 | Math | Reynolds number recomputed from velocity, diameter, and water properties at operating temp |
| 6 | Math | Flow regime label (laminar/transitional/turbulent) matches the actual Reynolds value |
| 7 | Math | Motor size ≥ pump shaft power and on standard IEC 60034 step |
| 8 | Diagram | BOM pump count ↔ P&ID pump count consistency |
| 9 | Diagram | P&ID has at least 6 nodes, no orphan nodes |
| 10 | HAZOP | Required guidewords covered: NO FLOW, MORE PRESSURE, LEAK, ELECTRICAL FAULT |
| 11 | Material | Known fluid-material incompatibilities flagged (HCl + carbon steel, NH₃ + brass, etc.) |
| 12 | Supplier | Supplier names pattern-matched against Malaysian patterns (Sdn Bhd, known cities) |

When a check finds a problem, the system **auto-corrects in place** (e.g., overrides AI's equipment cost with the BOM sum) AND surfaces the action to the engineer as a visible note. Nothing is silenced.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 15** (App Router) + **TypeScript** |
| Styling | **Tailwind CSS v3** (dark theme, blue/cyan accent) |
| Authentication | **Firebase Auth** (Email/Password + Google OAuth) |
| Database | **Firestore** (persistent NoSQL) |
| AI providers | **OpenAI SDK** against Cerebras, Mistral, SambaNova, Gemini, Chutes endpoints |
| Schema validation | **Zod** (Pydantic equivalent for TypeScript) |
| Diagrams | **Mermaid.js** for P&ID rendering, native SVG export |
| PDF generation | **jsPDF** + **jspdf-autotable** |
| Excel generation | **SheetJS (xlsx)** |
| Icons | **lucide-react** |
| Toasts | **react-hot-toast** |
| Hosting | **Vercel** (serverless) |

---

## Deployment

The app is deployed at [flowid-ai.vercel.app](https://flowid-ai.vercel.app) via Vercel.

To deploy your own instance:

1. Push the repo to your own GitHub fork
2. Import the project at [vercel.com/new](https://vercel.com/new) — select the GitHub repo
3. Add the same environment variables from `.env.local` into **Vercel → Settings → Environment Variables**
4. Set the production branch (Settings → Git → Production Branch) to `master` if your default branch is `master`
5. Trigger a deploy — Vercel auto-detects Next.js and runs `npm run build`

Every push to the production branch auto-deploys.

---

## Disclaimer & licensing

**This is a feasibility / pre-FEED engineering tool. It does not replace a licensed Professional Engineer.**

All outputs are AI-generated and intended to support — not replace — the judgement of a licensed PE. Every report must be reviewed and validated by a qualified PE before procurement, fabrication, or installation. Results do not constitute a certified engineering design under DOSH (Department of Occupational Safety & Health), BOMBA (Fire & Rescue Department), SIRIM (Standards & Industrial Research Institute of Malaysia), or any other Malaysian regulatory framework.

Cost estimates follow AACE International Class 4–5 methodology (typical accuracy ±30–50%). For procurement-grade pricing, supplier quotations must be obtained.

Source code is currently private/hackathon submission. Licensing terms to be determined for any commercial release.

---

## Team & contact

| | |
|---|---|
| **Ali Ghalab** | Mechatronics Engineer · full-stack, AI integration, system architecture |
| | [alimohamedrefai@gmail.com](mailto:alimohamedrefai@gmail.com) · +60 17-335 6536 |
| **Amr Ghalab** | Multimedia Technician · UI/UX, brand identity, multimedia |
| | [amrmohamedrefai@gmail.com](mailto:amrmohamedrefai@gmail.com) · +60 19-935 6380 |

Built in 4 days for **AIC Hackathon 2026**. Malaysia.
