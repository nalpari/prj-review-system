export type Model = "claude" | "codex";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "canceled";
export type Severity = "critical" | "warning" | "suggestion";
export type IssueStatus = "unread" | "acknowledged" | "resolved" | "deferred";
export type Retention = "retained" | "hidden" | "deleted";

export type User = { id: string; name: string; email: string; role: "member" | "admin" };

export type Team = { id: string; name: string };

export type Membership = {
  id: string;
  team: string;
  user: string;
  role: "developer" | "reviewer" | "lead" | "manager";
  expand?: { user?: User; team?: Team };
};

export type Repository = {
  id: string;
  team: string;
  name: string;
  remote_url: string;
  local_path: string;
  default_branch: string;
  line_no: number;
  line_color: string;
  retention: Retention;
  expand?: { team?: Team };
};

export type Commit = { sha: string; subject: string; author: string; date: string; selected: boolean };
export type FileStat = { path: string; additions: number; deletions: number };
export type DiffStats = { files: FileStat[]; additions: number; deletions: number; mergeBase?: string };

export type ReviewRequest = {
  id: string;
  repository: string;
  requester: string;
  current_branch: string;
  target_branch: string;
  base_sha: string;
  head_sha: string;
  commits: Commit[] | null;
  context: string;
  model: Model;
  status: RunStatus;
  idempotency_key: string;
  diff_stats: DiffStats | null;
  diff?: string;
  summary: string;
  partial: boolean;
  error: string;
  started_at: string;
  heartbeat_at: string;
  finished_at: string;
  retention: Retention;
  retention_changed_at: string;
  created: string;
  updated: string;
  expand?: { repository?: Repository; requester?: User };
};

export type Issue = {
  id: string;
  request: string;
  file: string;
  line_start: number;
  line_end: number;
  severity: Severity;
  title: string;
  body: string;
  suggestion: string;
  model: Model;
  status: IssueStatus;
  created: string;
  updated: string;
};

export type Comment = {
  id: string;
  issue: string;
  request: string;
  author: string;
  body: string;
  edited_at: string;
  deleted: boolean;
  created: string;
  expand?: { author?: User };
};

export type IssueEvent = {
  id: string;
  issue: string;
  actor: string;
  kind: "status" | "comment" | "comment_edit" | "comment_delete";
  from: string;
  to: string;
  created: string;
  expand?: { actor?: User };
};
