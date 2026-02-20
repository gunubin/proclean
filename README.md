# proclean

**Interactive orphan process killer powered by fzf.**

![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)
![TypeScript](https://img.shields.io/badge/typescript-5.7-blue)
![fzf](https://img.shields.io/badge/fzf-required-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![macOS](https://img.shields.io/badge/platform-macOS-lightgrey)

## Why proclean?

Closing tmux panes often leaves subprocess orphans (Claude Code, node, cargo, etc.) running with PPID=1, silently consuming memory. On macOS, PPID=1 also includes legitimate launchd-managed processes, so blindly killing everything is dangerous. proclean provides safe, filterable, interactive cleanup.

## Features

- **Two modes** -- `dev` (whitelist: Claude Code, node, cargo, rbenv) and `all` (blacklist: system processes only)
- **fzf-powered UI** -- Fuzzy search, multi-select, real-time preview
- **Detail preview** -- Process info, command line, open files in side pane
- **Safe kill** -- SIGTERM with automatic list reload
- **Catppuccin Frappe theme** -- Consistent color scheme

## Prerequisites

- [fzf](https://github.com/junegunn/fzf) (>= 0.57)

```bash
brew install fzf
```

## Installation

```bash
git clone https://github.com/gunubin/proclean.git
cd proclean
npm install && npm run build
npm link
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
bind P display-popup -E -w 50% -h 50% "proclean"
```

### Keybindings

| Key | Action |
|-----|--------|
| `TAB` | Toggle selection |
| `Enter` | Kill selected processes |
| `Ctrl-A` | Select / deselect all |
| `Ctrl-C` | Quit |
| Type to search | Fuzzy filter |

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

- [fzf](https://github.com/junegunn/fzf) (interactive UI)
- [meow](https://github.com/sindresorhus/meow) (CLI args)
- [tsup](https://github.com/egoist/tsup) (ESM build)

## License

MIT
