import Dexie, { type Table } from "dexie";

import type { AppSettings, Checkpoint, Project, Task, TaskSession, Workspace } from "../domain/models";

const DEFAULT_WORKSPACE_ID = "workspace-main";

export class SmartSessionDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
  taskSessions!: Table<TaskSession, string>;
  sessions!: Table<TaskSession, string>;
  checkpoints!: Table<Checkpoint, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super("smartsession");

    this.version(1).stores({
      projects: "id, updatedAt, archivedAt",
      tasks: "id, projectId, status, updatedAt, archivedAt",
      taskSessions: "taskId, updatedAt",
      checkpoints: "id, taskId, createdAt",
      settings: "id",
    });

    this.version(2)
      .stores({
        workspaces: "id, updatedAt, archivedAt",
        projects: "id, workspaceId, updatedAt, archivedAt",
        tasks: "id, projectId, status, updatedAt, archivedAt",
        taskSessions: "taskId, updatedAt",
        checkpoints: "id, taskId, createdAt",
        settings: "id",
      })
      .upgrade(async (transaction) => {
        const timestamp = new Date().toISOString();
        const workspaces = transaction.table<Workspace, string>("workspaces");
        const projects = transaction.table<Project, string>("projects");
        const settings = transaction.table<AppSettings, string>("settings");

        await workspaces.put({
          id: DEFAULT_WORKSPACE_ID,
          title: "Main Workspace",
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        await projects.toCollection().modify((project) => {
          project.workspaceId = project.workspaceId ?? DEFAULT_WORKSPACE_ID;
        });

        const existingSettings = await settings.get("app");
        await settings.put({
          id: "app",
          restoreBehavior: existingSettings?.restoreBehavior ?? "new_window",
          confirmLargeRestoreThreshold: existingSettings?.confirmLargeRestoreThreshold ?? 20,
          activeTaskId: existingSettings?.activeTaskId,
          activeWorkspaceId: existingSettings?.activeWorkspaceId ?? DEFAULT_WORKSPACE_ID,
        });
      });

    this.version(3)
      .stores({
        workspaces: "id, updatedAt, archivedAt",
        projects: "id, workspaceId, updatedAt, archivedAt",
        tasks: "id, projectId, status, updatedAt, archivedAt",
        taskSessions: "taskId, updatedAt",
        sessions: "id, taskId, state, trackedWindowId, updatedAt, archivedAt",
        checkpoints: "id, taskId, createdAt",
        settings: "id",
      })
      .upgrade(async (transaction) => {
        const timestamp = new Date().toISOString();
        const oldSessions = transaction.table<{ taskId: string; tabs: TaskSession["tabs"]; trackedWindowId?: number; updatedAt: string }, string>(
          "taskSessions",
        );
        const sessions = transaction.table<TaskSession, string>("sessions");
        const settings = transaction.table<AppSettings, string>("settings");
        const existingSettings = await settings.get("app");
        const legacySessions = await oldSessions.toArray();

        await sessions.bulkPut(
          legacySessions.map((session) => ({
            id: `session_${crypto.randomUUID()}`,
            taskId: session.taskId,
            title: "Active session",
            state: existingSettings?.activeTaskId === session.taskId ? "active" : "open",
            tabs: session.tabs,
            trackedWindowId: session.trackedWindowId,
            createdAt: session.updatedAt ?? timestamp,
            lastActiveAt: session.updatedAt ?? timestamp,
            updatedAt: session.updatedAt ?? timestamp,
          })),
        );

        const activeSession = existingSettings?.activeTaskId
          ? await sessions.where("taskId").equals(existingSettings.activeTaskId).first()
          : undefined;

        if (existingSettings) {
          await settings.put({
            ...existingSettings,
            activeSessionId: activeSession?.id,
          });
        }
      });
  }
}

export const appDb = new SmartSessionDatabase();
