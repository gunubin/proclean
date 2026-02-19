import { render } from "ink";
import meow from "meow";
import { App } from "./app.js";
import type { Mode } from "./lib/types.js";

const cli = meow(
  `
  Usage
    $ proclean [options]

  Options
    -a, --all    Show all orphan processes (not just dev tools)
    -h, --help   Show this help

  Examples
    $ proclean        # dev mode: Claude Code, node, cargo, etc.
    $ proclean -a     # all mode: everything except system processes
`,
  {
    importMeta: import.meta,
    flags: {
      all: {
        type: "boolean",
        shortFlag: "a",
        default: false,
      },
    },
  },
);

const mode: Mode = cli.flags.all ? "all" : "dev";

render(<App mode={mode} />);
