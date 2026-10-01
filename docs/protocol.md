# Codex app-server subset

Transport: stdio, one JSON object per line.

```
client: initialize
client: initialized (notify)
client: thread/start
client: turn/start
server: turn/started, item/completed, turn/completed
server may request: item/commandExecution/requestApproval, item/tool/call, currentTime/read
```

Method names live in `packages/protocol/src/methods.ts`.

RPC traces: `<workspace>/.lab/rpc.jsonl` (secrets redacted).
