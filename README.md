# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
(next) a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

Working on it with an agent: start at [AGENTS.md](AGENTS.md).

## Claude Code: link the shared skills

Claude Code loads project skills from `.claude/skills/`; the shared ones live in
`.agents/skills/`. Link each skill once per clone (the link is git-ignored, don't copy):

```sh
# macOS / Linux
mkdir -p .claude/skills
ln -s ../../.agents/skills/plan-to-issues .claude/skills/plan-to-issues

# Windows (cmd, Developer Mode on)
mkdir .claude\skills
mklink /D .claude\skills\plan-to-issues ..\..\.agents\skills\plan-to-issues
```

On Git Bash, plain `ln -s` makes a copy: set `MSYS=winsymlinks:nativestrict` first.
