# ADR 0001: Codex app-server over stdio JSON-RPC

## Decision

Talk to `codex app-server --listen stdio://` with JSON-RPC 2.0. Do not use the Python Codex SDK as the desktop path.

## Why

The learning goal is the harness: initialize, thread/start, turn/start, ServerRequest approvals. The SDK hides that.

## Schema

Pin CLI in `CODEX_VERSION`. Regenerate with `pnpm proto:gen`.
