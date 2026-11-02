# Logo AFYLLX

The owner supplied the AFYLLX blue mark on 2 November 2026 and requested replacing the cutlery brand mark. `public/brand/afyllx-logo.png` is the transparent PNG used in navigation, the dashboard, settings, printed cards and PNG card exports.

The built-in image editing tool removed the white background. Prompt: remove only the white background and negative spaces, preserve the logo silhouette, proportions and blue gradients, and add no text, shadow or background tile. The selected result was inspected and resized for web use. The original attachment and unused alternatives remain outside the repository.

Run `python scripts/build-pwa-icons.py` with Pillow installed to derive the 192/512 px app icons, 180 px Apple touch icon and 32 px browser icon. App icons have a white background and keep the full mark within the central maskable safe circle. The website logo itself retains transparency.

This change affects branding only. It does not replace QR tokens, issue cards again or change attendance data. Reload/reprint an existing card to obtain the updated artwork with its existing QR.
