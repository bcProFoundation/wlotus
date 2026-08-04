# Temple specials — ghosts & heroes

Desk/temple-managed profiles with optional **event windows** that raise the
memorial burn above the normal 1-atom flower.

## Behaviour

| Mode | When | Burn | Desk keeps (of 102) | UI |
|------|------|------|---------------------|----|
| Flower | Always (default) | **1** | 101 | Dâng Hoa |
| Special | Active window + parent = registered profile | **102 − deskKeep** | **deskKeep** (global) | Cúng (ghosts) |

- Temple still receives **6** from the covenant on every remint.
- **Outside the window the profile stays fully offerable** — only the burn
  amount changes on the event day. Challenges are never rejected for being
  “off day”.

### Global `deskKeep` (not per-profile)

Atoms the desk retains after a special-event burn. One value for all specials:

| deskKeep | burnAtoms | Use |
|----------|-----------|-----|
| **6** (default) | 96 | Partial special offering |
| **0** | 102 | Full miner-share burn |
| 101 | 1 | Same as normal flower |

Set via **`TEMPLE_SPECIAL_DESK_KEEP`** (mint-api) / **`VITE_TEMPLE_SPECIAL_DESK_KEEP`** (SPA).

### Global test offset

**`TEMPLE_SPECIAL_TEST_OFFSET_DAYS`** (and `VITE_*`) shifts **every** profile’s
effective event date **earlier** by N days so the window can be exercised on a
test env before launch. Set **0** in production.

Example: solar eventDate `2026-08-28`, offset `15` → effective day `2026-08-13`.

### Event calendar (lunar vs solar)

Each profile’s `eventDate` is interpreted according to **`eventCalendar`**:

| `eventCalendar` | Meaning | Example |
|-----------------|---------|---------|
| **`lunar`** (default) | `eventDate` is âm lịch YYYY-MM-DD; converted to solar via Hồ Ngọc Đức (VN UTC+7) before the civil-day window | Cô Hồn / Vu Lan: lunar `2026-07-15` |
| **`solar`** | `eventDate` is already Gregorian YYYY-MM-DD | Hồ Chí Minh death anniversary: `2026-09-02` |

Leap months are not yet supported in the JSON (`eventLeap`); use the non-leap
month or set `eventCalendar: "solar"` with the known solar date.

### Kinds

| kind | Birth date | Event date |
|------|------------|------------|
| `ghost` | typically empty (no birthday) | death / festival day |
| `hero` | optional / recommended | birth or death anniversary |

Ghosts and heroes are **created by the desk/temple** (root dedication burn),
then registered in `TEMPLE_SPECIALS_JSON`. On-chain altar fields stay as today;
the special registry is server-side authority for windows + burn amount.

### Window (server clock)

Global civil day around the **effective solar** event date (UTC−12 … UTC+14, ~50 h).
Client clock cannot unlock a higher burn early.

## Config

### Profiles — `TEMPLE_SPECIALS_JSON`

```bash
TEMPLE_SPECIALS_JSON='[
  {
    "profileId": "<64-hex root burn>",
    "kind": "ghost",
    "eventDate": "2026-07-15",
    "eventCalendar": "lunar",
    "name": "Cô Hồn"
  },
  {
    "profileId": "<64-hex>",
    "kind": "hero",
    "eventDate": "2026-09-02",
    "eventCalendar": "solar",
    "birthDate": "1890-05-19",
    "name": "Hồ Chí Minh"
  }
]'
```

- `eventCalendar` is optional; **defaults to `"lunar"`**.
- No `deskKeep` or `testOffsetDays` inside the JSON — those are global only.

### Global env / GitHub variables

| mint-api / Contabo | GitHub Actions (SPA) | Meaning |
|--------------------|----------------------|---------|
| `TEMPLE_SPECIALS_JSON` | `VITE_TEMPLE_SPECIALS_JSON` | Profile list (JSON array) |
| `TEMPLE_SPECIAL_DESK_KEEP` | `VITE_TEMPLE_SPECIAL_DESK_KEEP` | Desk retain on specials (default **6**) |
| `TEMPLE_SPECIAL_TEST_OFFSET_DAYS` | `VITE_TEMPLE_SPECIAL_TEST_OFFSET_DAYS` | Shift all event dates earlier (test only; default **0**) |

There is **no** legacy `HUNGRY_GHOST_*` config.

`GET /api/status` → `templeSpecials`:

```json
{
  "enabled": true,
  "serverNow": "…",
  "deskKeep": 6,
  "testOffsetDays": 0,
  "burnAtoms": "96",
  "profiles": [ {
    "profileId", "kind", "eventDate", "eventCalendar",
    "effectiveEventDate", "active", "windowStartUtc", "windowEndUtc", …
  } ],
  "active": [ /* subset currently in window */ ]
}
```

## Ops checklist

1. Create the profile on-chain (root burn) — name, death date (ghosts), optional birth (heroes).
2. Set `TEMPLE_SPECIALS_JSON` on the VM and matching `VITE_TEMPLE_SPECIALS_JSON` for the SPA build.
   - Use `"eventCalendar": "lunar"` (or omit) for âm lịch festivals.
   - Use `"eventCalendar": "solar"` for fixed Gregorian anniversaries (Hồ Chí Minh, etc.).
3. Set `TEMPLE_SPECIAL_DESK_KEEP` (e.g. `0` for full burn, or leave default `6`).
4. Restart mint-api; confirm `/api/status` → `templeSpecials.active` during the window.
5. **Test env:** set `TEMPLE_SPECIAL_TEST_OFFSET_DAYS` (e.g. `7` or `15`), verify burns, then set back to `0` for prod.

## Creating public specials on-chain (Vu Lan + Cô Hồn)

Specials are **not** JSON-only. Search (dana-index) and re-offers need a real
root dedication burn. Flow:

1. **Burn root altars from desk inventory** (1 atom each — no new remint):

   ```bash
   set -a && source /etc/wlotus/mint.env && set +a
   # optional dry-run first
   CREATE_TEMPLE_SPECIALS_DRY_RUN=1 npm run create-temple-specials
   npm run create-temple-specials
   ```

   The script scans tip fee wallets + desk for WLOTUS inventory (leftover miner
   share after sponsored offerings), burns two roots (**Vu Lan**, **Cô Hồn**),
   and writes `deployments/temple-specials-created.json` with the
   `TEMPLE_SPECIALS_JSON` snippet.

2. **Register** the printed JSON on mint-api (`TEMPLE_SPECIALS_JSON`) and the
   matching `VITE_TEMPLE_SPECIALS_JSON` for the SPA build. Restart mint-api.

3. Confirm `/api/status` → `templeSpecials.profiles` lists both; during the
   lunar 15/7 window they appear under `active`.

Both profiles share the same lunar event day (`2026-07-15` by default). Override
with `EVENT_LUNAR_YMD` / `EVENT_YEAR` if needed.

The first burn is always from the **temple/desk** — there is no external
offerer yet. That is expected and correct.

## Code

| Piece | Role |
|-------|------|
| `src/params/templeSpecials.ts` | Config, window, burn resolution, lunar/solar |
| `src/lib/lunarCalendar.ts` | Hồ Ngọc Đức lunar ↔ solar (shared) |
| `src/offering/burnPrayer.ts` | `burnOnePrayer({ burnAtoms })` |
| mint-api `offer.ts` | Resolve burn at `/api/burn` time; status field |
| web specials helpers | Cúng copy when active ghost |
