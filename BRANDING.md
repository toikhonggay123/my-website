# EdTech MealCheck

Owner direction, 03/11/2026: every logo lockup uses the EdTech symbol on the left, **EdTech** in bold on the first line and MealCheck in regular weight on the second line. Do not add AFYLLX to this lockup, including menus, loading states, home, scanner, install pages and student cards.

- Use `Brand` from `app/brand.tsx` for HTML lockups. Size through its `className`; preserve the shared mark and two-line order.
- Symbol: `public/brand/edtech-mark.png`, derived from the supplied `logo EDTECH.png` without its printed words. The transparent extraction used the built-in image tool with the instruction to retain the symbol, book, orbit, three squares, geometry and blue gradients while removing all lettering and the white background. The final web derivative is 512 × 341 px.
- Canvas card exports use the same mark plus `BRAND_TOP` and `BRAND_BOTTOM` from `lib/branding.mjs`.
- Active browser/PWA icons use the `edtech-` prefix so cached old icon URLs do not hide the new artwork. Keep the existing manifest ID, scope and start URL.
- Support email remains `contact.afyllx@gmail.com`. AFYLLX remains the parent company; internal identifiers, existing QR cryptography, keys and records are independent of visual branding.

Run `python scripts/build-pwa-icons.py` with Pillow installed to derive the five launcher/browser icons. Their white background and central safe area preserve maskable-icon compatibility; the website mark retains transparency. Existing installed apps may keep their old launcher artwork until their operating system refreshes it.

This is an artwork change. Reprinting/downloading an already-issued student card keeps its existing QR. Preserve QR prefix/AAD, runtime keys, all records, the manifest ID/scope/start URL and the compatibility identifier returned by `/api/health`.
