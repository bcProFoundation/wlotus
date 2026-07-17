# ALP / eMPP for fine-grained PoW difficulty

**Insight (ALP author):** difficulty/app state is not an ALP-baton field — **eMPP supports it**, the same way Agora attaches an ad push beside ALP.

Canonical code:
[`ecash-agora` `agora.ts` L461](https://github.com/Bitcoin-ABC/bitcoin-abc/blob/651cfbe1f1c5f38a56f5a232f92b08000562fd44/modules/ecash-agora/src/agora.ts#L461)

Example tx:
[`e662e77b…2138`](https://explorer.e.cash/tx/e662e77b91818d44b791650943e84a13fc96aaad3682a3c695b54e4395ca2138)

---

## How Agora does it (production pattern)

For ALP offers, the OP_RETURN is **two eMPP pushes**:

```ts
script: emppScript([
  agoraPartial.adPushdata(),  // AGR0 + PARTIAL + offer terms
  alpSend(tokenId, tokenType, sendAtomsArray),
])
```

Decoded OP_RETURN from the example:

| Push | Hex prefix | Meaning |
|------|------------|---------|
| 1 (extra) | `41475230…` = **`AGR0`** + `PARTIAL` + params | Agora ad / covenant terms |
| 2 (ALP) | `534c5032…` = **`SLP2`** + `SEND` + amounts | Token coloring |

Author’s split of that tx:

- Extra payload:  
  `0x41475230075041525449414c00003458297fad01000094d82ae91800000058e6c3a38cb800006d082751037f1729ee682b22da2b5dd8a11779ec7b80739c4b5d4b48f83c35d83fbb40a212`
- ALP SEND:  
  `0x534c5032000453454e4478e5a3f6aff372164bcba58a3e7abe9fd2111a998a45c1a695bd484be910df4a02000000000000404b4c000000`

`adPushdata()` (ALP) serializes roughly:

```
AGR0 | len | "PARTIAL" | trunc bytes | scale | price | minAccept | lockTime | makerPk
```

Chronik / wallets discover offers from the **`AGR0`** push; ALP coloring only looks at **`SLP2`**.

`ecash-lib` already supports the same idea at the payment layer via `DataAction` (`type: 'DATA'`) for ALP EMPP pushes, and `emppScript([...])` for manual builds.

---

## What this means for mWLPOW / WLOTUS

### Confirmed

1. **ALP batons still have no commitment field** — state is not “on the baton NFT.”
2. **eMPP is the supported attachment channel** — put a custom LOKAD push **next to** `alpMint` / `alpSend`, exactly like Agora.
3. Remint OP_RETURN can be:

```ts
emppScript([
  wldfPushdata(),           // e.g. WLDF | ver | zeroBits | dayIndex | target
  alpMint(tokenId, type, { atomsArray: [100n], numBatons: 1 }),
])
```

### Continuity (still required)

Agora does **not** rely on EMPP alone for the next offer:

- Partial fill creates a **new P2SH** with `updatedPartial` (stateful redeem).
- The EMPP ad is rebuilt to **match** those terms (`adPushdata()` from the new partial).
- Covenant consts embed EMPP/ALP intros so Script can bind outputs to the ad.

Same split for Moore-on-work:

| Layer | Role |
|-------|------|
| **eMPP `WLDF` (or similar)** | Indexable, Agora-style announcement of current D / target / day |
| **Stateful redeem (± baton sats)** | Consensus: next tip must carry updated bits/target |
| **ALP `MINT`** | Always mint **100**; baton returned |

Without updating redeem (or sats), an EMPP difficulty blob is only a **label** for this tx — the next remint could claim an easier D.

---

## Recommended WLDF sketch (parallel to AGR0)

```
LOKAD "WLDF" (4 bytes)
u8  version
u16 zeroBits          // or omit if using compact target only
u32 dayIndex          // Moore day since genesis
u64 compactTarget     // optional fine grain (daily δ on target)
```

Remint covenant checklist:

1. PoW vs `zeroBits` / `compactTarget` from **current** redeem.
2. `hashOutputs` OP_RETURN = `emppScript([wldf(current), alpMint(100, 1 baton)])` byte-exact.
3. Baton out → `P2SH(hash160(redeem'))` with Moore-updated params (and matching next `wldf` if advertised on the following spend).

Moore step options (either is Ergon-closer than +1 **byte**):

- **+1 bit / ~845 days** (×2 ≈ compounded daily δ), or
- **Daily** `target' = floor(target · 99918 / 100000)` in a multi-limb target.

---

## Live mWLPOW today

| Item | Status |
|------|--------|
| EMPP | Single push: ALP `MINT` only |
| Difficulty | Fixed **1** leading zero **byte** in redeem |
| Moore on-chain | **Not** implemented |
| Path forward | Agora-style dual EMPP + stateful redeem migration (new genesis/handoff) |

---

## Cheat surfaces (unchanged)

- EMPP announces hard D, next remint uses easy redeem D → must bind EMPP to redeem.
- Soft off-chain schedule while covenant stays at genesis D.
- Independent DAA per baton tip → prefer shared genesis clock for Moore day index.

---

## Refs

- [agora.ts L458–468](https://github.com/Bitcoin-ABC/bitcoin-abc/blob/651cfbe1f1c5f38a56f5a232f92b08000562fd44/modules/ecash-agora/src/agora.ts#L458) — `emppScript([adPushdata(), alpSend(...)])`
- [AgoraPartial.adPushdata()](https://github.com/Bitcoin-ABC/bitcoin-abc/blob/651cfbe1f1c5f38a56f5a232f92b08000562fd44/modules/ecash-agora/src/partial.ts#L642)
- [ecash-lib `emppScript`](https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/modules/ecash-lib/src/token/empp.ts)
- [ecash-lib `DataAction`](https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/modules/ecash-lib/src/payment/action.ts) — wallet EMPP data pushes for ALP
- Example: https://explorer.e.cash/tx/e662e77b91818d44b791650943e84a13fc96aaad3682a3c695b54e4395ca2138
