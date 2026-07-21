# Cashtab / eCash: LOKAD IDs and “Unknown App”

**Status:** 2026-07-21  
**Related:** burn memorial LOKAD **`DANA`**, remint tip ad **`WLPT`**, ALP **`SLP2`**

---

## Why Cashtab shows “Unknown App”

Cashtab (and `ecash-parse` / ecash-herald) do **not** invent app names from ASCII.
They match the first 4 bytes of each EMPP push against a **hardcoded allowlist**.

If the LOKAD is missing from that map → UI label **Unknown App**.

Sources (Bitcoin-ABC monorepo):

| File | Role |
|------|------|
| `cashtab/src/config/opreturn.ts` → `appPrefixesHex` | Cashtab known prefixes |
| `modules/ecash-parse/src/constants/opreturn.ts` | Shared parser prefixes |
| `apps/ecash-herald/constants/lokad.ts` | Herald / notification names (if present) |
| [OP_RETURN prefix guideline](https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/doc/standards/op_return-prefix-guideline.md) | Community claim table |

There is **no** on-chain “application name” field and **no** registration API.

---

## What wLotus txs carry today

| Tx | EMPP pushes | Cashtab today |
|----|-------------|---------------|
| **Remint (mint)** | `WLPT` + `SLP2` (ALP MINT) | ALP may show as token activity; **`WLPT` → Unknown App** |
| **Burn (offering)** | `SLP2` (ALP BURN) + **`DANA`** memorial | ALP burn + **`DANA` → Unknown App** until registered |

Burn memorial layout (new burns):

```
DANA | ver | offeringIdLen | offeringId | noteLen | note [| parentLen | parentTxid]
```

Hex LOKAD: **`44414e41`** (`DANA`).  
Legacy burns used **`WLBR`** (`574c4252`) — parsers still accept both.

Remint tip state LOKAD: **`WLPT`** (`574c5054`).

---

## How to fix “Unknown App” (required Cashtab PR)

Submit a diff to **Bitcoin-ABC** (Cashtab + preferably `ecash-parse`):

### 1. Claim prefixes (guideline table)

In `doc/standards/op_return-prefix-guideline.md`, add rows e.g.:

| Prefix (hex) | Display name | Spec URL |
|--------------|--------------|----------|
| `44414e41` | wLotus Dana (burn memorial) | https://wlotus.org + this repo `docs/research/…` |
| `574c5054` | wLotus remint (WLPT tip state) | same |

Include author + an `ecash:` contact address.

### 2. Allowlist in code

`cashtab/src/config/opreturn.ts` and `modules/ecash-parse/src/constants/opreturn.ts`:

```ts
appPrefixesHex: {
  // …
  dana: '44414e41', // DANA — wLotus burn memorial
  wlpt: '574c5054', // WLPT — wLotus Moore tip remint ad
},
```

### 3. Parse + UI label

In EMPP app-action parsing (Cashtab `getEmppAppActions` / `ecash-parse`):

- Recognize `dana` → display **“wLotus”** or **“Dana”** (memorial note if present)
- Recognize `wlpt` → display **“wLotus”** (mint / remint), or hide if you prefer only ALP token chrome

Until that ships and Cashtab is released, explorers/wallets will keep saying **Unknown App** even though the LOKAD is valid on-chain.

---

## What we do in this repo

1. **Burns write `DANA`** (this PR) — product LOKAD for dana / memorial burns.  
2. **Parsers accept `DANA` + legacy `WLBR`.**  
3. **Mints keep `WLPT`** (covenant-bound tip state) — do not replace with DANA without a covenant/genesis change.  
4. Cashtab naming is **out of band** — track a Bitcoin-ABC PR; link it here when opened.

---

## Quick checklist for maintainers

- [ ] Burn OP_RETURN second push starts with `44 41 4e 41` (`DANA`)
- [ ] Open Bitcoin-ABC diff adding `dana` + `wlpt` to `appPrefixesHex`
- [ ] Add guideline table rows + display names
- [ ] After Cashtab release: confirm history shows **wLotus** / **Dana** instead of Unknown App
