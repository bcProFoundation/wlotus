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

Example: eventDate `2026-08-28`, offset `15` → effective day `2026-08-13`.

### Kinds

| kind | Birth date | Event date |
|------|------------|------------|
| `ghost` | typically empty (no birthday) | death / festival day |
| `hero` | optional / recommended | birth or death anniversary |

Ghosts and heroes are **created by the desk/temple** (root dedication burn),
then registered in `TEMPLE_SPECIALS_JSON`. On-chain altar fields stay as today;
the special registry is server-side authority for windows + burn amount.

### Window (server clock)

Global civil day around the effective event date (UTC−12 … UTC+14, ~50 h).
Client clock cannot unlock a higher burn early.

## Config

### Profiles — `TEMPLE_SPECIALS_JSON`

```bash
TEMPLE_SPECIALS_JSON='[
  {
    "profileId": "<64-hex root burn>",
    "kind": "ghost",
    "eventDate": "2026-08-28",
    "name": "Cô Hồn"
  },
  {
    "profileId": "<64-hex>",
    "kind": "hero",
    "eventDate": "2026-09-02",
    "birthDate": "1925-09-02",
    "name": "…"
  }
]'
```

No `deskKeep` or `testOffsetDays` inside the JSON — those are global only.

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
  "profiles": [ { "profileId", "kind", "active", "effectiveEventDate", "windowStartUtc", "windowEndUtc", … } ],
  "active": [ /* subset currently in window */ ]
}
```

## Ops checklist

1. Create the profile on-chain (root burn) — name, death date (ghosts), optional birth (heroes).
2. Set `TEMPLE_SPECIALS_JSON` on the VM and matching `VITE_TEMPLE_SPECIALS_JSON` for the SPA build.
3. Set `TEMPLE_SPECIAL_DESK_KEEP` (e.g. `0` for full burn, or leave default `6`).
4. Restart mint-api; confirm `/api/status` → `templeSpecials.active` during the window.
5. **Test env:** set `TEMPLE_SPECIAL_TEST_OFFSET_DAYS` (e.g. `7` or `15`), verify burns, then set back to `0` for prod.

## Code

| Piece | Role |
|-------|------|
| `src/params/templeSpecials.ts` | Config, window, burn resolution |
| `src/offering/burnPrayer.ts` | `burnOnePrayer({ burnAtoms })` |
| mint-api `offer.ts` | Resolve burn at `/api/burn` time; status field |
| web specials helpers | Cúng copy when active ghost |
