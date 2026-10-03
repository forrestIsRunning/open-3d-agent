/**
 * Desktop Main ↔ Runtime JSONL (not Codex JSON-RPC).
 */
export type EnvelopeRequest = {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
};

export type EnvelopeEvent = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

export const EnvelopeMethod = {
  runtimeStart: "runtime.start",
  runtimeStop: "runtime.stop",
  workspaceOpen: "workspace.open",
  threadStart: "thread.start",
  turnSend: "turn.send",
  turnInterrupt: "turn.interrupt",
  approvalRespond: "approval.respond",
  userInputRespond: "userInput.respond",
  commitModel: "workspace.commitModel",
  runCube: "workspace.runCube",
  runLamb: "workspace.runLamb",
  runTripo: "workspace.runTripo",
  generate3d: "workspace.generate3d",
  edit3d: "workspace.edit3d",
  transformModel: "workspace.transformModel",
  runPlaza: "workspace.runPlaza",
  fillHoles: "workspace.fillHoles",
  listAssets: "workspace.listAssets",
  sessionList: "session.list",
  sessionNew: "session.new",
  sessionOpen: "session.open",
  sessionAppend: "session.append",
  jobCancel: "job.cancel",
} as const;

export const EnvelopeEventMethod = {
  agentText: "agent.text",
  agentTool: "agent.tool",
  turnDone: "turn.done",
  turnError: "turn.error",
  approvalNeeded: "approval.needed",
  userInputNeeded: "userInput.needed",
  modelReady: "model.ready",
  editConcept: "edit.concept",
  jobProgress: "job.progress",
  log: "runtime.log",
} as const;
