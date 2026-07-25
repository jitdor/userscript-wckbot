# Wckbot Baidu Pan QuickLink

A small Tampermonkey userscript that turns Baidu Pan links on `wckbot*.com`
pages into direct, clickable links with the access code already attached.

## Features

- Extracts a Baidu Pan URL and four-character access code from page metadata or
  the content card.
- Decodes HTML entities before matching the link and code.
- Supports letters, digits, and common symbols in access codes.
- Opens Baidu Pan with the access code in the `?pwd=` parameter.
- Displays the page title and copies `<title>.mp4` when the title (or Enter/Space
  while it's focused) is activated.
- Marks the page after the generated link is opened.
- Replaces the panel if the page swaps in a different link/code without a
  full reload, and lets you dismiss it with a close button.
- Stops observing the page after ten seconds if no link/code is ever found.

## Install

1. Install a userscript manager such as
   [Tampermonkey](https://www.tampermonkey.net/).
2. Open the
   [raw userscript](https://raw.githubusercontent.com/jitdor/userscript-wckbot/main/wckbot-baidu-pan-quicklink.user.js).
3. Review the script and confirm the installation in your userscript manager.

The script runs only on URLs matching `wckbot<number>.com` (e.g.
`wckbot14.com`, `wckbot15.com`, `wckbot16.com`), which follows the site's
migration naming convention while excluding unrelated or spoofed domains.

## Usage

Visit a supported Wckbot content page. When a Baidu Pan link and access code are
found, a panel appears in the upper-left corner:

- Click the title to copy the filename as `<page title>.mp4`.
- Click the Baidu Pan link to open it with the access code filled in.

## Privacy and permissions

The script does not send data to third parties. It requests only
`GM_setClipboard`, which is used when you click the displayed title.

## Release package

Release artifacts are stored in `dist/`:

- `wckbot-baidu-pan-quicklink-v1.0.3.zip`
- `wckbot-baidu-pan-quicklink.user.js`
- `SHA256SUMS`

## License

[MIT](LICENSE)
