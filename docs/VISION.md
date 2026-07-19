# Vision — WLotus as burnable white lotus

**One-line thesis:**  
WLotus is the burnable white lotus — offered **in memory of the dead**, and as **dana** to the living: real wealth sacrificed for the community, not paper sold.

Live test UI: https://test.wlotus.org

---

## Dual meaning of one burn

Burning WLotus is a single act with two gifts:

| Layer | Cultural frame | What the burn does |
|-------|----------------|--------------------|
| **White lotus (hoa sen trắng)** | In Vietnamese culture, white lotus is the flower given in memorial — purity, farewell, cầu siêu for the dead | Dedication **in memory of someone** |
| **Dana / bố thí (đàn na)** | Generosity without keeping — wealth released for others | Tokens are **destroyed**; circulating supply shrinks; **no seller receives the offering** |

```
Burn WLotus
   ├── Memorial  →  for the dead   (sen trắng)
   └── Dana      →  for everybody  (wealth given up, not transferred)
```

The product is neither “only a funeral app” nor “only a charity app.” It is both at once.

---

## Vs vàng mã (joss paper)

Traditional **vàng mã** shares the memorial intent: offerings for the departed. Commercially, most of the cash goes to **makers and sellers** of paper goods.

| | Vàng mã | Burn WLotus |
|--|---------|-------------|
| Intent | Memorial / ritual gift | Memorial + dana |
| What leaves the giver | Money → shop | Tokens → **destroyed on-chain** |
| Who captures value | Paper industry | **Nobody** — supply is gone |
| Rebirth of supply | N/A | PoW remint (permissionless work) |

**Brand claim:** same *spirit* as memorial offering culture; harder *economics* than paper ritual commerce. Burning WLotus is **sacrificing own wealth for the sake of the community**.

---

## Brand architecture

| Layer | Name | Role |
|-------|------|------|
| Product / domain / tech | **WLotus** | The vessel — burnable white lotus token |
| The act | **Burn / Offer** | One gesture, two gifts |
| Memorial | Dedication / memory | Why VN already understands sen trắng |
| Dana | Generosity language (later: feature/category) | Why the burn is for *everyone* |
| Tiers | Prayer / Candle / Flower (Incense) | Scale of sacrifice |

### Messaging

**Hero (secular, true):**  
*Offer a white lotus. Remember someone. Give something up for all.*

**Deeper:**  
*Unlike vàng mã, nothing is sold back into the market — the burn is the gift.*

### Branding choices (do / don’t)

**Do**

- Claim the Vietnamese white-lotus memorial reading on purpose (do not hide it)
- Widen it with dana: memorial *and* community sacrifice
- Keep **WLotus** as the public product name (`wlotus.org`)
- Use dana / bố thí / đàn na as **meaning language** (and later as a feature/category), not a forced primary rename

**Don’t**

- Soften into generic wellness / spa “temple vibe” that erases death and dana
- Market only as “token burn for scarcity” (misses the cultural heart)
- Rename the primary brand to bare **Dana** early (VN niche word + SEA collision with Indonesia’s DANA e-wallet + existing Dana Wallet donation apps)
- Lean on HBO-style “White Lotus” lifestyle branding in the West without the ritual frame

---

## Cycle (issuance ↔ offering)

```
PoW remint (effort) → WLotus exists in the world
        ↓
Devotee burns (memorial + dana) → wealth destroyed, merit public
        ↓
Flower can bloom again via permissionless remint
```

- **Cumulative burned** = spiritual / public ledger  
- **Circulating supply** = secondary to the offering story  
- **PoW** = rebirth through work, not discretionary mint authority  

Technical rails: [PROPOSAL.md](./PROPOSAL.md) · [ECONOMICS.md](./ECONOMICS.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Product surface

| Surface | Role today |
|---------|------------|
| `apps/web` | Offer / burn UI (Prayer dryrun; XEC fees) |
| Memorial metadata | EMPP / app-side dedication beside ALP `BURN` |
| Postage (later) | Sponsor fees so offering is not gated on holding XEC |

The website is the white lotus act for Vietnamese culture: give (burn) WLotus in memorial of the dead — and by burning one’s own wealth, give dana to everybody.
