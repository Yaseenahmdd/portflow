# Portflow Interface System

## Direction and feel

Portflow is a personal capital ledger: private-wealth discipline with the clarity of a modern market terminal. It should feel calm, precise, trustworthy, and compact without looking like a generic SaaS dashboard.

The primary user is a personal investor checking portfolio value, capital contributed, market movement, allocation, and recent activity. Financial meaning leads; decoration stays quiet.

Domain concepts that shape the interface: capital allocation, cost basis, portfolio weight, realized and unrealized return, cash flow, diversification, benchmark-relative performance, drawdown, market exposure, and audit trail.

## Color world

- Ledger paper: `#f3f1ec` canvas and `#fbfaf7` working surfaces.
- Market ink: `#14202d` primary light-mode text and chrome.
- Exchange blue: `#2f6597` is the sole interactive accent.
- Gain jade: `#237654` light / `#5bc08c` dark, reserved for positive financial meaning.
- Loss brick: `#b34b4b` light / `#e27777` dark, reserved for negative financial meaning.
- Midnight ledger: `#071019` canvas and `#0c1824` surfaces in dark mode.
- Bullion amber is reserved for warnings or investment data, never general decoration.

Use a 60/30/10 distribution: neutral canvas and surfaces dominate, secondary ink structures the view, and exchange blue is scarce. Green and red are semantic, not branding.

## Signature

The **Portflow Line** is a thin capital-flow rail showing the relationship between capital contributed and market value. Use it in portfolio summary, history, and meaningful empty states. It should always include a small terminal marker and contextual labels; it is not a decorative progress bar.

## Depth and geometry

- Depth strategy: borders-only for primary structure; shadows only for temporary overlays such as menus and sheets.
- Borders: low-opacity ink in light mode and low-opacity pale blue-gray in dark mode.
- Spacing base: 4px.
- Micro gaps: 4–8px; component padding: 12–20px; section spacing: 16–24px; major separation: 32px+.
- Radius scale: 6px controls, 8px buttons and compact groups, 12px cards, 16px modals, 32px mobile bottom sheets.
- Avoid large pill controls except true tags or statuses.
- Inputs are inset: use the control/input surface, slightly darker than surrounding cards.

## Hierarchy

- One focal point per view. On Overview, portfolio value leads. On Holdings, the ledger leads. On Activity, the transaction record leads. On History, contribution-adjusted performance leads.
- Type scale uses a calm minor-third rhythm: 11px kicker, 13–14px supporting text, 16–18px section title, 24–28px page title, 32–36px primary financial value.
- Weight and tone carry more hierarchy than size.
- Use four text levels: primary, secondary, tertiary/metadata, and muted/disabled.
- Financial values use IBM Plex Mono with tabular numbers and slashed zero.
- Interface and display typography use IBM Plex Sans Variable.
- Section kickers use `ledger-kicker`: 11px, 600 weight, uppercase, 0.13em tracking.

## Navigation

- Keep the horizontal portfolio rail; do not introduce a generic dashboard sidebar.
- Brand lockup includes the small Portflow Line mark and “Personal capital ledger” descriptor on desktop.
- Primary areas are Overview, Holdings, Activity, and History.
- Active navigation uses an exchange-blue underline; inactive labels remain quiet.
- Currency, refresh, privacy, theme, and profile controls stay in the compact header command area.

## Reusable patterns

- Primary card: ledger surface, 1px quiet border, 12px radius, no persistent shadow.
- Primary button: 44px minimum hit area, 8px radius, exchange-blue fill, white label, 13–14px/600; active scale `0.97–0.99`.
- Secondary button: ledger surface, quiet border, 8px radius, secondary ink; no pill shape.
- Segmented control: inset surface, 6–8px radius, 2px internal padding; selected segment returns to card surface with a subtle ring.
- Portfolio summary: primary value in mono, Portflow Line underneath, supporting performance in separate quieter columns.
- Chart card: visible domain kicker and title, controls grouped near title, range selector aligned opposite, no decorative chart color.
- Holdings ledger: compact filters, uppercase 11px table headers, left-aligned identity, right/center-aligned tabular values, semantic gain/loss only.
- Empty state: preserve the future component footprint but reduce blank space; show the Portflow Line, explain what data is missing, and offer one direct next action.
- Overlay: one level above its parent, 12px radius, quiet border, restrained shadow, origin-aware motion.

## Motion and states

- Button press: 100–160ms scale feedback.
- Popovers and sheets: 150–250ms, transform and opacity only, custom ease-out.
- Never use `transition: all` or animate layout dimensions.
- Every control needs hover, active, focus-visible, and disabled treatment.
- Data surfaces need loading, empty, error, and partial-data states.
- Respect `prefers-reduced-motion` globally.

## Guardrails

- No colorful KPI tile grids.
- No decorative gradients.
- No mixed shadow-and-border depth systems.
- No arbitrary gray or slate literals when a semantic token exists.
- No large blank chart when the portfolio has only zero-value snapshots.
- No generic sidebar, oversized pill buttons, or same-radius-everywhere styling.
- Preserve dense comparison views; do not turn investment tables into marketing cards.

## Approved implementation reference

The approved direction is implemented on branch `codex/portflow-investment-ui`, beginning with commit `6224d1f` (`Redesign portfolio UI as a capital ledger`). Future work should extend its token names, Portflow Line signature, density, and responsive behavior rather than introducing a parallel visual language.
