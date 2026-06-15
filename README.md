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

**Scan / import backup counts.** At the top of the Lineup is a **Scan / import** panel
for prefilling the whole Backups on Hand column at once. Click *Scan / import…*, then:

- **Upload a photo (JPEG/PNG)** of the freezer door. The app upscales, grayscales and
  contrast-boosts the image, runs OCR in your browser (Tesseract.js, downloaded once from
  a CDN — so the *scan* needs internet the first time; the rest of the app stays offline),
  reads the printed flavor labels, and counts the handwritten tally strokes next to each
  (projecting the pen ink and counting separated vertical strokes). It then **writes those
  counts straight into the Backups on Hand column** for the flavors it recognizes and
  shows a short summary — no raw-text review screen. **Double-check the Backups column
  afterward** and fix anything off (counts and OCR are approximate — photo angle, smudges,
  and faint marks all affect them). Flavors it didn't recognize are left unchanged; lines
  it couldn't count are reported so you can enter them by hand. Best results come from a
  close, straight-on, well-lit shot.
- **Or paste counts as text** — one flavor per line with a number (`Coffee 3`) or tally
  strokes (`Coffee |||`). This path is fully offline and the most reliable.

Either way you land on a review table: each line is fuzzy-matched to a catalog flavor
(the door's abbreviated labels like `MI Pothole`, `ND Chocolate`, or `Orange Sherbert`
resolve to *Michigan Pothole*, *Non-Dairy Chocolate*, *Sherbet Orange*), with a
confidence badge — **match** (green) is confident, **check** (amber) needs a glance,
**no match** (red) needs you to pick the flavor or leave it `(ignore)`. Fix any count or
flavor inline, then *Apply to Backups on Hand*. By default any displayed flavor **not**
listed is set to 0 (an unmarked label = none in the freezer); untick the checkbox if your
sheet covers only part of the freezer. Nothing is written until you press Apply, so a
misread is always caught at the review step.

Tip: for perfectly accurate counts you can also snap the door photo to Claude in chat and
have it read the tallies into a paste-ready list.

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
