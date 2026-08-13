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

### Profiles — `TEMPLE_SPECIALS_JSON_FILE` (preferred) / `TEMPLE_SPECIALS_JSON`

On the VM, copy `deployments/temple-specials-created.json` to
`/etc/wlotus/temple-specials.json` and set:

```bash
TEMPLE_SPECIALS_JSON_FILE=/etc/wlotus/temple-specials.json
```

The file may be a JSON array or the wrapper object `{ "TEMPLE_SPECIALS_JSON": [ … ] }`.
Inline `TEMPLE_SPECIALS_JSON='[...]'` in `mint.env` still works but is easy to
break with quotes (dotenv fails → mint-api never binds → nginx 502 HTML).

```bash
TEMPLE_SPECIALS_JSON='[
  {
    "profileId": "<64-hex root burn>",
    "kind": "event",
    "eventDate": "2026-07-15",
    "eventCalendar": "lunar",
    "name": "Vu Lan",
    "countries": ["VN"]
  },
  {
    "profileId": "<64-hex root burn>",
    "kind": "ghost",
    "eventDate": "2026-07-15",
    "eventCalendar": "lunar",
    "name": "Cô Hồn",
    "countries": ["VN"]
  }
]'
```

- `eventCalendar` is optional; **defaults to `"lunar"`**.
- **`countries`**: ISO 3166-1 alpha-2 list for the home events list. Omit, `[]`,
  `"*"`, or `"GLOBAL"` → **Global** (every viewer). Most specials are local.
- No `deskKeep` or `testOffsetDays` inside the JSON — those are global only.

### Country targeting

| JSON | Who sees it on Home → Events |
|------|------------------------------|
| omit / `[]` / `"*"` / `"GLOBAL"` | **Global** — every locale and IP |
| `"countries": ["VN"]` | Vietnam (and `vi` locale diaspora) |
| `"countries": ["CN","TW","HK","MO","SG"]` | Chinese-speaking regions (`zh` locale) |
| `"countries": ["US","GB",…]` | English-speaking (`en` locale) |

A special is shown if it is Global, the viewer’s **IP country** matches, or the
**app locale** implies a listed country (`vi` → VN, `zh` → CN/TW/HK/MO/SG,
`en` → US/GB/CA/AU/NZ/IE/ZA/PH/SG). Burns and share links are **not** gated.

Live `/etc/wlotus/temple-specials.json` without `countries` stays **Global**.
Patch existing Vu Lan / Cô Hồn without a new burn:

```bash
CREATE_TEMPLE_SPECIALS_MERGE_ONLY=1 npm run create-temple-specials
sudo cp deployments/temple-specials-created.json /etc/wlotus/temple-specials.json
sudo systemctl restart wlotus-mint-api
```

Then burn only the missing catalog rows (the script skips names that already
have a 64-hex `profileId`).

### Regional catalog (2026)

Memorial / ancestral offering days that fit W Lotus. Each row is its own root.

| Region | Name | Kind | Window | Countries |
|--------|------|------|--------|-----------|
| VN | Vu Lan | event | lunar 15/7 (27 Aug 2026) | `VN` |
| VN | Cô Hồn | ghost | lunar 2/7–15/7 (14–27 Aug) | `VN` |
| VN | Tết Thanh Minh | event | solar 5 Apr 2026 | `VN` |
| ZH | 盂兰盆 | event | lunar 15/7 (27 Aug 2026) | CN, TW, HK, MO, SG |
| ZH | 中元节 | ghost | lunar 1/7–15/7 (13–27 Aug) | CN, TW, HK, MO, SG |
| ZH | 清明节 | event | solar 5 Apr 2026 | CN, TW, HK, MO, SG |
| EN | All Souls' Day | event | solar 2 Nov 2026 | US, GB, CA, AU, NZ, IE, ZA, PH, SG |
| EN | Remembrance Day | hero | solar 11 Nov 2026 | same English-speaking list |

Qingming / Thanh Minh is the same solar term (PRC public holiday 4–6 Apr 2026);
the two roots keep distinct names and stories. Zhongyuan peak is the same lunar
15/7 as Vu Lan / Ullambana; Ghost Month in Chinese sources runs 13 Aug–10 Sep
2026 — we close the special window at rằm (same product rule as Cô Hồn).
Remembrance Day is Veterans Day in the US.

Code: `src/params/templeSpecialCatalog.ts`.

### Global env / GitHub variables

| mint-api / Contabo | GitHub Actions (SPA) | Meaning |
|--------------------|----------------------|---------|
| `TEMPLE_SPECIALS_JSON_FILE` | — | Path to array or `temple-specials-created.json` (preferred) |
| `TEMPLE_SPECIALS_JSON` | `VITE_TEMPLE_SPECIALS_JSON` | Inline profile list (easy to break `mint.env`) |
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
    "effectiveEventDate", "active", "windowStartUtc", "windowEndUtc",
    "countries", "storyTitle", "storyTitleEn", "storyTitleZh", …
  } ],
  "active": [ /* subset currently in window */ ]
}
```

---

## Ops checklist

1. Create the profiles on-chain (root burns) — see script below.
2. Set `TEMPLE_SPECIALS_JSON` on the VM and matching `VITE_TEMPLE_SPECIALS_JSON` for the SPA build.
   - Vu Lan → `kind: "event"` + `countries: ["VN"]`
   - Cô Hồn → `kind: "ghost"` + `countries: ["VN"]`
   - Regional catalog → `npm run create-temple-specials` (skips existing names)
   - Omit `countries` (or `[]`) for Global specials.
3. Set `TEMPLE_SPECIAL_DESK_KEEP` (e.g. `0` for full burn, or leave default `6`).
4. Restart mint-api; confirm `/api/status` → `templeSpecials.profiles`.
5. **Test env:** set `TEMPLE_SPECIAL_TEST_OFFSET_DAYS`, verify burns, then set back to `0` for prod.
6. **Launch (2026):** go-live target **17:00 VN on 26 Aug 2026** (00:00 lunar 15 in UTC+14).

## Creating public specials on-chain

Specials are **not** JSON-only. Search (dana-index) and re-offers need a real
root dedication burn. Flow:

1. **Mint inventory if needed, then burn missing catalog roots**:

   ```bash
   set -a && source /etc/wlotus/mint.env && set +a
   CREATE_TEMPLE_SPECIALS_DRY_RUN=1 npm run create-temple-specials
   npm run create-temple-specials
   ```

   After a fresh genesis the premine sits on temple P2SH, so the desk has **0**
   atoms. The live run **auto-remints once** (~102 miner atoms onto the tip),
   writes the new baton tip (`lastRemintTxid` / `powAddress` / `tipLocktime`)
   into every matching `deployments/*wlotus*.json`, restarts mint-api, waits
   until Chronik shows the miner UTXO, then burns two roots. Disable auto-remint
   with `CREATE_TEMPLE_SPECIALS_NO_MINT=1`.

   Auto-remint does **not** query the JSON `powAddress`. It follows the mint
   baton on Chronik (`spentBy` from `lastRemintTxid` / handoff) so an open-miner
   remint that moved the tip is still found.

   Writes `deployments/temple-specials-created.json` with the
   `TEMPLE_SPECIALS_JSON` snippet.

2. **Register** that file on mint-api (`TEMPLE_SPECIALS_JSON_FILE=/etc/wlotus/temple-specials.json`).
   Do not paste the array into `mint.env`. Restart mint-api. Confirm
   `http://127.0.0.1:8787/health` before curling `https://wlotus.org/api/status`
   (nginx 502 HTML makes jq say `Invalid numeric literal`).

3. Confirm `/api/status` → `templeSpecials.profiles` lists both.

Default lunar event day is `2026-07-15` (Rằm). Override with `EVENT_LUNAR_YMD` /
`EVENT_YEAR` if needed.

The first roots are always from the **temple/desk** (auto-remint + burn) — there
is no external offerer yet. That is expected and correct.

## Temple stories (soft pray)

During the ~2 minute soft-pray window after remint, the offer session can show a
**temple story** for the active special. Stories are served from the backend
(`/api/status` → `templeSpecials.profiles[].story*`) so the pagoda can update
copy without a full app redeploy later.

Built-in defaults (until community-authored stories):

| Profile | Title | Theme |
|---------|-------|--------|
| Vu Lan | Vu Lan Báo Hiếu | Mục Kiền Liên cứu mẹ → báo hiếu |
| Cô Hồn | Xá Tội Vong Nhân | Tháng cô hồn, bố thí |
| Tết Thanh Minh | Tết Thanh Minh | Tảo mộ, tiết Thanh Minh |
| 盂兰盆 | 盂兰盆 — 报恩 | 目连救母 |
| 中元节 | 中元 — 普度 | 鬼月、孤魂 |
| 清明节 | 清明 — 扫墓 | Tomb sweeping |
| All Souls' Day | All Souls' Day | Prayers for the dead (2 Nov) |
| Remembrance Day | Remembrance Day | 11 Nov / Veterans Day |

Override per profile with JSON `story: { title, body, titleEn, bodyEn, titleZh, bodyZh }` or a plain string body.

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

Prod cutover (new `WLOTUS` token + these steps in order):
[PROD_CUTOVER_102_6.md](../deploy/contabo/PROD_CUTOVER_102_6.md) §8.

1. Deploy mint-api with wired `offer.ts` (templeSpecials on status + burnAtoms).
2. `npm run create-temple-specials` (or `CREATE_TEMPLE_SPECIALS_MERGE_ONLY=1` to tag existing Vu Lan / Cô Hồn `countries: ["VN"]` without a new burn). Auto-remint if the desk has no inventory, then burn missing catalog roots.
3. Set `TEMPLE_SPECIALS_JSON` from the script output (includes Cô Hồn `eventStart`).
4. Set `TEMPLE_SPECIAL_DESK_KEEP` (e.g. `0` or `6`). Prod: `TEMPLE_SPECIAL_TEST_OFFSET_DAYS=0`.
5. Restart mint-api. SPA reads `/api/status` (no Vite bake required).
6. Confirm `/api/status` → stories + multi-day active flags near Rằm.

## Code

| Piece | Role |
|-------|------|
| `src/params/templeSpecials.ts` | Config, window, burn resolution, lunar/solar, countries |
| `src/params/templeSpecialCatalog.ts` | VN / ZH / EN event catalog + stories |
| `src/params/specialCountries.ts` | ISO targeting + locale/IP visibility |
| `src/lib/lunarCalendar.ts` | Hồ Ngọc Đức lunar ↔ solar (shared) |
| `src/offering/burnPrayer.ts` | `burnOnePrayer({ burnAtoms })` |
| `scripts/create-temple-specials.ts` | Root burns for the regional catalog |
| mint-api `offer.ts` | Resolve burn at `/api/burn` time; status field |
| web specials helpers | Cúng vs Dâng Hoa / Vu Lan Báo Hiếu by kind |
