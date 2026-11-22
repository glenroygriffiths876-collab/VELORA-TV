# Velora TV

Premium streaming-platform prototype with Live TV, Movies, Series, Search, responsive mobile/desktop layouts, and a catalogue-hub foundation.

## Live demo and Beginning Concepts subdomain

The intended public address is **https://velora.beginningconcepts.org/**. The `CNAME` file in the repository root declares this GitHub Pages domain, and the site's canonical/social metadata points to it. The original GitHub Pages project address is retained through GitHub Pages' normal custom-domain redirect behavior once the domain is active; no separate deployment is needed.

**Cloudflare DNS action required:** Within the existing `beginningconcepts.org` zone, add a `CNAME` record with **Name** `velora` and **Target** `glenroygriffiths876-collab.github.io`. Use **DNS only** initially while GitHub Pages checks DNS and provisions its HTTPS certificate. Do not alter the root domain, WAPS or any other subdomain. Confirm **Settings → Pages → Custom domain** shows `velora.beginningconcepts.org`, then enable HTTPS when GitHub makes it available. Until both the DNS record and certificate are ready, the address should not be described as verified live.

The Velora PWA manifest, service worker, frontend assets and installation links deliberately use relative paths and were not rewritten.

Demo login:
- Email: `demo@velora.app`
- Password: `demo1234`

## Important architecture note

GitHub Pages hosts the static customer interface only. Authorized IPTV/API provider credentials, M3U/XMLTV sync, billing, subscriber entitlements, device limits, and protected playback tokens should run on a separate secure backend.

Only connect content that you own or are authorized to distribute.