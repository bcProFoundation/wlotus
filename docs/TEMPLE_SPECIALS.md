# Temple specials — ghosts & heroes

Desk/temple-managed profiles with optional **event windows** that raise the
memorial burn above the normal 1-atom flower.

## Behaviour

| Mode | When | Burn | Desk keeps (of 102) | UI |
|------|------|------|---------------------|----|
| Flower | Always (default) | **1** | 101 | Dâng Hoa |
| Special | Active window + parent = registered profile | **102 − deskKeep** | **deskKeep** | Cúng (ghosts) |

- Temple still receives **6** from the covenant on every remint.
- **Outside the window the profile stays fully offerable** — only the burn
  amount changes on the event day. Challenges are never rejected for being
  “off day”.

### deskKeep

Configurable **atoms the desk retains** after the memorial burn during the
active window:

| deskKeep | burnAtoms | Use |
|----------|-----------|-----|
| **6** (default) | 96 | Partial special offering |
| **0** | 102 | Full miner-share burn (classic Hungry Ghost) |
| 101 | 1 | Same as normal flower |

### Kinds

| kind | Birth date | Event date |
|------|------------|------------|
| `ghost` | typically empty (no birthday) | death / festival day |
| `hero` | optional / recommended | birth or death anniversary |

Ghosts and heroes are **created by the desk/temple** (root dedication burn),
then registered in config. On-chain altar fields stay as today; the special
registry is server-side authority for burn amount + window.

### Window (server clock)

Global civil day around the effective event date (UTC−12 … UTC+14, ~50 h).
Client clock cannot unlock a higher burn early.

## Config

### Preferred — multiple specials

```bash
TEMPLE_SPECIALS_JSON='[
  {
    "profileId": "<64-hex root burn>",
    "kind": "ghost",
    "eventDate": "2026-08-28",
    "deskKeep": 0,
    "name": "Cô Hồn",
    "testOffsetDays": 0
  },
  {
    "profileId": "<64-hex>",
    "kind": "hero",
    "eventDate": "2026-09-02",
    "birthDate": "1925-09-02",
    "deskKeep": 6,
    "name": "…"
  }
]'
```

### Legacy — single Hungry Ghost

| mint-api | SPA (Vite) | Meaning |
|----------|------------|---------|
| `HUNGRY_GHOST_PROFILE_ID` | `VITE_HUNGRY_GHOST_PROFILE_ID` | Root burn txid |
| `HUNGRY_GHOST_DEAD_DATE` | `VITE_HUNGRY_GHOST_DEAD_DATE` | Solar event date |
| `HUNGRY_GHOST_DESK_KEEP` | `VITE_HUNGRY_GHOST_DESK_KEEP` | Default **6**; set **0** for full 102 burn |
| `HUNGRY_GHOST_TEST_OFFSET_DAYS` | `VITE_HUNGRY_GHOST_TEST_OFFSET_DAYS` | Shift event earlier for tests |
| `HUNGRY_GHOST_NAME` | `VITE_HUNGRY_GHOST_NAME` | Display name (default Cô Hồn) |

`GET /api/status` → `templeSpecials`:

```json
{
  "enabled": true,
  "serverNow": "…",
  "profiles": [ { "profileId", "kind", "active", "burnAtoms", "deskKeep", "windowStartUtc", "windowEndUtc", … } ],
  "active": [ /* subset currently in window */ ]
}
```

## Ops checklist

1. Create the profile on-chain (root burn) — name, death date (ghosts), optional birth (heroes).
2. Register in `TEMPLE_SPECIALS_JSON` or legacy `HUNGRY_GHOST_*` on the VM + matching `VITE_*` for the SPA.
3. Restart mint-api; confirm `/api/status` → `templeSpecials.active` during the window.
4. Dryrun: set `testOffsetDays` (or `HUNGRY_GHOST_TEST_OFFSET_DAYS`), verify burn amount, then clear offset for prod.

## Code

| Piece | Role |
|-------|------|
| `src/params/templeSpecials.ts` | Config, window, burn resolution |
| `src/offering/burnPrayer.ts` | `burnOnePrayer({ burnAtoms })` |
| mint-api `offer.ts` | Resolve burn at `/api/burn` time; status field |
| web `hungryGhostUi.ts` / specials helpers | Cúng copy when active ghost |
