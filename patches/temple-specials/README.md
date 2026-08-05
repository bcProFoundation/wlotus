# Remaining temple-specials patches

Apply on `feat-temple-specials` (after latest origin):

```bash
# Preferred: one combined patch from project artifacts
patch -p1 < temple-specials-remaining.patch

# Or per-file patches in this directory:
for f in patches/temple-specials/*.patch; do
  patch -p1 < "$f" || true
done
```

Full sources also in project artifacts `temple-specials-src/`.

## Files covered

| Path | What |
|------|------|
| `src/params/templeSpecials.ts` | multi-day `eventStart`/`eventEnd`, `defaultTempleStory` |
| `apps/mint-api/src/offer.ts` | `resolveOfferBurnAtoms` + `templeSpecials` status |
| `apps/web/src/App.tsx` | Cúng button, session title, story panel |
| `apps/web/src/i18n/messages.ts` | btnCung, Vu Lan title, story strings |
| `apps/web/src/styles.css` | `.temple-story` |
| `scripts/create-temple-specials.ts` | Vu Lan=`event`, Cô Hồn range in registry |
| `docs/TEMPLE_SPECIALS.md` | stories + multi-day + post-genesis |
