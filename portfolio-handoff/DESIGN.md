# DESIGN.md — Visual System

Lock the production UI to the draft in `reference/dashboard-draft.jsx`. These are the exact
tokens and recipes used there. Don't introduce new colors, fonts, or decorative elements.

## Principles
- Calm, precise, data-forward — a private-banking statement, not a flashy app.
- One accent (navy). Semantic green/red **only** for gain/loss figures.
- Hairline borders, generous white space, no shadows beyond subtle, no gradients.
- Numbers use tabular figures and align cleanly.

## Color tokens
| Token        | Hex       | Use |
|--------------|-----------|-----|
| canvas       | `#F7F8FA` | page background |
| surface      | `#FFFFFF` | cards |
| ink          | `#111827` | primary text, dark "Add" button |
| muted        | `#6B7280` | secondary text, labels |
| hairline     | `#E5E7EB` | borders, dividers |
| primary      | `#1E3A5F` | buttons, active toggle, chart line (hover `#16314F`) |
| positive     | `#15803D` | gains |
| negative     | `#B91C1C` | losses, destructive |

**Asset-class colors** (badges + class allocation): Stock `#1E3A5F`, ETF `#3F6FA3`,
Crypto `#C9A35B`, Cash `#6B7280`.
**Donut palette** (ticker allocation): `#1E3A5F, #3F6FA3, #6FA0C9, #A9B8C9, #C9A35B, #8A8F98, #5B7C99`.

### Tailwind theme (add to `tailwind.config.ts`)
```ts
extend: {
  colors: {
    canvas: '#F7F8FA', surface: '#FFFFFF', ink: '#111827', muted: '#6B7280',
    hairline: '#E5E7EB', primary: { DEFAULT: '#1E3A5F', hover: '#16314F' },
    positive: '#15803D', negative: '#B91C1C',
  },
}
```
Keep class/donut colors as constants in `lib/constants.ts`.

## Typography
- Family: system sans (`ui-sans-serif, system-ui, sans-serif`). No web fonts.
- Enable tabular numerals globally on the app shell (`tabular-nums`).
- Scale: hero value `text-2xl font-semibold`; section/stat values `text-xl font-semibold`;
  page title `text-lg font-semibold tracking-tight`; body `text-sm`; labels/captions `text-xs`
  or `text-[11px]` in `muted`, table headers `text-[11px] uppercase tracking-wide`.

## Layout
- Container: `max-w-6xl mx-auto px-5`. Sticky translucent header with bottom hairline.
- Card recipe: `rounded-lg bg-surface border border-hairline p-4`.
- Grids: summary `grid grid-cols-2 md:grid-cols-4 gap-3`; main `grid lg:grid-cols-3 gap-6`
  (left content `lg:col-span-2`, allocation right). Development chart full-width below.

## Component recipes (match the draft)
- **Stat card**: label (`text-xs muted`), value (`text-xl`/`text-2xl font-semibold`), optional sub.
- **Field / Select**: `rounded-md border border-hairline px-2.5 py-2 text-sm`,
  focus `border-primary ring-1 ring-primary`; disabled `bg-[#F3F4F6] text-[#9CA3AF]`.
- **Class badge**: pill, text = class color, background = class color at ~8% (`${color}14`),
  with a small dot.
- **Toggle** (Ticker/Class): bordered group; active segment `bg-primary text-white`, inactive `muted`.
- **Buttons**: primary = `bg-primary text-white` (update); ink = `bg-ink text-white` (add);
  destructive/ghost = `muted` → hover `negative`.
- **Table**: header row `text-[11px] uppercase muted` with bottom hairline; rows separated by
  `#F1F2F4`, hover `#FAFBFC`; numeric cells right-readable, gain/loss colored by sign.
- **Charts (recharts)**: donut `innerRadius 48 / outerRadius 70`, `paddingAngle 2`;
  line chart stroke `primary` width 2, dots r3, grid `#F1F2F4` horizontal only, axes in `muted`,
  Y ticks compact currency (`$12.5K`), X ticks short date (`Jun 17`).

## Copy
Plain, active voice. Buttons say what happens ("Update prices", "Add"). Empty states invite
action and explain mechanics honestly (e.g. snapshots fill in as days pass). Errors explain the
fix, no apologies.
