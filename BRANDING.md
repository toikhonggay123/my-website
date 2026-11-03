# AFYLLX Edu MealCheck

Owner direction, 04/11/2026: the education brand is **AFYLLX Edu**. Every logo lockup uses the existing symbol on the left, **AFYLLX Edu** in bold on the first line and MealCheck in regular weight on the second line. Apply this name to menus, loading states, home, scanner, install pages, PWA metadata, Android source, reports and student cards.

- Use `Brand` from `app/brand.tsx` for HTML lockups. Size through its `className`; preserve the shared mark and two-line order.
- Symbol: `public/brand/edtech-mark.png`, derived from the owner-supplied artwork without its printed words. The transparent extraction retains the book, orbit, three squares, geometry and blue gradients. The final web derivative is 512 × 341 px. This rename does not change the symbol.
- Canvas card exports use the same mark plus `BRAND_TOP` and `BRAND_BOTTOM` from `lib/branding.mjs`. Measure both text lines when aligning the lockup so the longer brand name stays within the card.
- Keep existing artwork URLs (`edtech-mark.png` and the `edtech-` icon prefix) stable for cached/installed-app compatibility. They are asset identifiers, not display names. Keep the existing manifest ID and scope; the owner-approved start URL is now `/mealcheck?source=pwa`. The full PWA name is AFYLLX Edu MealCheck; the compact launcher name is AFYLLX Edu.
- Support email remains `contact.afyllx@gmail.com`. AFYLLX remains the parent company; internal identifiers, existing QR cryptography, keys and records are independent of visual branding.

Run `python scripts/build-pwa-icons.py` with Pillow installed to derive the five launcher/browser icons. Their white background and central safe area preserve maskable-icon compatibility; the website mark retains transparency. Existing installed apps may keep their old launcher label until their operating system refreshes it.

This is a display-name change. Reprinting/downloading an already-issued student card keeps its existing QR. Preserve QR prefix/AAD, runtime keys, all records, the manifest ID/scope and the compatibility identifier returned by `/api/health`.
