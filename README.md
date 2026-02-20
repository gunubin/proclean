# proclean

**Interactive TUI for finding and killing orphan processes (PPID=1).**

![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)
![TypeScript](https://img.shields.io/badge/typescript-5.7-blue)
![Ink](https://img.shields.io/badge/ink-6-magenta)
![License](https://img.shields.io/badge/license-MIT-blue)
![macOS](https://img.shields.io/badge/platform-macOS-lightgrey)

## Why proclean?

Closing tmux panes often leaves subprocess orphans (Claude Code, node, cargo, etc.) running with PPID=1, silently consuming memory. On macOS, PPID=1 also includes legitimate launchd-managed processes, so blindly killing everything is dangerous. proclean provides safe, filterable, interactive cleanup.

## Features

- **Two modes** -- `dev` (whitelist: Claude Code, node, cargo, rbenv) and `all` (blacklist: system processes only)
- **Interactive TUI** -- Navigate with j/k, select with space, bulk kill with enter
- **Search** -- `/` to filter by command name or PID
- **Detail pane** -- Tab to toggle full command line and process info
- **Safe kill** -- Confirmation prompt before SIGTERM, with result reporting
- **Scroll** -- Handles large process lists with viewport scrolling

## Installation

```bash
npm install -g proclean
```

Or run directly:

```bash
npx proclean
```

## Usage

```bash
# dev mode (default): Claude Code, node, cargo, rbenv orphans
proclean

# all mode: everything except /System, /usr, /Library/Apple
proclean -a
```

### tmux integration

Bind to a key for quick access:

```tmux
bind P display-popup -E -w 50% -h 50% "npx proclean"
```

### Keybindings

| Key | Action |
|-----|--------|
| `j` / `k` | Move cursor down / up |
| `Space` | Toggle selection |
| `a` | Select / deselect all |
| `Enter` | Kill selected (or highlighted) |
| `/` | Search mode |
| `Tab` | Toggle detail pane |
| `q` | Quit |
| `r` | Refresh (after kill) |

## Filter Logic

### dev mode (default)

Whitelist -- only shows orphans matching:

- `.local/share/claude` (Claude Code)
- `.npm`, `.nvm`, `.nodebrew` (Node.js)
- `.cargo` (Rust)
- `.rbenv` (Ruby)
- Standalone `node` processes
- `bash`/`zsh` spawned by Claude (`.claude/` in args)

### all mode (`-a`)

Blacklist -- shows everything except:

- `/System/*`
- `/usr/*`
- `/Library/Apple/*`

## Tech Stack

- [Ink 6](https://github.com/vadimdemedes/ink) + React 19 (TUI framework)
- [@inkjs/ui 2](https://github.com/vadimdemedes/ink-ui) (Spinner)
- [meow](https://github.com/sindresorhus/meow) (CLI args)
- [tsup](https://github.com/egoist/tsup) (ESM build)

## Development

```bash
git clone https://github.com/gunubin/proclean.git
cd proclean
npm install
npm run build
node dist/cli.js
```

## License

MIT
