# Phone WebGPU / multi-core PoW mining

**Status:** launch path when `VITE_EXPERIMENTAL_POW=1` (2026-07-21)  
Offer mining: **WebGPU → multi-worker → single**, plus soft pray floor
(`VITE_MIN_PRAY_S`, e.g. `60` seconds) so ritual wall time stays ~1 min after early finds.

---

## Goal

Calibrate ritual search time against the **fastest realistic phone-class miner in the official PWA**, not against a slow single-thread JS loop.

Target hardware: **phone GPU (WebGPU)** and **phone multi-core CPU** — not desktop GPUs/ASICs.

**Farming / security (do not confuse with this research):**

- Anti-farm = **1/107 + XEC fees** (temple-sponsored Offer wins vs commercial miners even if energy ≈ 0).
- Ritual length on the official client = **soft timer** (`VITE_MIN_PRAY_S`) after remint, before memorial burn — attention, not joules.
- Token hashrate ≠ ledger security (eCash secures transfers). See [ECONOMICS_WLOTUS_GLOTUS.md](../ECONOMICS_WLOTUS_GLOTUS.md) § *Product intent*.

---

## Covenant constraint

Remint PoW is **SHA256d** verified in Script (`sha256(preimage)` commit + nonce). Any backend must produce the same nonce the server / covenant accept. Changing the hash algorithm needs a **new genesis**.

---

## Enable (Offer path)

Build-time:

```bash
VITE_EXPERIMENTAL_POW=1 npm run web
# multi-core CPU only (skip WebGPU):
VITE_EXPERIMENTAL_POW=1 VITE_POW_BACKEND=multi-worker npm run web
```

Runtime (no rebuild):

```js
localStorage.setItem('wlotus.experimentalPow', '1')
// Multi-worker CPU only — recommended for consistent phone UX:
localStorage.setItem('wlotus.powBackend', 'multi-worker')
location.reload()
// disable experimental: localStorage.setItem('wlotus.experimentalPow', '0')
// auto (WebGPU first): localStorage.setItem('wlotus.powBackend', 'auto')
```

Backend order when experimental is on:

| `powBackend` | Behavior |
|--------------|----------|
| `auto` (default) | WebGPU → multi-worker → single worker |
| `multi-worker` / `cpu` | **Multi-core CPU only** (skip WebGPU) |
| `webgpu` | WebGPU, then fall back |
| `worker` | Single worker only |

Console after starting an offer:

```text
[wlotus] experimental pow backend: multi-worker
```


---

## Files

| Path | Role |
|------|------|
| `apps/web/src/lib/pow/experimentalFlags.ts` | Opt-in flag |
| `apps/web/src/lib/pow/webgpuMine.ts` | WebGPU SHA256d (v1: single-block messages) |
| `apps/web/src/lib/pow/multiWorkerMine.ts` | Parallel workers |
| `apps/web/src/lib/pow/experimentalMine.ts` | Orchestration |
| `apps/web/src/lib/mineRunner.ts` | Wires experimental vs default |

---

## Roadmap

- [ ] Measure WebGPU vs multi-worker hashrate on mid-range Android + iOS (Safari WebGPU)
- [ ] Retune dryrun/prod `baseZeroBits` for phone-GPU-class rates once stable
- [ ] Optional: true **WASM** SHA256 module (`hash-wasm` / custom) as mid-tier between JS and WebGPU
- [ ] Thermal / battery caps (duty cycle) so ritual UX stays gentle
- [ ] Keep desktop/ASIC out of scope for UX bits — economics handle farming

---

## Risks

| Risk | Mitigation |
|------|------------|
| WebGPU shader bugs | Always CPU-verify nonce before submit |
| iOS WebGPU gaps | Auto-fallback to multi-worker |
| Faster phones shorten ritual | Raise whole-byte bits after measuring best-backend median |
| Battery heat | Cap workers; yield; never block UI thread |
