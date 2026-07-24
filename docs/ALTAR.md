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
| 1 | Display name / dedication name | yes | yes |
| 2 | Short remembrance note | yes (free text today) | yes |
| 3 | Place (coarse) | optional free text | same, then geohash |
| 4 | Language / locale hint | optional | optional |
| 5… | Reserved / empty | — | keep slots stable |

Wire sketch (UTF-8):

```
name \x1f note \x1f place \x1f lang
```

Trailing empty fields may be omitted. Readers split on `\x1f` and take positions by index.

**Today (shipped):** DANA v1/v2 note is still a single UTF-8 string (UI caps ~80 chars). Separator packing is the **agreed direction** for richer altar fields; implement when place/amendment UX lands. Until then, treat the whole note as field 1+2 combined.

**Explicit non-goals for WLotus altar wire:**

- JSON / XML / tagged key-value inside EMPP
- Off-chain pointers (IPFS, HTTP URLs as required content)
- Encrypting memorial fields on WLotus (public memorial)

---

## Place — coarse now, geo later

| Phase | Place representation |
|-------|----------------------|
| Now | Coarse human place (city / region / country text) |
| Later | Compact **geohash** (or equivalent) once geo tagging is implemented |

Do not require precise coordinates at launch. Convert coarse → geo when the feature ships; keep field slot #3 stable.

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
| `apps/dana-index` | Public recent / memorial history from chain |
| `apps/web` Recent + Lịch sử | Merge index + local; show original + latest under star |
