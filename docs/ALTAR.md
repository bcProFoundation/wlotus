# Altar on-chain schema (WLotus)

**Decision (2026-07-24):** memorial / altar data for **WLotus** is **on-chain only**. Indexes and UI caches may mirror the chain; they are not a source of truth. **Off-chain storage is reserved for LotusHeart** (family-oriented product), not WLotus.

Canonical links: [VISION.md](./VISION.md) · DANA wire today: `src/offering/wlbrMemorial.ts`.

---

## Topology — star fragments

Every follow-up burn (re-offer, fragment, amendment) points at the **original dedication** burn txid — the **star** / root — not at the previous tip.

```
         ┌─ fragment / re-offer A  (parent = ★)
★ root ──┼─ fragment / re-offer B  (parent = ★)
         └─ amendment C            (parent = ★)
```

DANA **v2** already encodes this: `parentBurnTxid` = original burn (64 hex). Explorers and `dana-index` group by that root.

Do **not** tip-chain (`parent → previous fragment`). Tip-chains break “latest under original” UX and make history harder to index.

---

## Write policy — limited amendments

| Rule | Value |
|------|--------|
| Who may amend altar fields | **Minter of the original dedication only** (software / desk limit — not a covenant) |
| Max amendments per altar | **10** |
| What anyone may still do | Offer a **new star fragment** (re-offer burn) linked to the same root |

Amendments are rare corrections (name, place, short note) — not an unbounded journal. Re-offers remain open for the community as separate burns under the same star.

---

## On-chain encoding — separator fields (not JSON / tags)

Altar payload fields live **on-chain** inside the memorial note (or a future DANA memorial version). Prefer a **single special separator** and a fixed field order by importance — **not** JSON, CBOR maps, or tag/key blobs.

**Separator:** ASCII Unit Separator `U+001F` (`\x1f`). Chosen because it is rare in human text, one byte, and unambiguous. If a field must include the separator, drop or replace that byte at encode time (software).

**Field order (most important first):**

| # | Field | Now | Later |
|---|--------|-----|--------|
| 1 | Title / honorific (`mr` \| `mrs` \| empty) | optional | yes |
| 2 | Display name / dedication name | yes | yes |
| 3 | Short remembrance note | yes | yes |
| 4 | Birth place (coarse text) | optional | same, then geohash |
| 5 | Birth year (`YYYY`) | optional | optional |
| 6 | Date of death (`YYYY` or `YYYY-MM-DD`) | **required** when altar used | yes |
| 7 | Place of death | optional | same, then geohash |
| 8 | Funeral / resting place | optional | same, then geohash |

Wire sketch (UTF-8):

```
title \x1f name \x1f note \x1f birthPlace \x1f birthYear \x1f deathDate \x1f deathPlace \x1f funeralPlace
```

`title` is a **locale-neutral code** (`mr` / `mrs`); UI renders Mr./Mrs., Ông/Bà, 先生/女士. The title slot is always written (may be empty) so readers can tell new wire from legacy name-first packs.

Trailing empty fields may be omitted. Readers split on `\x1f` and take positions by index.

**Note size:** EMPP `noteLen` is one byte (max **255** UTF-8 bytes). Desk + UI soft-cap ≈ **220** bytes (`MEMORIAL_NOTE_MAX_BYTES` in `altarFields.ts`).

**Plain notes (no separator):** still valid — treat the whole string as the display dedication (legacy / quick offer).

**Geotagging:** do **not** call paid AI for geocoding. Free path when we add geo: [OpenStreetMap Nominatim](https://nominatim.org/) (usage policy / rate limits) → store a compact **geohash** in the same place slots. Until then, coarse human place text only.

**UI:** Offer panel **Thêm / More** opens altar setup; packing happens on burn via `encodeAltarNote`.

**Explicit non-goals for WLotus altar wire:**

- JSON / XML / tagged key-value inside EMPP
- Off-chain pointers (IPFS, HTTP URLs as required content)
- Encrypting memorial fields on WLotus (public memorial)
- Requiring map APIs or AI to complete an offering

---

## Place — coarse now, geo later

| Phase | Place representation |
|-------|----------------------|
| Now | Coarse human place (city / region / country text) |
| Later | Compact **geohash** (or equivalent) via Nominatim — same field slots |

Do not require precise coordinates at launch. Convert coarse → geo when the feature ships; keep place slots stable.

---

## Product split — WLotus vs LotusHeart

| | **WLotus** | **LotusHeart** (later) |
|--|------------|-------------------------|
| Audience | Public memorial + dana | Family-oriented |
| Memorial / altar data | **All on-chain** | May use **off-chain** private/family stores |
| Index (`dana-index`) | Read-only mirror of chain | N/A (separate product) |
| localStorage / device cache | UX only; may lag or miss other devices | TBD |

`apps/dana-index` is an **on-chain mirror** (Chronik → durable cache → API). It does not introduce WLotus off-chain content. Clients may merge index + local cache for speed; chain wins on conflict once indexed.

---

## Enforcement checklist (software)

When implementing amendments / richer fields:

1. Encode/decode with `\x1f` field order above (or bump DANA memorial version if layout must change).
2. Enforce **minter-only** amend + **≤ 10** amends in mint-api / offer path.
3. Keep star topology: every non-root burn sets `parentBurnTxid` = original.
4. Never require an off-chain blob for WLotus display of name / note / place.
5. Keep LotusHeart off-chain designs out of the WLotus burn path.

---

## Related code

| Piece | Role |
|-------|------|
| `src/offering/wlbrMemorial.ts` | DANA v1/v2 memorial EMPP |
| `src/offering/altarFields.ts` | Separator pack / parse / display name |
| `apps/dana-index` | Public recent / memorial history from chain |
| `apps/web` Offer **Thêm** + Recent / Lịch sử | Altar setup; merge index + local under star |
