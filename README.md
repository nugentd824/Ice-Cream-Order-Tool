# Jersey Junction — Ordering & Inventory

A single-file web app for running the dipping cabinet, back freezer, and Cedar Crest
orders at Jersey Junction (Grand Rapids, MI). No server, no build step, no framework.

Repository: <https://github.com/nugentd824/Ice-Cream-Order-Tool>

## How to run

Double-click `index.html` (or open it in any browser). That's it.

To grab it from GitHub: open the repo above, download `index.html`, and double-click it.
The UI is styled to match the jerseyjunction.com storefront; it loads the Poppins
heading font from Google Fonts when online and falls back to your system font offline.

All data — on-hand counts, well assignments, seasonal renames, and settings — is saved
automatically in the browser's localStorage. Refreshing or closing the tab loses nothing.
Note: data lives in *that browser on that device*; use the same tablet/browser to keep
your counts. **Reset everything to defaults** is in the Settings tab.

## The three tabs

### Lineup
The 32-well dipping cabinet grouped by well type, plus the off-line pool:

- **Core** — high-velocity flavors, ranked in by velocity. If you assign more core
  flavors than there are core wells, the slowest are benched to the off-line pool.
- **Non-Dairy** — permanently reserved wells, exempt from velocity ranking.
- **Seasonal** — renameable wells. Type a new name/brand right in the row to rotate a
  flavor in (pumpkin in fall, etc.) and adjust its tubs/week estimate.
- **Off-line pool** — flavors not on display (special order / rotation candidates).
  Change any flavor's **Well type** dropdown to move it between groups. You can also add
  brand-new flavors to the pool.

Enter each flavor's **backup tubs on hand** (back freezer) here or on the order sheets —
order quantities update live. The open storefront tub is counted automatically
(tubs-per-well setting, default 1).

### Order Sheets
Three sheets — **Friday first and most prominent** (covers Fri–Sun, ~50% of weekly
sales, no resupply until Monday), then Monday and Wednesday (each covers 2 days; the
next truck corrects a miss). Each line shows flavor, brand, well type, on-hand, target,
**order qty**, storage tier (Storefront-only / +N backups), and a one-line reason.

- **Weekend stockout alerts** appear at the top, worst first.
- **Group by brand** toggle reorganizes each sheet with per-brand subtotals so you can
  build one order per supplier.
- Zero-order lines are dimmed but kept visible for counting.

### Settings
Every knob is editable and persisted: well counts (storefront / non-dairy / seasonal),
back-freezer capacity, tubs counted per well, weekend sales share, safety factors,
season multipliers, peak months, and a **season override** to plan ahead for a
different season than today's date implies.

## How the math works

- `weekly velocity = tubs/week × season multiplier` (peak ×2.3, shoulder ×1.0, winter ×0.5
  — annual-average velocities understate May–Aug, the multiplier corrects for that)
- Weekend (Fri–Sun) gets the weekend share (default 50%) of weekly demand; the rest
  spreads over Mon–Thu.
- **Friday target** = weekend demand × weekend safety (1.4), rounded up.
  `backups needed = target − the storefront tub`.
- **Monday/Wednesday target** = 2 days of weekday demand × weekday safety (1.2).
- `order qty = max(0, target − on hand)`, whole tubs. On hand = storefront tub + your
  entered backups.

**Capacity rationing (May–August only):** if total planned backups exceed the 100-tub
back freezer, backups are trimmed from the lowest weekend-velocity flavors first (never
top sellers), pushing them toward storefront-only. The sheet shows the cutoff and exactly
which flavors lost tubs. Outside peak season, rationing is skipped and everything orders
to par.

The header gauges (storefront wells used, back-freezer backups, Friday planned backups)
turn red when over capacity.
