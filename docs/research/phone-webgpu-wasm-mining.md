# Phone WebGPU / multi-core PoW mining (experimental)

**Status:** long-term / experimental (2026-07-21)  
**Not required for prod launch.** Default clients keep single Web Worker + `ecash-lib` SHA256d.

---

## Goal

Calibrate ritual search time against the **fastest realistic phone-class miner in the official PWA**, not against a slow single-thread JS loop.

Target hardware: **phone GPU (WebGPU)** and **phone multi-core CPU** — not desktop GPUs/ASICs. Farming deterrence remains **1/107 temple split + XEC fees**.

---

## Covenant constraint

Remint PoW is **SHA256d** verified in Script (`sha256(preimage)` commit + nonce). Any backend must produce the same nonce the server / covenant accept. Changing the hash algorithm needs a **new genesis**.

---

## Enable (test / dogfood)

Build-time:

```bash
VITE_EXPERIMENTAL_POW=1 npm run web
```

Runtime (no rebuild):

```js
localStorage.setItem('wlotus.experimentalPow', '1')
// disable: localStorage.setItem('wlotus.experimentalPow', '0')
```

Backend order when enabled:

1. **WebGPU** SHA256d compute (if `navigator.gpu` works; CPU-verifies the nonce)
2. **Multi-worker** CPU (partitioned nonce stride, up to 4 workers)
3. **Single worker** / main-thread fallback

Console (after starting an offer / search) — uses `console.info`:

```text
[wlotus] experimental pow backend: webgpu
```

- `webgpu` — phone GPU path  
- `multi-worker` — WebGPU skipped/failed; multi-core CPU  
- `worker` — single-worker fallback  

**CI:** repo variable `VITE_EXPERIMENTAL_POW=1` is baked only when Deploy web (test) passes it into `web:build`. Until that deploy runs, enable immediately with:

```js
localStorage.setItem('wlotus.experimentalPow', '1'); location.reload();
```

Then confirm:

```js
import.meta.env?.VITE_EXPERIMENTAL_POW  // may be undefined until rebuild
localStorage.getItem('wlotus.experimentalPow')  // '1'
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
