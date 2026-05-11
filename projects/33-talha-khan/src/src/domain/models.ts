export type Timestamp = string;

export type Workspace = {
  id: string;
  title: string;
  description?: string;
  noteMarkdown?: string;
  sortOrder?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt?: Timestamp;
};

export type Project = {
  id: string;
  workspaceId: string;
  title: string;
  status?: ProjectStatus;
  description?: string;
  noteMarkdown?: string;
  sortOrder?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt?: Timestamp;
};

export type ProjectStatus = "backlog" | "active" | "completed" | "archived";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type SessionState = "open" | "closed" | "active" | "archived";

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  noteMarkdown?: string;
  sortOrder?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt?: Timestamp;
};

export type SessionTab = {
  id: string;
  url: string;
  title: string;
  noteMarkdown?: string;
  favIconUrl?: string;
  pinned: boolean;
  windowKey: string;
  tabIndex: number;
  groupId?: string;
  capturedAt: Timestamp;
};

export type TaskSession = {
  id: string;
  taskId: string;
  title?: string;
  description?: string;
  noteMarkdown?: string;
  state: SessionState;
  tabs: SessionTab[];
  trackedWindowId?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActiveAt?: Timestamp;
  closedAt?: Timestamp;
  archivedAt?: Timestamp;
  checkpointId?: string;
};

export type Checkpoint = {
  id: string;
  taskId: string;
  sessionId?: string;
  title?: string;
  noteMarkdown?: string;
  sessionTabs: SessionTab[];
  createdAt: Timestamp;
  basedOnCheckpointId?: string;
};

export type AppSettings = {
  id: "app";
  activeWorkspaceId?: string;
  activeTaskId?: string;
  activeSessionId?: string;
  restoreBehavior: "new_window" | "current_window";
  confirmLargeRestoreThreshold: number;
};

export type BootstrapCounts = {
  projects: number;
  tasks: number;
  taskSessions: number;
  checkpoints: number;
};
