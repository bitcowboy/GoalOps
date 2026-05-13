# goalops-mcp

MCP (Model Context Protocol) server that exposes GoalOps PocketBase
collections — **objectives**, **tasks**, **key_results**, **blockers**, and
the **next_actions** JSON field — as tools an LLM agent can call.

It connects to PocketBase over HTTP using the official
[`pocketbase`](https://www.npmjs.com/package/pocketbase) JS SDK, so the server
can run anywhere it can reach your PB instance.

## Requirements

- Node.js 20+
- A running PocketBase instance (e.g. `pnpm pb` in the repo root, or any
  remote PB deployment).

## Setup

```powershell
cd mcp
npm install
npm run build
```

Configure connection via environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `POCKETBASE_URL` | PB endpoint, defaults to `http://127.0.0.1:8090` |
| `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD` | Superuser login at startup (uses `_superusers` collection, falls back to legacy `admins` API) |
| `POCKETBASE_AUTH_TOKEN` | Pre-acquired token, written into the auth store directly. Takes precedence over email/password |

If your PB collections have open guest rules (see
`backend/pocketbase/pb_migrations/1778063864_goalops_open_guest_rules.js`),
you can run without credentials.

## Register with Claude Code

```powershell
# project-scoped registration
claude mcp add goalops -- node "G:/GitHub/GoalOps/mcp/dist/index.js"

# or, with credentials inline
claude mcp add goalops `
  --env POCKETBASE_URL=http://127.0.0.1:8090 `
  --env POCKETBASE_ADMIN_EMAIL=admin@example.com `
  --env POCKETBASE_ADMIN_PASSWORD=secret `
  -- node "G:/GitHub/GoalOps/mcp/dist/index.js"
```

For Claude Desktop, add an entry under `mcpServers` in
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "goalops": {
      "command": "node",
      "args": ["G:/GitHub/GoalOps/mcp/dist/index.js"],
      "env": {
        "POCKETBASE_URL": "http://127.0.0.1:8090"
      }
    }
  }
}
```

## Development

```powershell
# run from TS source (no build step) — handy while iterating
npm run dev

# typecheck only
npm run typecheck
```

## Tools

All names are prefixed `goalops_` to avoid collisions with other MCP servers.

### Objectives

- `goalops_objectives_list` — filter / sort / limit / expandOwner
- `goalops_objectives_get` — `id`, `expandOwner`
- `goalops_objectives_create` — full create input (`definition` is now the
  merged plain-text description; one_sentence_definition and background are
  retired by migration `1778100300`)
- `goalops_objectives_update` — partial update by `id`
- `goalops_objectives_delete` — cascades into related collections

### Tasks

- `goalops_tasks_list` — filter / sort / limit / expand
- `goalops_tasks_get` — `id`, `expand`
- `goalops_tasks_create` — `title`, `objective` required
- `goalops_tasks_update` — partial; pass `key_result: null` / `assignee: null`
  to clear
- `goalops_tasks_delete`

### Key Results

- `goalops_key_results_list` — pass `objective_id` for the common case
- `goalops_key_results_create`
- `goalops_key_results_update` — flip `is_completed`, rename, reorder
- `goalops_key_results_delete`

### Blockers

- `goalops_blockers_list` — pass `objective_id`
- `goalops_blockers_create`
- `goalops_blockers_update`
- `goalops_blockers_delete`

### Next Actions (JSON field on `objectives`)

- `goalops_next_actions_list` — read array
- `goalops_next_actions_set` — replace whole array
- `goalops_next_actions_append` — append one entry

## Filter cheatsheet

PocketBase filters use a SQL-ish DSL. A few common patterns:

```text
status="in_progress" && priority="P0"
objective="obj100000000001"
assignee="mbr100000000001" && status!="done"
due_date>="2026-05-01" && due_date<"2026-06-01"
```

Quote string literals with `"`; numeric and date comparisons use `> >= < <=`.
