# Temple specials — ghosts, heroes & events

Desk/temple-managed profiles with optional **event windows** that raise the
memorial burn above the normal 1-atom flower.

**Temple does not pre-burn.** The catalog lives in code. Home Events and Search
show unbound specials at 0 offerings. The first visitor’s flower becomes the
on-chain root (`POST /api/specials/claim`; first writer wins). Later visitors
re-offer to that parent. Special burn amounts apply only after a special is
bound, and only during its window.

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
| 15/2/2026 | **2 Apr 2026** (Phật nhập Niết-bàn) |
| 3/3/2026 | **19 Apr 2026** (giỗ Mẫu Liễu Hạnh) |
| 23/3/2026 | **9 May 2026** (Thiên Hậu / 妈祖) |
| 22–27/4/2026 | **7–12 Jun 2026** (vía Bà Chúa Xứ; peak 25/4 → 10 Jun) |
| 4–6/5/2026 | **18–20 Jun 2026** (vía Bà Đen) |
| 8/4/2026 | **24 May 2026** (Bắc tông Phật Đản / 佛诞; start of VN week) |
| 15/4/2026 | **31 May 2026** (GHPGVN chính lễ / Vesakha full moon / Vesak) |
| 2/7/2026 | **14 Aug 2026** |
| 15/7/2026 (Rằm) | **27 Aug 2026** |
| 8/12/2026 | **15 Jan 2027** (Phật thành đạo / 佛成道) |

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
| **`solar`** | `eventDate` is already Gregorian YYYY-MM-DD | Ngày sinh Hồ Chí Minh: `2026-05-19` |

Optional flags:

| Flag | Meaning |
|------|---------|
| `eventRecurrence: "monthly-lunar"` | Repeat the lunar **day-of-month** (01 or 15) every lunar month — mùng 1 / rằm, 初一 / 十五 |
| `lunarMonthEnd: true` | Use the last day of that lunar month (29 or 30) — Giao thừa / 除夕 |

Altar `deathDate` is already **solar**. Prefer documenting solar equivalents for
ops clarity; keep lunar conversion when the cultural date is naturally âm lịch.

**Buddhist holy days** still use that East Asian lunisolar calendar (`eventCalendar: "lunar"`), not a separate “Buddha calendar” engine. **Phật lịch / Buddhist Era** is year numbering (CE + 543), not a different month/day. Mahayana VN/ZH keep 8/4, 15/2, 8/12 on âm lịch; Theravada Vesak is the Vesakha full moon, which we store as lunar 15/4 (matches SG/MY/TH/UN 2024–2028). GHPGVN Phật Đản week is lunar 8/4–15/4 with chính lễ on the 15th.

---

## Config

### Built-in catalog (no JSON required)

`loadTempleSpecialsFromEnv` always starts from `templeSpecialCatalog(year)`
(`EVENT_YEAR`, or the current civil year). Rows have empty `profileId` until claimed.

Optional overlays, in order:

1. `TEMPLE_SPECIALS_JSON_FILE` / `TEMPLE_SPECIALS_JSON` — merge by `id` (keep
   live Vu Lan / Cô Hồn `profileId`s; add `countries`).
2. `deployments/temple-special-claims.json` (`TEMPLE_SPECIAL_CLAIMS_FILE`) —
   `{ [specialId]: txid }` written by the first visitor’s claim.

The claims file is runtime state (gitignored). First writer wins; the same
txid is idempotent.

On the VM, live overlay (only needed for already-burned Vu Lan / Cô Hồn):

```bash
TEMPLE_SPECIALS_JSON_FILE=/etc/wlotus/temple-specials.json
```

The file may be a JSON array or `{ "TEMPLE_SPECIALS_JSON": [ … ] }`. Inline
`TEMPLE_SPECIALS_JSON='[...]'` in `mint.env` is easy to break with quotes.

```bash
TEMPLE_SPECIALS_JSON='[
  {
    "id": "vu-lan",
    "profileId": "<existing 64-hex root>",
    "kind": "event",
    "eventDate": "2026-07-15",
    "eventCalendar": "lunar",
    "name": "Vu Lan",
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
| `"countries": ["VN"]` | Vietnam (`vi`) |
| `"countries": ["CN","TW","HK","MO","SG"]` | Chinese-speaking (`zh`) |
| `"countries": ["US","GB",…]` | English-speaking (`en`) |

Home Events shows **Global** plus specials for the **selected language**.
`vi` → VN, `zh` → CN/TW/HK/MO, `en` → US/GB/CA/AU/NZ/IE/ZA/PH.
Singapore is on both Chinese and English catalog lists (bilingual) but is
**not** implied by locale — otherwise English UI shows 中元节 / 盂兰盆 via SG.
IP does **not** keep the old country’s calendar after a language change
(VN + English no longer shows Vu Lan). If IP sits *inside* that language
region, the list narrows to that country (US English sees Memorial Day, not
ANZAC). Burns and share links are **not** gated.

Live Vu Lan / Cô Hồn JSON without `countries` stays **Global**. Patch countries
without a new burn:

```bash
npm run create-temple-specials
sudo cp deployments/temple-specials-created.json /etc/wlotus/temple-specials.json
sudo systemctl restart wlotus-mint-api
```

### Regional catalog (2026)

Memorial / ancestral offering days. Unbound until a visitor claims the root.

| Region | Name | Kind | Window | Countries |
|--------|------|------|--------|-----------|
| VN | Tết Nguyên Đán | event | lunar 1/1–1/3 (17–19 Feb 2026) | `VN` |
| VN | Ông Công Ông Táo | event | lunar 23/12 | `VN` |
| VN | Giao thừa | event | last day of tháng Chạp | `VN` |
| VN | Tiễn ông bà | event | lunar 3/1 (hóa vàng) | `VN` |
| VN | Tết Nguyên Tiêu | event | lunar 15/1 | `VN` |
| VN | Mùng 1 | event | lunar 1 every month | `VN` |
| VN | Ngày rằm | event | lunar 15 every month | `VN` |
| VN | Tết Đoan Ngọ | event | lunar 5/5 | `VN` |
| VN | Tết Trung Thu | event | lunar 15/8 | `VN` |
| VN | Vu Lan | event | lunar 15/7 (27 Aug 2026) | `VN` |
| VN | Cô Hồn | ghost | lunar 2/7–15/7 (14–27 Aug) | `VN` |
| VN | Tết Thanh Minh | event | solar 5 Apr 2026 | `VN` |
| VN | Giỗ Tổ Hùng Vương | hero | lunar 10/3 | `VN` |
| VN | Thương binh liệt sĩ | hero | solar 27 Jul | `VN` |
| VN | Trần Hưng Đạo | hero | lunar 20/8 | `VN` |
| VN | Hồ Chí Minh | hero | lunar 21/7 (2 Sep 2026) | `VN` |
| VN | Ngày sinh Hồ Chí Minh | hero | solar 19 May | `VN` |
| VN | Hai Bà Trưng | hero | lunar 6/2 | `VN` |
| VN | Võ Thị Sáu | hero | solar 23 Jan | `VN` |
| VN | Thánh Mẫu Liễu Hạnh | hero | lunar 3/3 | `VN` |
| VN | Bà Chúa Xứ | hero | lunar 22–27/4 (peak 25/4) | `VN` |
| VN | Bà Đen | hero | lunar 4–6/5 | `VN` |
| VN | Thiên Hậu | hero | lunar 23/3 | `VN` |
| ZH | 春节 | event | lunar 1/1–1/3 | CN, TW, HK, MO, SG |
| ZH | 祭灶 | event | lunar 23–24/12 | CN, TW, HK, MO, SG |
| ZH | 除夕 | event | last day of 腊月 | CN, TW, HK, MO, SG |
| ZH | 元宵节 | event | lunar 15/1 | CN, TW, HK, MO, SG |
| ZH | 初一 | event | lunar 1 every month | CN, TW, HK, MO, SG |
| ZH | 十五 | event | lunar 15 every month | CN, TW, HK, MO, SG |
| ZH | 中秋节 | event | lunar 15/8 | CN, TW, HK, MO, SG |
| ZH | 盂兰盆 | event | lunar 15/7 (27 Aug 2026) | CN, TW, HK, MO, SG |
| ZH | 中元节 | ghost | lunar 1/7–15/7 (13–27 Aug) | CN, TW, HK, MO, SG |
| ZH | 清明节 | event | solar 5 Apr 2026 | CN, TW, HK, MO, SG |
| ZH | 寒衣节 | event | lunar 10/1 | CN, TW, HK, MO, SG |
| ZH | 重阳节 | event | lunar 9/9 | CN, TW, HK, MO, SG |
| ZH | 冬至 | event | solar 22 Dec 2026 | CN, TW, HK, MO, SG |
| ZH | 孔子 | hero | solar 28 Sep | CN, TW, HK, MO, SG |
| ZH | 关羽 | hero | lunar 24/6 | CN, TW, HK, MO, SG |
| ZH | 妈祖 | hero | lunar 23/3 | CN, TW, HK, MO, SG |
| EN | All Hallows' Eve | ghost | solar 31 Oct | English-speaking list |
| EN | All Saints' Day | event | solar 1 Nov | English-speaking list |
| EN | All Souls' Day | event | solar 2 Nov 2026 | English-speaking list |
| EN | Remembrance Day | hero | solar 11 Nov 2026 | English-speaking list |
| EN | Memorial Day | hero | last Monday in May (25 May 2026) | `US` |
| EN | ANZAC Day | hero | solar 25 Apr | `AU`, `NZ` |

Qingming / Thanh Minh is the same solar term; the two rows keep distinct names
and stories. Zhongyuan peak is the same lunar 15/7 as Vu Lan; we close Ghost
Month at rằm. Remembrance Day is Veterans Day in the US. `en` locale maps to
the English-speaking country list, so US Memorial Day / ANZAC can appear in
English UI outside those countries.

**Tết cycle and sóc vọng.** W Lotus is meant to replace vàng mã, incense smoke,
and cut flowers. Catalog rows cover Ông Táo (tiễn 23/12), Giao thừa (last day
of Chạp), Tết (1/1–1/3), tiễn ông bà / hóa vàng (3/1), Rằm tháng Giêng, plus
**mùng 1 and rằm every lunar month** (`eventRecurrence: monthly-lunar`).
Chinese-speaking regions get the parallel 祭灶 / 除夕 / 春节 / 元宵 / 初一 /
十五 / 中秋. Giao thừa and 除夕 use `lunarMonthEnd` because tháng Chạp is 29
or 30 days.

Code: `src/params/templeSpecialCatalog.ts`.

### Global env / GitHub variables

| mint-api / Contabo | GitHub Actions (SPA) | Meaning |
|--------------------|----------------------|---------|
| `TEMPLE_SPECIALS_JSON_FILE` | — | Optional overlay (live Vu Lan / Cô Hồn txids) |
| `TEMPLE_SPECIALS_JSON` | `VITE_TEMPLE_SPECIALS_JSON` | Inline overlay (easy to break `mint.env`) |
| `TEMPLE_SPECIAL_CLAIMS_FILE` | — | First-burn map (default `deployments/temple-special-claims.json`) |
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
    "id", "profileId", "kind", "eventDate", "eventCalendar",
    "effectiveEventDate", "active", "windowStartUtc", "windowEndUtc",
    "countries", "storyTitle", "storyTitleEn", "storyTitleZh", …
  } ],
  "active": [ /* subset currently in window */ ]
}
```

`profileId` is `""` until the first visitor claims the root.

`POST /api/specials/claim` `{ installId, specialId, profileId }` — claimant
must be the recorded root offerer; 409 if already claimed by another txid.

---

## Ops checklist

1. Deploy mint-api. Catalog is built-in — **do not** desk-burn the full list.
2. Optional JSON overlay for already-live Vu Lan / Cô Hồn `profileId`s + `countries`.
   `npm run create-temple-specials` writes overlay JSON and does **not** burn.
   Set `TEMPLE_SPECIALS_JSON_FILE` if needed.
3. Set `TEMPLE_SPECIAL_DESK_KEEP` (e.g. `0` for full burn, or leave default `6`).
   Prod: `TEMPLE_SPECIAL_TEST_OFFSET_DAYS=0`.
4. Restart mint-api. SPA reads `/api/status` (no Vite bake). Confirm many
   profiles, most with empty `profileId`, plus stories.
5. **Test env:** set `TEMPLE_SPECIAL_TEST_OFFSET_DAYS`, verify first-burn +
   re-offer, then set back to `0`.
6. **Launch (2026):** **17:00 VN on 26 Aug 2026** (00:00 lunar 15 in UTC+14).

The 102/6 recut is **done** — [PROD_CUTOVER_102_6.md](../deploy/contabo/PROD_CUTOVER_102_6.md) is historical.

## Optional temple burns

Temple **should not** pre-burn. Search still finds catalog names; the first
offering is the root. Use desk burns only if ops explicitly wants temple-owned
roots:

```bash
CREATE_TEMPLE_SPECIALS_BURN=1 npm run create-temple-specials
```

That path can auto-remint if the desk has no inventory. Disable with
`CREATE_TEMPLE_SPECIALS_NO_MINT=1`.

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
| Halloween / All Hallows' Eve | All Hallows' Eve | Veil night, wandering souls |
| Giỗ Tổ Hùng Vương | Giỗ Tổ Hùng Vương | Ancestral kings |
| 寒衣节 | 寒衣节 | Cold clothes for the dead |
| 冬至 | 冬至 | Winter-solstice ancestors |

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

## Code

| Piece | Role |
|-------|------|
| `src/params/templeSpecials.ts` | Config, window, burn resolution, lunar/solar, countries |
| `src/params/templeSpecialCatalog.ts` | VN / ZH / EN catalog + stories (unbound until claimed) |
| `src/params/templeSpecialClaims.ts` | First-burn `id → txid` file (first writer wins) |
| `src/params/specialCountries.ts` | ISO targeting + locale/IP visibility |
| `src/lib/lunarCalendar.ts` | Hồ Ngọc Đức lunar ↔ solar (shared) |
| `src/offering/burnPrayer.ts` | `burnOnePrayer({ burnAtoms })` |
| `scripts/create-temple-specials.ts` | Optional JSON overlay; burns only if `CREATE_TEMPLE_SPECIALS_BURN=1` |
| mint-api `offer.ts` | Resolve burn at `/api/burn` time; status field |
| mint-api `POST /api/specials/claim` | Bind catalog id to first visitor root |
| web specials helpers | Cúng vs Dâng Hoa / first-burn setup by kind |
