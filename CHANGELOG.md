# Changelog

All notable changes to this project are documented here.

## [1.0.7] - 2026-08-06

- Fix extraction failing on older posts that link to plain-HTTP
  `http://pan.baidu.com/s/...` and label the access code `密码` instead
  of `提取码`. Accept both schemes and both labels while matching.
- Upgrade extracted `http://` links (from rendered text and from
  canonical card anchors) to `https://` before building the `?pwd=`
  direct link.
- Add regression coverage for the HTTP/`密码` card, the meta-description
  fallback, and http-anchor normalization.

## [1.0.6] - 2026-08-06

- Fix extraction failing entirely when the access code contains a
  multiplication-sign homoglyph (e.g. `28x4` rendered as `28&#215;4` by
  WordPress texturization). v1.0.4's strict alphanumeric code pattern
  removed the v1.0.3 homoglyph handling, so such pages showed no overlay.
- Accept `×`, `✕`, and `✖` while matching the four-character code, then
  normalize them back to the ASCII letter `x` before building the
  `?pwd=` direct link, keeping the code otherwise restricted to exactly
  four characters.
- Add regression coverage for homoglyph codes in the content card, the
  meta description, and the generated direct link.

## [1.0.5] - 2026-07-29

- Prefer the Baidu link anchor's canonical `href` from the visible content
  card over metadata or rendered link text. This preserves share IDs where
  Wckbot displays one en dash for two ASCII hyphens.
- Validate canonical anchors as HTTPS `pan.baidu.com/s/<share-id>` links and
  retain the v1.0.4 text/metadata normalization as a fallback.
- Add regression coverage for the double-hyphen share ID and fallback paths.

## [1.0.4] - 2026-07-26

- Fix Baidu share IDs truncated at an HTML-encoded en dash (`&#8211;`).
  Accept U+2013 while extracting the URL, then normalize it back to an ASCII
  hyphen before constructing the direct link.
- Restrict extraction passwords to exactly four alphanumeric characters.

## [1.0.3] - 2026-07-25

- Normalize known homoglyph symbols (e.g. the multiplication sign "×") back
  to their intended ASCII letter before building the Baidu Pan link. Some
  pages render an access code's letters using a visually similar symbol,
  and the raw symbol was previously sent to Baidu as-is, producing a
  mismatched/garbled password.
- URL-encode the access code with `encodeURIComponent` when building the
  `?pwd=` link, instead of interpolating it raw.
- Change the generated link's `rel` from `noopener noreferrer` to
  `noopener` only. Suppressing the referrer entirely can read as bot-like
  traffic to Baidu's anti-hotlink checks; `noopener` alone still prevents
  the opened tab from accessing `window.opener`.

## [1.0.2] - 2026-07-25

- Replace the broad `wckbot*.com` include pattern with an anchored
  `wckbot<digits>.com` regex, matching the site's actual migration pattern
  (`wckbot14.com`, `wckbot15.com`, `wckbot16.com`, ...) without matching
  spoofed hosts like `wckbot.evil.com`.
- Add `@noframes` so the script only runs in the top-level frame.
- Add `@icon` for the userscript manager listing.
- Deduplicate link/code extraction into a single shared helper.
- Reuse one hidden `<textarea>` for HTML-entity decoding instead of creating
  one per extraction call.
- Re-arm extraction so a changed Baidu Pan link/code on the same page load
  (e.g. client-side content swap) replaces the displayed panel instead of
  being ignored.
- Add a close button to the injected panel and cap its width to the
  viewport so it can't overflow on narrow screens.
- Raise the panel's `z-index` to avoid being hidden under page content.
- Make the filename-copy control keyboard-accessible (`role="button"`,
  focusable, `Enter`/`Space` support) and announce the copy via an
  `aria-live` region.

## [1.0.1] - 2026-07-26

- Update repository, support, installation, and automatic-update URLs following
  the repository rename to `userscript-wckbot`.
- Restore public access so Tampermonkey can install and check for updates.

## [1.0.0] - 2026-07-26

- First packaged public release.
- Extract Baidu Pan links and access codes from metadata or content cards.
- Decode HTML entities before extraction.
- Support symbols such as `×`, `-`, `+`, `*`, `/`, and `.` in access codes.
- Add direct-link generation and one-click filename copying.
