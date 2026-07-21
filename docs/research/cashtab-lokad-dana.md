# Cashtab / eCash: LOKAD ID **DANA** and “Unknown App”

**Status:** 2026-07-21  
**Related:** remint tip + burn memorial LOKAD **`DANA`** (`44414e41`), ALP **`SLP2`**

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
| [OP_RETURN prefix guideline](https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/doc/standards/op_return-prefix-guideline.md) | Community claim table |

There is **no** on-chain “application name” field and **no** registration API.

---

## What wLotus txs carry

| Tx | EMPP pushes | Cashtab today |
|----|-------------|---------------|
| **Remint (mint)** | **`DANA` tip v4** + `SLP2` (ALP MINT) | ALP token chrome; **`DANA` → Unknown App** until registered |
| **Burn (offering)** | `SLP2` (ALP BURN) + **`DANA` memorial v1/v2** | ALP burn + **`DANA` → Unknown App** until registered |

Tip-state layout (15 bytes, covenant-bound):

```
DANA | ver=4 | bits u16 LE | extraBits u32 LE | locktime u32 LE
```

Burn memorial layout:

```
DANA | ver=1|2 | offeringIdLen | offeringId | noteLen | note [| parentLen | parentTxid]
```

Hex LOKAD: **`44414e41`** (`DANA`). One prefix covers mint tip ads and burns.

---

## How to fix “Unknown App” (required Cashtab PR)

Submit a diff to **Bitcoin-ABC** (Cashtab + preferably `ecash-parse`):

### 1. Claim prefix (guideline table)

| Prefix (hex) | Display name | Spec URL |
|--------------|--------------|----------|
| `44414e41` | wLotus / Dana | https://wlotus.org + this repo |

Include author + an `ecash:` contact address.

### 2. Allowlist in code

```ts
appPrefixesHex: {
  // …
  dana: '44414e41', // DANA — wLotus tip remint + burn memorial
},
```

### 3. Parse + UI label

Recognize `dana` → display **“wLotus”** or **“Dana”** (optional: tip vs memorial by `ver`).

Until that ships and Cashtab is released, explorers/wallets will keep saying **Unknown App**.

---

## What we do in this repo

1. **Remint covenants** write **DANA tip v4** (Temple / Memo / MooreTip) — new dry-run genesis required after this change.  
2. **Burns** write **DANA memorial** v1/v2.  
3. Cashtab naming is **out of band** — track a Bitcoin-ABC PR; link it here when opened.

---

## Quick checklist for maintainers

- [ ] Remint OP_RETURN first push starts with `44 41 4e 41` + `04` (DANA tip v4)
- [ ] Burn OP_RETURN memorial push starts with `44 41 4e 41` (`DANA`)
- [ ] Recreate dry-run token: `TIER=wlotus … npm run create-dryrun-token`
- [ ] Open Bitcoin-ABC diff adding `dana` to `appPrefixesHex`
- [ ] After Cashtab release: confirm history shows **wLotus** / **Dana** instead of Unknown App
