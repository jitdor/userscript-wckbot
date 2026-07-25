# Changelog

All notable changes to this project are documented here.

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
