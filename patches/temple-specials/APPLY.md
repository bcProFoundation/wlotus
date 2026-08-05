# Apply remaining temple-specials source changes

The following source files still need the multi-day / stories / Cúng UI wiring applied on this branch:

| File | Patch |
|------|-------|
| `src/params/templeSpecials.ts` | `templeSpecials.ts.patch` |
| `apps/mint-api/src/offer.ts` | `offer.ts.patch` (or existing `apps/mint-api/patches/offer-temple-specials.patch`) |
| `apps/web/src/App.tsx` | `App.tsx.patch` |
| `apps/web/src/i18n/messages.ts` | `messages.ts.patch` |
| `apps/web/src/styles.css` | `styles.css.patch` |

## One-shot (from repo root, on `feat-temple-specials`)

```bash
# Preferred: combined remaining sources patch from project artifacts
patch -p1 < path/to/artifacts/temple-specials-remaining.patch

# Or per-file from this directory:
for f in patches/temple-specials/{templeSpecials,offer,App,messages,styles}*.patch; do
  [ -f "$f" ] && patch -p1 < "$f"
done

git add -A
git commit -m "feat(temple-specials): multi-day windows, stories, offer wire, web Cúng/Vu Lan UI"
git push
```

Full sources also live in project artifacts `temple-specials-src/`.

## Already applied on this branch

- `scripts/create-temple-specials.ts` — Cô Hồn `eventStart`/`eventEnd` in registry
- `docs/TEMPLE_SPECIALS.md` — stories + multi-day + post-genesis
- `apps/web/src/lib/specialsUi.ts` — Cúng / Vu Lan helpers
- `apps/web/src/lib/offerApi.ts` — status typing
- `tests/templeSpecials.test.ts` — multi-day + story coverage
