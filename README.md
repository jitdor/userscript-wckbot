# Wckbot Baidu Pan QuickLink

A small Tampermonkey userscript that turns Baidu Pan links on `wckbot*.com`
pages into direct, clickable links with the access code already attached.

## Features

- Extracts a Baidu Pan URL and four-character access code from page metadata or
  the content card.
- Decodes HTML entities before matching the link and code.
- Supports letters, digits, and common symbols in access codes.
- Opens Baidu Pan with the access code in the `?pwd=` parameter.
- Displays the page title and copies `<title>.mp4` when the title is clicked.
- Marks the page after the generated link is opened.
- Stops observing the page after a match or after ten seconds.

## Install

1. Install a userscript manager such as
   [Tampermonkey](https://www.tampermonkey.net/).
2. Open the
   [raw userscript](https://raw.githubusercontent.com/jitdor/userscript-wckbot/main/wckbot-baidu-pan-quicklink.user.js).
3. Review the script and confirm the installation in your userscript manager.

The script runs only on URLs matching `*://wckbot*.com/*`.

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

- `wckbot-baidu-pan-quicklink-v1.0.1.zip`
- `wckbot-baidu-pan-quicklink.user.js`
- `SHA256SUMS`

## License

[MIT](LICENSE)
