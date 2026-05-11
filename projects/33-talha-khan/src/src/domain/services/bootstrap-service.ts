import { appDb } from "../../db/schema";
import type { AppSettings, BootstrapCounts, Checkpoint, Project, SessionTab, Task, TaskSession } from "../models";
import { createId, nowIso } from "../../shared/utils/identity";
import { ensureWorkspaceState } from "./workspace-service";

export type BootstrapSnapshot = {
  counts: BootstrapCounts;
  activeTaskId?: string;
  activeTaskTitle?: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  id: "app",
  restoreBehavior: "new_window",
  confirmLargeRestoreThreshold: 20,
};

export async function ensureDefaultSettings() {
  const activeWorkspaceId = await ensureWorkspaceState();
  const existing = await appDb.settings.get("app");

  if (!existing) {
    await appDb.settings.put({
      ...DEFAULT_SETTINGS,
      activeWorkspaceId,
    });
  } else if (!existing.activeWorkspaceId) {
    await appDb.settings.put({
      ...existing,
      activeWorkspaceId,
    });
  }
}

export async function getBootstrapSnapshot(): Promise<BootstrapSnapshot> {
  await ensureDefaultSettings();

  const [projects, tasks, taskSessions, checkpoints, settings] = await Promise.all([
    appDb.projects.count(),
    appDb.tasks.count(),
    appDb.sessions.count(),
    appDb.checkpoints.count(),
    appDb.settings.get("app"),
  ]);

  const activeTask = settings?.activeTaskId ? await appDb.tasks.get(settings.activeTaskId) : undefined;

  return {
    counts: {
      projects,
      tasks,
      taskSessions,
      checkpoints,
    },
    activeTaskId: settings?.activeTaskId,
    activeTaskTitle: activeTask?.title,
  };
}

export async function seedDemoWorkspace(): Promise<BootstrapSnapshot> {
  await ensureDefaultSettings();

  const projectCount = await appDb.projects.count();

  if (projectCount > 0) {
    return getBootstrapSnapshot();
  }

  const timestamp = nowIso();
  const activeWorkspaceId = await ensureWorkspaceState();

  const project: Project = {
    id: createId("project"),
    workspaceId: activeWorkspaceId,
    title: "Chrome Extension MVP",
    status: "active",
    description: "Early workspace for building SmartSession.",
    noteMarkdown: "## Focus\n- Validate the shell\n- Review the information architecture",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const task: Task = {
    id: createId("task"),
    projectId: project.id,
    title: "Milestone 1 foundation",
    description: "Scaffold the extension and validate the shell experience.",
    status: "in_progress",
    noteMarkdown: "### Notes\nFoundation is in place. Next step is project and task CRUD.",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const sessionTabs: SessionTab[] = [
    {
      id: createId("tab"),
      url: "https://developer.chrome.com/docs/extensions",
      title: "Chrome Extensions",
      pinned: true,
      windowKey: "window-1",
      tabIndex: 0,
      capturedAt: timestamp,
    },
    {
      id: createId("tab"),
      url: "https://github.com/crxjs/chrome-extension-tools",
      title: "CRXJS",
      pinned: false,
      windowKey: "window-1",
      tabIndex: 1,
      capturedAt: timestamp,
    },
  ];

  const taskSession: TaskSession = {
    id: createId("session"),
    taskId: task.id,
    title: "Foundation session",
    state: "active",
    tabs: sessionTabs,
    createdAt: timestamp,
    lastActiveAt: timestamp,
    updatedAt: timestamp,
  };

  const checkpoint: Checkpoint = {
    id: createId("checkpoint"),
    taskId: task.id,
    sessionId: taskSession.id,
    title: "Foundation seeded",
    noteMarkdown: "Initial sample checkpoint for Milestone 1.",
    sessionTabs,
    createdAt: timestamp,
  };

  await appDb.transaction(
    "rw",
    [appDb.projects, appDb.tasks, appDb.sessions, appDb.checkpoints, appDb.settings],
    async () => {
      await appDb.projects.add(project);
      await appDb.tasks.add(task);
      await appDb.sessions.put(taskSession);
      await appDb.checkpoints.add(checkpoint);
      await appDb.settings.put({
        id: "app",
        activeWorkspaceId,
        activeTaskId: task.id,
        activeSessionId: taskSession.id,
        restoreBehavior: "new_window",
        confirmLargeRestoreThreshold: 20,
      });
    },
  );

  return getBootstrapSnapshot();
}
