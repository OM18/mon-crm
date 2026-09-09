# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

X-AGRI CRM: a single-page React app for managing companies, contacts, tasks, financial derivatives,
physical contracts, vessels, voyages, trades, and costs for an agri-commodity trading operation.
Data is persisted to Supabase (Postgres via REST), used purely as a JSON document store.

## Commands

- `npm run dev` — start Vite dev server (port 5173, `host: true` for LAN access)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — ESLint (flat config, `eslint.config.js`)

There is no test runner configured (no jest/vitest dependency, no test script in `package.json`).
`src/App.test.js` is dead code left over from the original Create React App scaffold — it imports
`./App` (the old CRA file, not the live `App.jsx`) and cannot run as-is.

## Architecture

### The app is one file

`src/App.jsx` (~25k lines) is the entire application: every page/tab, every modal, every import/export
wizard, all styling (inline style objects, no CSS framework), and the root `CRM()` component are all
defined in this one module, as ~150 sibling top-level `const Foo = (...) => {...}` components. There is
no router — `CRM()` holds a single `page` string in state (persisted to `localStorage.crm_page`) and
conditionally renders the matching feature component in the main pane; the sidebar just calls `setPage`.

When asked to work on a feature, grep `App.jsx` for the component name (e.g. `const Contracts =`,
`const Trades =`) rather than expecting a dedicated file — nearly everything lives in this file.

### Dead/legacy files — do not edit expecting them to run

Entry point is `index.html` → `src/main.jsx` → `src/App.jsx`. The following are leftovers from an
earlier Create React App version of this project and are **not** part of the Vite build graph:
`src/App.js`, `src/App_66.jsx` (an old snapshot of App.jsx), `src/index.js`, `src/reportWebVitals.js`,
`src/setupTests.js`, `src/App.test.js`. `src/BACKUP/` contains historical Excel workbooks used as
source data for one-off migrations, not code.

### Data layer: Supabase as a document store

`src/supabase.js` creates the client with a hardcoded project URL and anon key (this is the existing,
intentional pattern in this codebase — not an oversight to "fix" by moving to env vars unless asked).

Every domain table (`contacts`, `companies`, `tasks`, `contracts`, `vessels`, `voyages`, `trades`,
`costs`, `derivatives`, `fixings`, `deriv_products`, `employees`, `config`) stores each record as a row
with an opaque `data` jsonb column — Postgres columns are not used for individual fields. Reads paginate
in chunks of 1000 via `.range()` (see `loadAllPages` in the root `CRM()` effect).

Writes follow one of two patterns:
- **Delete-all-then-reinsert** (`safeSave`, `saveLargeTable` near the top of `App.jsx`): wipes the
  table and re-inserts everything in chunks (100 or 50 rows). `safeSave` refuses to wipe a table if the
  new list is empty but the previous one wasn't, to guard against accidental data loss. Used for most
  tables (contacts, companies, tasks, contracts, vessels, voyages, trades, costs).
- **Diff update/insert/delete by id** (`saveProducts`, used for `deriv_products`): the Supabase row id
  is auto-generated and can't be bulk-upserted, so this diffs against existing rows and issues
  per-row updates/inserts/deletes instead of a full wipe.

Each domain component typically defines its own local `persist(updated)` closure that calls one of
these save helpers and updates local state — look for `const persist = async (updated) => {...}` inside
the component you're editing rather than assuming a shared abstraction.

Global config (dropdown options, business units, incoterms, ports, commodities, timezones, decimal
precision, etc.) is a single JSON blob in the `config` table under `key = 'admin-config'`, loaded/saved
by `ConfigProvider` (top of `App.jsx`) and merged over `DEFAULT_CONFIG`. It's exposed via
`useContext(ConfigContext)` and edited through the various `*Editor` / `*Block` components rendered
inside `AdminPanel`.

### Auth

Custom, not Supabase Auth: `LoginPage` checks `email`/`password` against the `employees` table
client-side (plaintext comparison), the matched employee record is cached in
`localStorage.crm_current_user`, and `useAutoLogout` handles session timeout/warning. Role gating
(`currentUser.role === "admin"`) controls visibility of the Admin Panel nav item — there's no
server-side authorization, so treat this as UI-level gating only.

### Feature areas (top-level components in `App.jsx`)

Companies / CompaniesDashboard, Contacts, Tasks, Pipeline, Derivatives / DerivativesDashboard /
DerivStatistics / FixingsTab, Contracts, Vessels, Voyages, Trades, Costs, AdminPanel. Most have a
matching `*ImportModal` / `*ExportModal` pair built on the `xlsx` package, with header-guessing helpers
(`guessField`, `guessFieldDP`, `guessFieldDA`) to auto-map spreadsheet columns during import.

`AdminPanel` also embeds one-off `Batch*OldToNew` / `Batch*NewToOld` migration tools (e.g.
`BatchContractsOldToNew`, `BatchCompaniesOldToNew`) for converting data between this CRM's schema and
the legacy Excel-based workflow in `src/BACKUP/` — these are migration utilities, not part of normal
day-to-day usage.

### Large lists

Big tables (companies, vessels, voyages, costs, trades) render through hand-rolled windowing
components (`VirtualList`, `VirtualCompanyList`, `VirtualVesselList`, `VirtualVoyageList`,
`VirtualTradeList`, `VirtualCostList`) rather than an external virtualization library — reuse these
patterns instead of introducing a new one.

### Styling

No CSS framework. Everything is inline `style={{...}}` objects referencing the `COLORS` palette (dark
theme, gold/`#D4AF37` accent) defined near the top of `App.jsx`. `App.css`/`index.css` only hold a
minimal reset. Follow the inline-style convention for consistency rather than introducing CSS modules
or a component library.
