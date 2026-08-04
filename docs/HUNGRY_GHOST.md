# Hungry Ghost day — Cúng Cô Hồn

Launch festival mode for **Cô Hồn** (Hungry Ghost / 孤魂). On the configured
solar date, re-offers to the official profile burn the **full miner share
(102)** instead of the usual flower burn (**1**). The temple still receives
**6** from the covenant on every remint.

## Behaviour

| Mode | When | Burn | Desk keeps | UI (VI) |
|------|------|------|------------|---------|
| Flower | Normal days | 1 | 101 | Dâng Hoa |
| **Cúng** | Festival window + parent = profile | **102** | **0** | **Cúng** |

### Window (server clock)

Eligibility uses **mint-api server time only** — changing the phone locale or
clock cannot unlock Cúng early.

The active window is the configured civil day as observed **anywhere on Earth**:

- Opens when UTC+14 enters the date  
- Closes when UTC−12 leaves the date  

≈ 50 hours around the solar `YYYY-MM-DD`.

### Profile

Create the Cô Hồn dedication on launch day (name **Cô Hồn**, death date = launch
day). Put the **root burn txid** in config:

| Env (mint-api / Contabo) | GitHub Actions variable (web) | Meaning |
|--------------------------|-------------------------------|---------|
| `HUNGRY_GHOST_PROFILE_ID` | `VITE_HUNGRY_GHOST_PROFILE_ID` | 64-hex root burn txid |
| `HUNGRY_GHOST_DEAD_DATE` | `VITE_HUNGRY_GHOST_DEAD_DATE` | Solar `YYYY-MM-DD` |
| `HUNGRY_GHOST_TEST_OFFSET_DAYS` | `VITE_HUNGRY_GHOST_TEST_OFFSET_DAYS` | Shift effective date **earlier** by N days for pre-launch tests |

Example: dead date `2026-08-28`, test offset `15` → effective festival day
`2026-08-13`.

Outside the window, challenges that target the Cô Hồn profile are **rejected**
by mint-api with a clear error (UI may still show the altar).

## Ops checklist (launch)

1. Genesis new WLOTUS / dWLOTUS as needed; deploy mint-api + dana-index.
2. Create the **Cô Hồn** profile (first on-chain root burn).
3. Set `HUNGRY_GHOST_PROFILE_ID` + `HUNGRY_GHOST_DEAD_DATE` on the VM  
   (`/etc/wlotus/mint.env`) and matching `VITE_*` on GitHub for the SPA build.
4. Restart mint-api; confirm `/api/status` → `hungryGhost.active` flips true
   during the window.
5. For dryrun before launch, set `HUNGRY_GHOST_TEST_OFFSET_DAYS` (e.g. `7` or
   `15`), test Cúng burns 102, then set offset back to `0` for production.

`GET /api/status` includes:

```json
"hungryGhost": {
  "enabled": true,
  "active": true,
  "profileId": "…",
  "effectiveDeadDate": "2026-08-28",
  "burnAtoms": "102",
  "serverNow": "…",
  "windowStartUtc": "…",
  "windowEndUtc": "…"
}
```
