# Temple specials — ghosts, heroes & events

Desk/temple-managed profiles with optional **event windows** that raise the
memorial burn above the normal 1-atom flower.

## Behaviour

| Mode | When | Burn | Desk keeps (of 102) | UI |
|------|------|------|---------------------|----|
| Flower | Always (default / off-window) | **1** | 101 | Dâng Hoa |
| Special | Active window + parent = registered profile | **102 − deskKeep** | **deskKeep** (global) | depends on `kind` |

- Temple still receives **6** from the covenant on every remint.
- **Outside the window the profile stays fully offerable** — only the burn
  amount changes. Challenges are never rejected for being “off day”.

### Kinds (UI)

| kind | Example | Popup title | Button |
|------|---------|-------------|--------|
| `ghost` | Cô Hồn | (name) | **Cúng** |
| `event` | Vu Lan | **Vu Lan Báo Hiếu** | **Dâng Hoa** |
| `hero` | Hồ Chí Minh | (name) | Dâng Hoa / commemorative |

Vu Lan is an **event** (báo hiếu), not a ghost. Keep normal Offering / Flower
copy; only the burn amount rises in-window.

### Global `deskKeep` (not per-profile)

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

---

## Event windows (product rules)

| Profile | Window | Notes |
|---------|--------|--------|
| **Cô Hồn** | Lunar **2/7 00:00 → 15/7 12:00** (local) | Multi-day “tháng cô hồn”; ends noon rằm (gate-close custom) |
| **Vu Lan** | **One full civil day** of lunar 15/7 | Báo hiếu focus on Rằm |

- **Client** may use **local timezone** for free-window UX (year-1: no strong
  anti-cheat need on a free special).
- **Server** owns burn authority. Client clock cannot unlock a higher burn early.
- Leap months are **not** supported in JSON yet (`eventLeap`). Use the non-leap
  month, or set `eventCalendar: "solar"` with the known solar date.

### 2026 solar anchors (VN calendar, Hồ Ngọc Đức UTC+7)

| Lunar | Solar |
|-------|--------|
| 2/7/2026 | **14 Aug 2026** |
| 15/7/2026 (Rằm) | **27 Aug 2026** |

### Launch timing (2026)

Token genesis + specials go live at:

- **00:00 lunar 15/7 (27 Aug 2026) in the earliest timezone (UTC+14 / Pacific/Kiritimati)**
- Equivalent to **17:00 Vietnam time on 26 Aug 2026** (evening of lunar 14)

This covers a useful portion of traditional cúng cô hồn on the 14th evening in
Vietnam while landing the public launch story on Rằm Tháng 7.

### Code vs product window

| Layer | Behaviour today | Intended next |
|-------|-----------------|---------------|
| Server burn gate | Single global civil day around `effectiveEventDate` (UTC−12 … UTC+14, ~50 h) | Optional range (`eventStart` / `eventEnd` or multi-day) so Cô Hồn can span 2/7→15/7 noon without overloading Vu Lan’s single rằm day |
| Client free UX | Status `active` from server | Local TZ bounds for Cô Hồn (00:00 2/7 → 12:00 15/7 local) |

---

## Event calendar (lunar vs solar)

Each profile’s `eventDate` is interpreted according to **`eventCalendar`**:

| `eventCalendar` | Meaning | Example |
|-----------------|---------|---------|
| **`lunar`** (default) | `eventDate` is âm lịch YYYY-MM-DD; converted to solar via Hồ Ngọc Đức (VN UTC+7) before the civil-day window | Cô Hồn / Vu Lan: lunar `2026-07-15` |
| **`solar`** | `eventDate` is already Gregorian YYYY-MM-DD | Hồ Chí Minh: `2026-09-02` |

Altar `deathDate` is already **solar**. Prefer documenting solar equivalents for
ops clarity; keep lunar conversion when the cultural date is naturally âm lịch.

---

## Config

### Profiles — `TEMPLE_SPECIALS_JSON`

```bash
TEMPLE_SPECIALS_JSON='[
  {
    "profileId": "<64-hex root burn>",
    "kind": "event",
    "eventDate": "2026-07-15",
    "eventCalendar": "lunar",
    "name": "Vu Lan"
  },
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
- For Cô Hồn multi-day, until range fields land, ops may use the rằm solar day
  as the single-day anchor (full multi-day is a follow-up).

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

---

## Ops checklist

1. Create the profiles on-chain (root burns) — see script below.
2. Set `TEMPLE_SPECIALS_JSON` on the VM and matching `VITE_TEMPLE_SPECIALS_JSON` for the SPA build.
   - Vu Lan → `kind: "event"`
   - Cô Hồn → `kind: "ghost"`
   - Heroes → `kind: "hero"` + `eventCalendar: "solar"` when the ceremony is fixed Gregorian.
3. Set `TEMPLE_SPECIAL_DESK_KEEP` (e.g. `0` for full burn, or leave default `6`).
4. Restart mint-api; confirm `/api/status` → `templeSpecials.profiles`.
5. **Test env:** set `TEMPLE_SPECIAL_TEST_OFFSET_DAYS`, verify burns, then set back to `0` for prod.
6. **Launch (2026):** go-live target **17:00 VN on 26 Aug 2026** (00:00 lunar 15 in UTC+14).

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

3. Confirm `/api/status` → `templeSpecials.profiles` lists both.

Default lunar event day is `2026-07-15` (Rằm). Override with `EVENT_LUNAR_YMD` /
`EVENT_YEAR` if needed.

The first burn is always from the **temple/desk** — there is no external
offerer yet. That is expected and correct.

## Temple stories (soft pray)

During the ~2 minute soft-pray window after remint, the offer session can show a
**temple story** for the active special. Stories are served from the backend
(`/api/status` → `templeSpecials.profiles[].story*`) so the pagoda can update
copy without a full app redeploy later.

Built-in defaults (until community-authored stories):

| Profile | Title (vi) | Theme |
|---------|------------|--------|
| Vu Lan (`event`) | Vu Lan Báo Hiếu | Mục Kiền Liên cứu mẹ → báo hiếu, hoa sen |
| Cô Hồn (`ghost`) | Xá Tội Vong Nhân | Tháng cô hồn, bố thí, từ bi |

Override per profile with JSON `story: { title, body, titleEn, bodyEn }` or a plain string body.

## Multi-day windows

```json
{
  "profileId": "…",
  "kind": "ghost",
  "name": "Cô Hồn",
  "eventCalendar": "lunar",
  "eventStart": "2026-07-02",
  "eventDate": "2026-07-15",
  "eventEnd": "2026-07-15"
}
```

Server activates from the global civil start of `eventStart` through the global
civil end of `eventEnd` (after lunar→solar + testOffset). Vu Lan omits start/end
(single day).

## Post-genesis checklist

1. Deploy mint-api with wired `offer.ts` (templeSpecials on status + burnAtoms).
2. `npm run create-temple-specials` (or dry-run first) → root burns for Vu Lan + Cô Hồn.
3. Set `TEMPLE_SPECIALS_JSON` from the script output (includes Cô Hồn `eventStart`).
4. Set `TEMPLE_SPECIAL_DESK_KEEP` (e.g. `0` or `6`).
5. Rebuild SPA with matching `VITE_TEMPLE_SPECIALS_JSON` if baked; otherwise status-driven.
6. Confirm `/api/status` → stories + multi-day active flags near Rằm.

## Code

| Piece | Role |
|-------|------|
| `src/params/templeSpecials.ts` | Config, window, burn resolution, lunar/solar |
| `src/lib/lunarCalendar.ts` | Hồ Ngọc Đức lunar ↔ solar (shared) |
| `src/offering/burnPrayer.ts` | `burnOnePrayer({ burnAtoms })` |
| `scripts/create-temple-specials.ts` | Root burns for Vu Lan + Cô Hồn |
| mint-api `offer.ts` | Resolve burn at `/api/burn` time; status field |
| web specials helpers | Cúng vs Dâng Hoa / Vu Lan Báo Hiếu by kind |
