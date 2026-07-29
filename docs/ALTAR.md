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

## Relationships — open for now, restrict later

`relationshipType` / `relatedTxid` (fields 9–10) can be set **at altar setup**
(on the root note, when they fit) or **added afterward** as a **relationship
star-fragment**: DANA v2 `parentBurnTxid` = original dedication, and the
memorial note carries **only** the relationship slots (optional short message
in the note field may be truncated/dropped to fit OP_RETURN). It does **not**
re-pack name / places / dates — those live on the root and do not change.

**Multiple links (add-only):** each relationship fragment adds one link.
Child and spouse may repeat; **parent (Cha/mẹ) is capped at 2**. Duplicates
(same type + related txid) are rejected in the UI. Deletion is not supported
yet (a future “mark deleted” burn may land later). The client merges all
fragments under a star into `AltarFields.relationships` for Ban thờ details.

Re-offers are the same shape without relationship: parent = root + optional
extra memorial message only.

`dana-index` needs no changes: `GET /api/memorial/:txid` already returns every
burn under a star (`burns`). The client **merges** packed notes (latest-first,
first non-empty per field) so a relationship fragment supplies the link while
identity/places come from the root.

The UI only lets a user link to an altar already in **this device's Recent
list** (`AltarSetupModal` `relatedAltarOptions`, sourced from `recentGroups`
in `App.tsx`) — no free-text txid entry. This is a UX constraint on the
client only; the wire format itself (`relatedTxid`) is just a 64-hex txid and
does not enforce or depend on it, so it does not change anything about the
open-write discussion below.

**Current state: intentionally open.** Any device can set or overwrite the
relationship on **any** altar via this path — the same trust level the app
already gives re-offers under a star. This matches the plan above
(minter-only amend, ≤ 10) **in policy** but that restriction is **not
enforced in code yet**. Track before shipping broadly:

1. Enforce **minter-only amend** + **≤ 10 amends per altar** in mint-api
   (`apps/mint-api/src/offer.ts`), not just the web client.
2. Decide what "minter" means operationally (see below).

**Can `installId` be the first defense mechanism?**

`installId` is a `crypto.randomUUID()` written to `localStorage`
(`wlotus.installId`) — a plain client-supplied string mint-api never
cryptographically verifies. Two different properties matter here and are
easy to conflate:

- **As a secret gate against strangers** — reasonable as a first step. If
  mint-api recorded `creatorInstallId` per root txid (it does not yet; only
  `apps/dana-index` is queried today and it never sees `installId` — see
  "Related code" below) and rejected amendments from a different `installId`,
  a random third party has no way to *guess* the creator's id (it is never
  published on-chain or by `dana-index`). Cheap to add, no accounts needed.
- **As a durable "same person / device" credential — no.** Clearing site
  data, reinstalling the PWA, restoring/factory-resetting the phone, or
  simply using a different browser on the same device all generate a **new**
  random `installId` with no link to the old one. A legitimate creator who
  does any of that permanently loses the ability to amend their own altar,
  with no recovery path. So `installId` is *fine* as a soft, best-effort
  speed bump, but must never be the only or final answer.

**Better long-term mechanism.** WLotus already has a matching pattern:
`burnToken`, a bearer capability returned by `/api/submit` and required to
complete `/api/burn` / `/api/cancel` (`apps/mint-api/src/offer.ts`). A
per-altar **edit capability** could follow the same shape — mint-api issues a
secret token to the creating device at altar-creation time; any future
amendment for that root must present it. This does not solve durability
(the token is still device-local and lost on reset, just like `installId`),
but it is a deliberately-scoped secret instead of a repurposed device id, and
requires no accounts or wallet keys per offerer (the offerer only performs
PoW today; mint-api's server wallet signs and broadcasts every burn — see
`apps/mint-api/README.md`). True cross-device/cross-reset recovery would need
real identity (an account, or a wallet key the offerer controls and signs
with), which is a bigger product decision, not a quick fix.

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
| 9 | Relationship type (wire `s`/`p`/`c`; long forms still parse) | optional | yes |
| 10 | Related altar txid (64-hex original burn, or empty) | optional | yes |

Wire sketch (UTF-8):

```
title \x1f name \x1f note \x1f birthPlace \x1f birthYear \x1f deathDate \x1f deathPlace \x1f funeralPlace \x1f relationshipType \x1f relatedTxid
```

Fields 9–10 (`relationshipType` / `relatedTxid`, see `src/offering/altarFields.ts`)
link this altar to another WLotus altar by its original dedication burn
txid. Each type is the **related** person's role toward this memorial:
`parent` = Cha/mẹ, `child` = Con, `spouse` = Vợ/Chồng (UI labels wife vs
husband from this altar's honorific). On the wire, relationship type is packed
as a one-letter code (`s` / `p` / `c`); readers still accept the long forms
`spouse` / `parent` / `child`. Notes packed before this pair existed simply
omit the slots — readers default missing/invalid values to empty, so old
altars parse unchanged.

`title` is a **locale-neutral code** (`mr` / `mrs`); UI renders Mr./Mrs., Ông/Bà, 先生/女士. The title slot is always written (may be empty) so readers can tell new wire from legacy name-first packs.

Trailing empty fields may be omitted. Readers split on `\x1f` and take positions by index.

**Note size:** EMPP `noteLen` is one byte (max **255** UTF-8 bytes), but the
binding limit is eCash’s **OP_RETURN script ≤ 223 bytes** for the full burn
(`ALP BURN` + DANA memorial EMPP). Measured soft caps in `altarFields.ts`:

| Burn kind | DANA | Note soft-cap |
|-----------|------|---------------|
| Root dedication | v1 | `MEMORIAL_NOTE_MAX_BYTES` (**150**) |
| Amend / re-offer (parent txid) | v2 | `MEMORIAL_NOTE_MAX_BYTES_WITH_PARENT` (**120**) |

`encodeAltarNote` packs the **root** dedication. Fit order prefers keeping
places on the root (drop funeral → remembrance note → relationship → places).
Prefer `encodeRelationshipNote` as a separate star fragment when the root is
already large.

Star fragments under a root:

| Kind | Note contents |
|------|----------------|
| Re-offer | Optional free-text memorial message only |
| Relationship | Relationship slots only (`encodeRelationshipNote`); optional message truncated/dropped first |

Clients merge altar-packed burns under a star (latest-first, first non-empty
per field) so a relationship fragment can omit identity fields and still show
name/places from the original root.

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
| `src/offering/altarFields.ts` | Separator pack / parse / display name / relationship fields |
| `apps/dana-index` | Public recent / memorial history from chain |
| `apps/web` Offer **Thêm** + Recent / Lịch sử | Altar setup; merge index + local under star |
| `apps/web/src/components/AltarSetupModal.tsx` | Setup (full altar) or `variant="relationship"` (link only) |
| `apps/web/src/App.tsx` `onOffer({ amend: true })` | Star-fragment burn that re-packs the full altar (open for now) |
