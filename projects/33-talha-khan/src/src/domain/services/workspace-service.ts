import { appDb } from "../../db/schema";
import type { Project, ProjectStatus, SessionState, SessionTab, Task, TaskSession, TaskStatus, Workspace } from "../models";
import { createId, nowIso } from "../../shared/utils/identity";

const DEFAULT_WORKSPACE_ID = "workspace-main";
const DEFAULT_WORKSPACE_TITLE = "Main Workspace";

export type WorkspaceTaskSummary = Task & {
  sessionTabCount: number;
  checkpointCount: number;
  sessionTabs: SessionTab[];
  sessions: WorkspaceSessionSummary[];
  checkpoints: WorkspaceCheckpointSummary[];
};

export type WorkspaceProjectSummary = Project & {
  tasks: WorkspaceTaskSummary[];
};

export type WorkspaceSummary = Workspace & {
  projectCount: number;
  recentProjects: Array<Pick<Project, "id" | "title">>;
};

export type WorkspaceSnapshot = {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  activeWorkspaceTitle: string;
  projects: WorkspaceProjectSummary[];
  activeTaskId?: string;
  activeTaskTitle?: string;
  activeSessionId?: string;
  query?: string;
};

export type WorkspaceSessionSummary = {
  id: string;
  taskId: string;
  title?: string;
  description?: string;
  noteMarkdown?: string;
  state: SessionState;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
  closedAt?: string;
  archivedAt?: string;
  checkpointId?: string;
  trackedWindowId?: number;
  tabCount: number;
  tabs: SessionTab[];
};

export type WorkspaceCheckpointSummary = {
  id: string;
  taskId: string;
  sessionId?: string;
  title?: string;
  createdAt: string;
  tabCount: number;
  noteMarkdown?: string;
  sessionTabs: SessionTab[];
};

export type CreateProjectInput = {
  title: string;
  workspaceId?: string;
  status?: ProjectStatus;
  description?: string;
  noteMarkdown?: string;
};

export type UpdateProjectInput = {
  id: string;
  title: string;
  status?: ProjectStatus;
  description?: string;
  noteMarkdown?: string;
};

export type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  noteMarkdown?: string;
};

export type UpdateTaskInput = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  noteMarkdown?: string;
};

export type CreateCheckpointInput = {
  taskId: string;
  sessionId?: string;
  title?: string;
  noteMarkdown?: string;
};

export type DeleteTaskSessionInput = {
  sessionId: string;
};

export type UpdateTaskSessionStateInput = {
  sessionId: string;
  state: Extract<SessionState, "open" | "closed" | "archived">;
};

export type UpdateTaskSessionInput = {
  id: string;
  title?: string;
  description?: string;
  noteMarkdown?: string;
};

export type ReorderProjectsInput = {
  projectId: string;
  status: ProjectStatus;
  orderedProjectIds: string[];
};

export type ReorderTasksInput = {
  taskId: string;
  status: TaskStatus;
  orderedTaskIds: string[];
};

export type MoveSessionTabInput = {
  sourceSessionId: string;
  targetSessionId: string;
  tabId: string;
  orderedTabIds: string[];
};

export type AttachDraggedTabInput = {
  taskId: string;
  sessionId: string;
  tab: Pick<chrome.tabs.Tab, "id" | "url" | "title" | "favIconUrl" | "pinned" | "windowId" | "index" | "groupId">;
  orderedTabIds?: string[];
  beforeTabId?: string;
};

export type AttachSessionInput = {
  taskId: string;
  sessionId?: string;
};

export type UpdateSessionTabNoteInput = {
  sessionId: string;
  tabId: string;
  noteMarkdown: string;
};

export type CreateWorkspaceInput = {
  title: string;
  description?: string;
  noteMarkdown?: string;
};

export type UpdateWorkspaceInput = {
  id: string;
  title: string;
  description?: string;
  noteMarkdown?: string;
  archivedAt?: string | null;
};

export async function ensureWorkspaceState() {
  const timestamp = nowIso();
  let settings = await appDb.settings.get("app");
  const workspaces = await appDb.workspaces.toArray();
  let activeWorkspace = settings?.activeWorkspaceId
    ? workspaces.find((workspace) => workspace.id === settings?.activeWorkspaceId)
    : undefined;

  if (!workspaces.length) {
    activeWorkspace = {
      id: DEFAULT_WORKSPACE_ID,
      title: DEFAULT_WORKSPACE_TITLE,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await appDb.workspaces.put(activeWorkspace);
  } else if (!activeWorkspace) {
    activeWorkspace = workspaces.find((workspace) => !workspace.archivedAt) ?? workspaces[0];
  }

  const activeWorkspaceId = activeWorkspace?.id ?? DEFAULT_WORKSPACE_ID;
  const projects = await appDb.projects.toArray();
  const unassignedProjects = projects.filter((project) => !project.workspaceId);

  if (unassignedProjects.length) {
    await appDb.projects.bulkPut(
      unassignedProjects.map((project) => ({
        ...project,
        workspaceId: activeWorkspaceId,
        updatedAt: project.updatedAt ?? timestamp,
      })),
    );
  }

  settings = await appDb.settings.get("app");
  await appDb.settings.put({
    id: "app",
    restoreBehavior: settings?.restoreBehavior ?? "new_window",
    confirmLargeRestoreThreshold: settings?.confirmLargeRestoreThreshold ?? 20,
    activeTaskId: settings?.activeTaskId,
    activeSessionId: settings?.activeSessionId,
    activeWorkspaceId,
  });

  return activeWorkspaceId;
}

export async function getWorkspaceSnapshot(query?: string): Promise<WorkspaceSnapshot> {
  const activeWorkspaceId = await ensureWorkspaceState();
  const [workspaces, projects, tasks, sessions, checkpoints, settings] = await Promise.all([
    appDb.workspaces.toArray(),
    appDb.projects.toArray(),
    appDb.tasks.toArray(),
    appDb.sessions.toArray(),
    appDb.checkpoints.toArray(),
    appDb.settings.get("app"),
  ]);

  const normalizedQuery = query?.trim().toLowerCase();
  const taskSessions = new Map<string, WorkspaceSessionSummary[]>();
  sessions.forEach((session) => {
    const summary = toSessionSummary(session);
    taskSessions.set(session.taskId, [...(taskSessions.get(session.taskId) ?? []), summary]);
  });
  taskSessions.forEach((items) =>
    items.sort((left, right) => {
      const leftRank = left.id === settings?.activeSessionId ? 0 : left.state === "active" ? 1 : left.state === "open" ? 2 : left.state === "closed" ? 3 : 4;
      const rightRank = right.id === settings?.activeSessionId ? 0 : right.state === "active" ? 1 : right.state === "open" ? 2 : right.state === "closed" ? 3 : 4;
      return leftRank - rightRank || getSessionActivityAt(right).localeCompare(getSessionActivityAt(left));
    }),
  );
  taskSessions.forEach((items) => assignSessionDisplayTitles(items));
  const sessionCounts = new Map<string, number>();
  taskSessions.forEach((items, taskId) => {
    sessionCounts.set(
      taskId,
      items.filter((session) => session.state === "active" || session.state === "open").reduce((sum, session) => sum + session.tabCount, 0),
    );
  });
  const checkpointCounts = new Map<string, number>();

  checkpoints.forEach((checkpoint) => {
    checkpointCounts.set(checkpoint.taskId, (checkpointCounts.get(checkpoint.taskId) ?? 0) + 1);
  });

  const workspaceSummaries = workspaces
    .sort((left, right) => {
      const stateOrder = Number(Boolean(left.archivedAt)) - Number(Boolean(right.archivedAt));
      return stateOrder || right.updatedAt.localeCompare(left.updatedAt);
    })
    .map<WorkspaceSummary>((workspace) => {
      const workspaceProjects = projects
        .filter((project) => project.workspaceId === workspace.id && !project.archivedAt)
        .sort(compareOrderedEntities);

      return {
        ...workspace,
        projectCount: workspaceProjects.length,
        recentProjects: workspaceProjects.slice(0, 4).map((project) => ({
          id: project.id,
          title: project.title,
        })),
      };
    });
  const activeWorkspace =
    workspaceSummaries.find((workspace) => workspace.id === activeWorkspaceId) ??
    workspaceSummaries.find((workspace) => !workspace.archivedAt) ??
    workspaceSummaries[0];

  const filteredProjects = projects
    .filter((project) => project.workspaceId === activeWorkspace?.id && !project.archivedAt)
    .sort(compareOrderedEntities)
    .map((project) => {
      const projectTasks = tasks
        .filter((task) => task.projectId === project.id && !task.archivedAt)
        .sort(compareOrderedEntities)
        .map<WorkspaceTaskSummary>((task) => ({
          ...task,
          sessionTabCount: sessionCounts.get(task.id) ?? 0,
          checkpointCount: checkpointCounts.get(task.id) ?? 0,
          sessionTabs: taskSessions.get(task.id)?.find((session) => session.id === settings?.activeSessionId)?.tabs ?? taskSessions.get(task.id)?.[0]?.tabs ?? [],
          sessions: taskSessions.get(task.id) ?? [],
          checkpoints: checkpoints
            .filter((checkpoint) => checkpoint.taskId === task.id)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map((checkpoint) => ({
              id: checkpoint.id,
              taskId: checkpoint.taskId,
              sessionId: checkpoint.sessionId,
              title: checkpoint.title,
              createdAt: checkpoint.createdAt,
              tabCount: checkpoint.sessionTabs.length,
              noteMarkdown: checkpoint.noteMarkdown,
              sessionTabs: checkpoint.sessionTabs,
            })),
        }));

      return {
        ...project,
        tasks: projectTasks,
      };
    })
    .filter((project) => {
      if (!normalizedQuery) {
        return true;
      }

      const projectMatches = matchesQuery([project.title, project.description], normalizedQuery);
      const taskMatches = project.tasks.some((task) =>
        matchesQuery(
          [
            task.title,
            task.description,
            task.noteMarkdown,
            ...task.checkpoints.map((checkpoint) => checkpoint.title),
            ...task.checkpoints.map((checkpoint) => checkpoint.noteMarkdown),
          ],
          normalizedQuery,
        ),
      );

      return projectMatches || taskMatches;
    })
    .map((project) => {
      if (!normalizedQuery) {
        return project;
      }

      const projectMatches = matchesQuery([project.title, project.description], normalizedQuery);

      return {
        ...project,
        tasks: projectMatches
          ? project.tasks
          : project.tasks.filter((task) =>
              matchesQuery(
                [
                  task.title,
                  task.description,
                  task.noteMarkdown,
                  ...task.checkpoints.map((checkpoint) => checkpoint.title),
                  ...task.checkpoints.map((checkpoint) => checkpoint.noteMarkdown),
                ],
                normalizedQuery,
              ),
            ),
      };
    });

  const activeTask = settings?.activeTaskId ? tasks.find((task) => task.id === settings.activeTaskId) : undefined;

  return {
    workspaces: workspaceSummaries,
    activeWorkspaceId: activeWorkspace?.id ?? activeWorkspaceId,
    activeWorkspaceTitle: activeWorkspace?.title ?? DEFAULT_WORKSPACE_TITLE,
    projects: filteredProjects,
    activeTaskId: settings?.activeTaskId,
    activeTaskTitle: activeTask?.title,
    activeSessionId: settings?.activeSessionId,
    query,
  };
}

function toSessionSummary(session: TaskSession): WorkspaceSessionSummary {
  return {
    id: session.id,
    taskId: session.taskId,
    title: normalizeSessionTitle(session.title),
    description: session.description,
    noteMarkdown: session.noteMarkdown,
    state: session.state,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastActiveAt: session.lastActiveAt,
    closedAt: session.closedAt,
    archivedAt: session.archivedAt,
    checkpointId: session.checkpointId,
    trackedWindowId: session.trackedWindowId,
    tabCount: session.tabs.length,
    tabs: session.tabs,
  };
}

function normalizeSessionTitle(title?: string) {
  const trimmed = title?.trim();
  if (!trimmed || /^(active|open|closed|archived) session$/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function assignSessionDisplayTitles(sessions: WorkspaceSessionSummary[]) {
  const usedTitles = new Set<string>();
  const fallbackTitles = new Map<string, string>();

  [...sessions]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
    .forEach((session, index) => {
      fallbackTitles.set(session.id, `Session ${index + 1}`);
    });

  sessions.forEach((session) => {
    const baseTitle = session.title?.trim() || fallbackTitles.get(session.id) || "Session";
    let nextTitle = baseTitle;
    let suffix = 2;

    while (usedTitles.has(nextTitle.toLowerCase())) {
      nextTitle = `${baseTitle} ${suffix}`;
      suffix += 1;
    }

    session.title = nextTitle;
    usedTitles.add(nextTitle.toLowerCase());
  });
}

function getSessionActivityAt(session: Pick<WorkspaceSessionSummary, "lastActiveAt" | "updatedAt" | "createdAt">) {
  return session.lastActiveAt ?? session.updatedAt ?? session.createdAt;
}

function compareOrderedEntities<T extends { sortOrder?: number; updatedAt: string; createdAt?: string; id: string }>(left: T, right: T) {
  const leftOrder = left.sortOrder ?? Number.POSITIVE_INFINITY;
  const rightOrder = right.sortOrder ?? Number.POSITIVE_INFINITY;
  return leftOrder - rightOrder || right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
}

function insertBeforeId(ids: string[], draggedId: string, beforeId?: string) {
  const nextIds = ids.filter((id) => id !== draggedId);
  const targetIndex = beforeId ? nextIds.indexOf(beforeId) : -1;
  nextIds.splice(targetIndex >= 0 ? targetIndex : nextIds.length, 0, draggedId);
  return nextIds;
}

function getSessionTabKey(tab: Pick<SessionTab, "url" | "title"> | Pick<chrome.tabs.Tab, "url" | "title">) {
  return `${tab.url ?? ""}::${tab.title ?? ""}`;
}

function normalizedTaskStatus(status: TaskStatus) {
  return status === "blocked" ? "todo" : status;
}

async function getNextProjectSortOrder(workspaceId: string, status: ProjectStatus) {
  const projects = await appDb.projects
    .where("workspaceId")
    .equals(workspaceId)
    .and((project) => (project.status ?? "backlog") === status)
    .toArray();
  return Math.max(-1, ...projects.map((project) => project.sortOrder ?? -1)) + 1;
}

async function getNextTaskSortOrder(projectId: string, status: TaskStatus) {
  const tasks = await appDb.tasks
    .where("projectId")
    .equals(projectId)
    .and((task) => normalizedTaskStatus(task.status) === normalizedTaskStatus(status))
    .toArray();
  return Math.max(-1, ...tasks.map((task) => task.sortOrder ?? -1)) + 1;
}

export async function createProject(input: CreateProjectInput) {
  const activeWorkspaceId = await ensureWorkspaceState();
  const timestamp = nowIso();
  const project: Project = {
    id: createId("project"),
    workspaceId: input.workspaceId ?? activeWorkspaceId,
    title: input.title.trim(),
    status: input.status ?? "backlog",
    description: input.description?.trim() || undefined,
    noteMarkdown: input.noteMarkdown,
    sortOrder: await getNextProjectSortOrder(input.workspaceId ?? activeWorkspaceId, input.status ?? "backlog"),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await appDb.projects.add(project);
  return project;
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  const timestamp = nowIso();
  const workspace: Workspace = {
    id: createId("workspace"),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    noteMarkdown: input.noteMarkdown,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (!workspace.title) {
    throw new Error("Workspace title is required.");
  }

  await appDb.workspaces.add(workspace);
  await setActiveWorkspace(workspace.id);
  return workspace;
}

export async function updateWorkspace(input: UpdateWorkspaceInput) {
  const existing = await appDb.workspaces.get(input.id);

  if (!existing) {
    throw new Error("Workspace not found.");
  }

  const next: Workspace = {
    ...existing,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    noteMarkdown: input.noteMarkdown ?? existing.noteMarkdown,
    archivedAt: input.archivedAt === null ? undefined : input.archivedAt ?? existing.archivedAt,
    updatedAt: nowIso(),
  };

  if (!next.title) {
    throw new Error("Workspace title is required.");
  }

  await appDb.workspaces.put(next);
  return next;
}

export async function deleteWorkspace(workspaceId: string) {
  const workspaces = await appDb.workspaces.toArray();
  const workspace = workspaces.find((item) => item.id === workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const remainingWorkspace = workspaces
    .filter((item) => item.id !== workspaceId && !item.archivedAt)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  if (!remainingWorkspace) {
    throw new Error("Create another workspace before deleting this one.");
  }

  const workspaceProjects = await appDb.projects.where("workspaceId").equals(workspaceId).toArray();
  const projectIds = workspaceProjects.map((project) => project.id);
  const projectTasks = projectIds.length
    ? await appDb.tasks.where("projectId").anyOf(projectIds).toArray()
    : [];
  const taskIds = projectTasks.map((task) => task.id);

  await appDb.transaction(
    "rw",
    [appDb.workspaces, appDb.projects, appDb.tasks, appDb.sessions, appDb.checkpoints, appDb.settings],
    async () => {
      await appDb.workspaces.delete(workspaceId);
      if (projectIds.length) {
        await appDb.projects.bulkDelete(projectIds);
      }
      if (taskIds.length) {
        await appDb.tasks.bulkDelete(taskIds);
        const sessionIds = (await appDb.sessions.where("taskId").anyOf(taskIds).primaryKeys()) as string[];
        if (sessionIds.length > 0) {
          await appDb.sessions.bulkDelete(sessionIds);
        }
      }

      const checkpointIds = (
        await appDb.checkpoints.where("taskId").anyOf(taskIds.length ? taskIds : ["__none__"]).primaryKeys()
      ) as string[];

      if (checkpointIds.length > 0) {
        await appDb.checkpoints.bulkDelete(checkpointIds);
      }

      const settings = await appDb.settings.get("app");
      await appDb.settings.put({
        id: "app",
        restoreBehavior: settings?.restoreBehavior ?? "new_window",
        confirmLargeRestoreThreshold: settings?.confirmLargeRestoreThreshold ?? 20,
        activeTaskId: settings?.activeTaskId && taskIds.includes(settings.activeTaskId) ? undefined : settings?.activeTaskId,
        activeSessionId: settings?.activeTaskId && taskIds.includes(settings.activeTaskId) ? undefined : settings?.activeSessionId,
        activeWorkspaceId: remainingWorkspace.id,
      });
    },
  );
}

export async function setActiveWorkspace(workspaceId: string) {
  const workspace = await appDb.workspaces.get(workspaceId);
  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const settings = await appDb.settings.get("app");
  const workspaceProjectIds = (await appDb.projects.where("workspaceId").equals(workspaceId).toArray()).map(
    (project) => project.id,
  );
  const activeTask = settings?.activeTaskId ? await appDb.tasks.get(settings.activeTaskId) : undefined;
  const keepActiveTask = Boolean(activeTask && workspaceProjectIds.includes(activeTask.projectId));

  await appDb.settings.put({
    id: "app",
    restoreBehavior: settings?.restoreBehavior ?? "new_window",
    confirmLargeRestoreThreshold: settings?.confirmLargeRestoreThreshold ?? 20,
    activeTaskId: keepActiveTask ? activeTask?.id : undefined,
    activeSessionId: keepActiveTask ? settings?.activeSessionId : undefined,
    activeWorkspaceId: workspaceId,
  });

  return workspace;
}

export async function updateProject(input: UpdateProjectInput) {
  const existing = await appDb.projects.get(input.id);

  if (!existing) {
    throw new Error("Project not found.");
  }

  const next: Project = {
    ...existing,
    title: input.title.trim(),
    status: input.status ?? existing.status ?? "backlog",
    description: input.description?.trim() || undefined,
    noteMarkdown: input.noteMarkdown ?? existing.noteMarkdown,
    updatedAt: nowIso(),
  };

  await appDb.projects.put(next);
  return next;
}

export async function reorderProjects(input: ReorderProjectsInput) {
  const project = await appDb.projects.get(input.projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const timestamp = nowIso();
  const targetIds = input.orderedProjectIds.filter((id, index, ids) => ids.indexOf(id) === index);
  const projects = await appDb.projects.bulkGet(targetIds);
  await appDb.transaction("rw", [appDb.projects], async () => {
    await Promise.all(
      projects.map((item, index) =>
        item
          ? appDb.projects.put({
              ...item,
              status: item.id === input.projectId ? input.status : item.status,
              sortOrder: index,
              updatedAt: timestamp,
            })
          : Promise.resolve(),
      ),
    );
    if (!targetIds.includes(input.projectId)) {
      await appDb.projects.put({
        ...project,
        status: input.status,
        sortOrder: targetIds.length,
        updatedAt: timestamp,
      });
    }
  });
}

export async function deleteProject(projectId: string) {
  const projectTasks = await appDb.tasks.where("projectId").equals(projectId).toArray();
  const taskIds = projectTasks.map((task) => task.id);

  await appDb.transaction(
    "rw",
    [appDb.projects, appDb.tasks, appDb.sessions, appDb.checkpoints, appDb.settings],
    async () => {
      await appDb.projects.delete(projectId);
      await appDb.tasks.bulkDelete(taskIds);
      const sessionIds = (await appDb.sessions.where("taskId").anyOf(taskIds.length ? taskIds : ["__none__"]).primaryKeys()) as string[];
      if (sessionIds.length > 0) {
        await appDb.sessions.bulkDelete(sessionIds);
      }

      const checkpointIds = (
        await appDb.checkpoints.where("taskId").anyOf(taskIds.length ? taskIds : ["__none__"]).primaryKeys()
      ) as string[];

      if (checkpointIds.length > 0) {
        await appDb.checkpoints.bulkDelete(checkpointIds);
      }

      const settings = await appDb.settings.get("app");
      if (settings?.activeTaskId && taskIds.includes(settings.activeTaskId)) {
        await appDb.settings.put({
          ...settings,
          activeTaskId: undefined,
          activeSessionId: undefined,
        });
      }
    },
  );
}

export async function createTask(input: CreateTaskInput) {
  const project = await appDb.projects.get(input.projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const timestamp = nowIso();
  const task: Task = {
    id: createId("task"),
    projectId: input.projectId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    status: input.status ?? "todo",
    noteMarkdown: input.noteMarkdown,
    sortOrder: await getNextTaskSortOrder(input.projectId, input.status ?? "todo"),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await appDb.tasks.add(task);
  return task;
}

export async function reorderTasks(input: ReorderTasksInput) {
  const task = await appDb.tasks.get(input.taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const timestamp = nowIso();
  const targetIds = input.orderedTaskIds.filter((id, index, ids) => ids.indexOf(id) === index);
  const tasks = await appDb.tasks.bulkGet(targetIds);
  await appDb.transaction("rw", [appDb.tasks, appDb.settings], async () => {
    await Promise.all(
      tasks.map((item, index) =>
        item
          ? appDb.tasks.put({
              ...item,
              status: item.id === input.taskId ? input.status : item.status,
              sortOrder: index,
              updatedAt: timestamp,
            })
          : Promise.resolve(),
      ),
    );
    if (!targetIds.includes(input.taskId)) {
      await appDb.tasks.put({
        ...task,
        status: input.status,
        sortOrder: targetIds.length,
        updatedAt: timestamp,
      });
    }

    if (input.status === "done") {
      const settings = await appDb.settings.get("app");
      if (settings?.activeTaskId === input.taskId) {
        await appDb.settings.put({
          ...settings,
          activeTaskId: undefined,
          activeSessionId: undefined,
        });
      }
    }
  });
}

export async function updateTask(input: UpdateTaskInput) {
  const existing = await appDb.tasks.get(input.id);

  if (!existing) {
    throw new Error("Task not found.");
  }

  const next: Task = {
    ...existing,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    status: input.status,
    noteMarkdown: input.noteMarkdown ?? existing.noteMarkdown,
    updatedAt: nowIso(),
  };

  await appDb.tasks.put(next);

  if (input.status === "done") {
    const settings = await appDb.settings.get("app");
    if (settings?.activeTaskId === input.id) {
      await appDb.settings.put({
        ...settings,
        activeTaskId: undefined,
        activeSessionId: undefined,
      });
    }
  }

  return next;
}

export async function deleteTask(taskId: string) {
  await appDb.transaction(
    "rw",
    [appDb.tasks, appDb.sessions, appDb.checkpoints, appDb.settings],
    async () => {
      await appDb.tasks.delete(taskId);
      const sessionIds = (await appDb.sessions.where("taskId").equals(taskId).primaryKeys()) as string[];
      if (sessionIds.length > 0) {
        await appDb.sessions.bulkDelete(sessionIds);
      }

      const checkpointIds = (await appDb.checkpoints.where("taskId").equals(taskId).primaryKeys()) as string[];
      if (checkpointIds.length > 0) {
        await appDb.checkpoints.bulkDelete(checkpointIds);
      }

      const settings = await appDb.settings.get("app");
      if (settings?.activeTaskId === taskId) {
        await appDb.settings.put({
          ...settings,
          activeTaskId: undefined,
          activeSessionId: undefined,
        });
      }
    },
  );
}

export async function setActiveTask(taskId: string) {
  const task = await appDb.tasks.get(taskId);

  if (!task) {
    throw new Error("Task not found.");
  }

  const settings = await appDb.settings.get("app");
  const activeSession =
    (settings?.activeSessionId ? await appDb.sessions.get(settings.activeSessionId) : undefined) ??
    (await appDb.sessions.where("taskId").equals(taskId).and((session) => session.state === "active" || session.state === "open").first());

  await appDb.settings.put({
    id: "app",
    restoreBehavior: settings?.restoreBehavior ?? "new_window",
    confirmLargeRestoreThreshold: settings?.confirmLargeRestoreThreshold ?? 20,
    activeWorkspaceId: settings?.activeWorkspaceId,
    activeTaskId: taskId,
    activeSessionId: activeSession?.taskId === taskId ? activeSession.id : settings?.activeSessionId,
  });

  return task;
}

async function setActiveSessionState(sessionId: string) {
  const session = await appDb.sessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }

  const task = await appDb.tasks.get(session.taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const settings = await appDb.settings.get("app");
  const timestamp = nowIso();
  const activeSessions = await appDb.sessions.where("state").equals("active").toArray();
  const nextSession = {
    ...session,
    state: "active" as const,
    archivedAt: undefined,
    lastActiveAt: timestamp,
    updatedAt: timestamp,
  };

  await appDb.transaction("rw", [appDb.sessions, appDb.settings], async () => {
    await Promise.all(
      activeSessions
        .filter((item) => item.id !== sessionId)
        .map((item) =>
          appDb.sessions.put({
            ...item,
            state: "open",
            updatedAt: timestamp,
          }),
        ),
    );
    await appDb.sessions.put(nextSession);
    await appDb.settings.put({
      id: "app",
      restoreBehavior: settings?.restoreBehavior ?? "new_window",
      confirmLargeRestoreThreshold: settings?.confirmLargeRestoreThreshold ?? 20,
      activeWorkspaceId: settings?.activeWorkspaceId,
      activeTaskId: session.taskId,
      activeSessionId: session.id,
    });
  });

  return nextSession;
}

export async function setActiveSession(sessionId: string) {
  return setActiveSessionState(sessionId);
}

async function getWritableSession(input: AttachSessionInput) {
  if (input.sessionId) {
    await setActiveSessionState(input.sessionId);
    const session = await appDb.sessions.get(input.sessionId);
    if (!session || session.taskId !== input.taskId) {
      throw new Error("Session not found.");
    }
    return session;
  }

  const settings = await appDb.settings.get("app");
  const activeSession =
    settings?.activeSessionId ? await appDb.sessions.get(settings.activeSessionId) : undefined;
  if (activeSession?.taskId === input.taskId && ["active", "open"].includes(activeSession.state)) {
    return activeSession.state === "active" ? activeSession : setActiveSessionState(activeSession.id);
  }

  const existing = await appDb.sessions
    .where("taskId")
    .equals(input.taskId)
    .and((session) => session.state === "active" || session.state === "open")
    .first();

  if (existing) {
    return setActiveSessionState(existing.id);
  }

  throw new Error("Create a named session before attaching tabs.");
}

export async function attachTabToTask(taskId: string, tab: chrome.tabs.Tab, sessionId?: string) {
  if (!tab.url || !tab.title) {
    throw new Error("The current tab does not expose enough metadata to attach.");
  }

  const task = await appDb.tasks.get(taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const timestamp = nowIso();
  const existing = await getWritableSession({ taskId, sessionId });
  const existingTab = existing?.tabs.find((item) => item.url === tab.url);
  const nextTab: SessionTab = {
    id: existingTab?.id ?? createId("tab"),
    url: tab.url,
    title: tab.title,
    noteMarkdown: existingTab?.noteMarkdown,
    favIconUrl: tab.favIconUrl,
    pinned: Boolean(tab.pinned),
    windowKey: typeof tab.windowId === "number" ? `window-${tab.windowId}` : "window-current",
    tabIndex: tab.index ?? 0,
    groupId: typeof tab.groupId === "number" && tab.groupId >= 0 ? String(tab.groupId) : undefined,
    capturedAt: timestamp,
  };

  const nextTabs = [
    ...(existing?.tabs.filter((item) => item.url !== nextTab.url) ?? []),
    nextTab,
  ].sort((left, right) => left.tabIndex - right.tabIndex);

  const nextSession: TaskSession = {
    ...existing,
    state: "active",
    tabs: nextTabs,
    trackedWindowId: typeof tab.windowId === "number" ? tab.windowId : existing?.trackedWindowId,
    lastActiveAt: timestamp,
    updatedAt: timestamp,
  };

  await appDb.sessions.put(nextSession);

  return nextSession;
}

export async function attachWindowToTask(taskId: string, tabs: chrome.tabs.Tab[], sessionId?: string) {
  const task = await appDb.tasks.get(taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const visibleTabs = tabs.filter(isTrackableSessionTab);
  if (!visibleTabs.length) {
    throw new Error("No attachable tabs were found in the current window.");
  }

  const timestamp = nowIso();
  const existing = await getWritableSession({ taskId, sessionId });
  const existingTabsByKey = new Map(existing.tabs.map((tab) => [getSessionTabKey(tab), tab]));
  const nextSession: TaskSession = {
    ...existing,
    state: "active",
    tabs: visibleTabs
      .map<SessionTab>((tab) => ({
        id: existingTabsByKey.get(getSessionTabKey(tab))?.id ?? createId("tab"),
        url: tab.url!,
        title: tab.title!,
        noteMarkdown: existingTabsByKey.get(getSessionTabKey(tab))?.noteMarkdown,
        favIconUrl: tab.favIconUrl,
        pinned: Boolean(tab.pinned),
        windowKey: typeof tab.windowId === "number" ? `window-${tab.windowId}` : "window-current",
        tabIndex: tab.index ?? 0,
        groupId: typeof tab.groupId === "number" && tab.groupId >= 0 ? String(tab.groupId) : undefined,
        capturedAt: timestamp,
      }))
      .sort((left, right) => left.tabIndex - right.tabIndex),
    trackedWindowId: visibleTabs[0]?.windowId,
    lastActiveAt: timestamp,
    updatedAt: timestamp,
  };

  await appDb.sessions.put(nextSession);
  return nextSession;
}

export async function removeSessionTab(sessionId: string, tabId: string, closeBrowserTab = false) {
  const existing = await appDb.sessions.get(sessionId);
  if (!existing) {
    throw new Error("Task session not found.");
  }

  const removedTab = existing.tabs.find((tab) => tab.id === tabId);
  const nextTabs = existing.tabs.filter((tab) => tab.id !== tabId);
  await appDb.sessions.put({
    ...existing,
    tabs: nextTabs.map((tab, index) => ({ ...tab, tabIndex: index })),
    trackedWindowId: existing.trackedWindowId,
    updatedAt: nowIso(),
  });

  if (!closeBrowserTab || !removedTab) {
    return;
  }

  const preferredWindowId = parseWindowId(removedTab.windowKey);
  const openTabs = await chrome.tabs.query({
    url: removedTab.url,
  });
  const matchingTab =
    openTabs.find((tab) => tab.windowId === preferredWindowId && tab.title === removedTab.title) ??
    openTabs.find((tab) => tab.windowId === preferredWindowId) ??
    openTabs.find((tab) => tab.title === removedTab.title) ??
    openTabs[0];

  if (typeof matchingTab?.id === "number") {
    await chrome.tabs.remove(matchingTab.id);
  }
}

export async function moveSessionTab(input: MoveSessionTabInput) {
  const source = await appDb.sessions.get(input.sourceSessionId);
  const target = await appDb.sessions.get(input.targetSessionId);
  if (!source || !target) {
    throw new Error("Session not found.");
  }

  const movedTab = source.tabs.find((tab) => tab.id === input.tabId);
  if (!movedTab) {
    throw new Error("Tab not found.");
  }

  const timestamp = nowIso();
  const sourceTabs = source.tabs.filter((tab) => tab.id !== input.tabId);
  const targetTabs = input.sourceSessionId === input.targetSessionId ? sourceTabs : target.tabs.filter((tab) => tab.id !== input.tabId);
  const tabsById = new Map([...targetTabs, movedTab].map((tab) => [tab.id, tab]));
  const orderedTabs = input.orderedTabIds
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .map((id) => tabsById.get(id))
    .filter((tab): tab is SessionTab => Boolean(tab));
  const missingTabs = [...tabsById.values()].filter((tab) => !orderedTabs.some((item) => item.id === tab.id));
  const nextTargetTabs = [...orderedTabs, ...missingTabs].map((tab, index) => ({
    ...tab,
    tabIndex: index,
    capturedAt: tab.id === movedTab.id ? timestamp : tab.capturedAt,
  }));

  await appDb.transaction("rw", [appDb.sessions], async () => {
    if (source.id !== target.id) {
      await appDb.sessions.put({
        ...source,
        tabs: sourceTabs.map((tab, index) => ({ ...tab, tabIndex: index })),
        updatedAt: timestamp,
      });
    }
    await appDb.sessions.put({
      ...target,
      tabs: nextTargetTabs,
      updatedAt: timestamp,
    });
  });
}

export async function attachDraggedTabToSession(input: AttachDraggedTabInput) {
  if (!input.tab.url || !input.tab.title) {
    throw new Error("The dragged tab does not expose enough metadata to attach.");
  }

  const session = await appDb.sessions.get(input.sessionId);
  if (!session || session.taskId !== input.taskId) {
    throw new Error("Session not found.");
  }
  const timestamp = nowIso();
  const tabKey = getSessionTabKey(input.tab);
  const allSessions = await appDb.sessions.toArray();
  const targetSession = allSessions.find((item) => item.id === input.sessionId) ?? session;
  const targetTabsWithoutDuplicate = targetSession.tabs.filter((tab) => getSessionTabKey(tab) !== tabKey);
  const existingTab = targetSession.tabs.find((tab) => getSessionTabKey(tab) === tabKey);
  const nextTab: SessionTab = {
    id: existingTab?.id ?? createId("tab"),
    url: input.tab.url,
    title: input.tab.title,
    noteMarkdown: existingTab?.noteMarkdown,
    favIconUrl: input.tab.favIconUrl,
    pinned: Boolean(input.tab.pinned),
    windowKey: typeof input.tab.windowId === "number" ? `window-${input.tab.windowId}` : "window-current",
    tabIndex: input.tab.index ?? targetTabsWithoutDuplicate.length,
    groupId: typeof input.tab.groupId === "number" && input.tab.groupId >= 0 ? String(input.tab.groupId) : undefined,
    capturedAt: timestamp,
  };
  const tabsById = new Map([...targetTabsWithoutDuplicate, nextTab].map((tab) => [tab.id, tab]));
  const orderedTabIds = input.orderedTabIds ?? insertBeforeId(targetTabsWithoutDuplicate.map((tab) => tab.id), nextTab.id, input.beforeTabId);
  const orderedTabs = orderedTabIds
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .map((id) => tabsById.get(id))
    .filter((tab): tab is SessionTab => Boolean(tab));
  const missingTabs = [...tabsById.values()].filter((tab) => !orderedTabs.some((item) => item.id === tab.id));

  const nextTarget = {
    ...targetSession,
    tabs: [...orderedTabs, ...missingTabs].map((tab, index) => ({ ...tab, tabIndex: index })),
    trackedWindowId: undefined,
    updatedAt: timestamp,
  };

  await appDb.transaction("rw", [appDb.sessions], async () => {
    await Promise.all(
      allSessions.map((item) => {
        if (item.id === nextTarget.id) {
          return appDb.sessions.put(nextTarget);
        }
        const nextTabs = item.tabs.filter((tab) => getSessionTabKey(tab) !== tabKey);
        if (nextTabs.length === item.tabs.length) {
          return Promise.resolve();
        }
        return appDb.sessions.put({
          ...item,
          tabs: nextTabs.map((tab, index) => ({ ...tab, tabIndex: index })),
          updatedAt: timestamp,
        });
      }),
    );
  });
}

export async function createTaskSession(taskId: string, title?: string) {
  const task = await appDb.tasks.get(taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const settings = await appDb.settings.get("app");
  const existingSessions = await appDb.sessions.where("taskId").equals(taskId).toArray();
  const sessionTitle = title?.trim();
  if (!sessionTitle) {
    throw new Error("Session name is required.");
  }
  if (/^(active|open|closed|archived) session$/i.test(sessionTitle)) {
    throw new Error("Use a unique session name instead of a session state.");
  }
  if (existingSessions.some((session) => session.title?.trim().toLowerCase() === sessionTitle.toLowerCase())) {
    throw new Error("Session names must be unique within a task.");
  }
  const timestamp = nowIso();
  const nextSession: TaskSession = {
    id: createId("session"),
    taskId,
    title: sessionTitle,
    state: "active",
    tabs: [],
    createdAt: timestamp,
    lastActiveAt: timestamp,
    updatedAt: timestamp,
  };
  const activeSessions = await appDb.sessions.where("state").equals("active").toArray();

  await appDb.transaction("rw", [appDb.sessions, appDb.settings], async () => {
    await Promise.all(
      activeSessions.map((session) =>
        appDb.sessions.put({
          ...session,
          state: "open",
          updatedAt: timestamp,
        }),
      ),
    );
    await appDb.sessions.put(nextSession);
    await appDb.settings.put({
      id: "app",
      restoreBehavior: settings?.restoreBehavior ?? "new_window",
      confirmLargeRestoreThreshold: settings?.confirmLargeRestoreThreshold ?? 20,
      activeWorkspaceId: settings?.activeWorkspaceId,
      activeTaskId: taskId,
      activeSessionId: nextSession.id,
    });
  });

  return nextSession;
}

export async function createCheckpoint(input: CreateCheckpointInput) {
  const task = await appDb.tasks.get(input.taskId);
  if (!task) {
    throw new Error("Task not found.");
  }

  const session = input.sessionId
    ? await appDb.sessions.get(input.sessionId)
    : await getWritableSession({ taskId: input.taskId });
  if (session?.taskId !== input.taskId) {
    throw new Error("Session not found.");
  }
  const previousCheckpoint = (await appDb.checkpoints.where("taskId").equals(input.taskId).toArray())
    .filter((checkpoint) => checkpoint.sessionId === session.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const createdAt = nowIso();
  const checkpoint = {
    id: createId("checkpoint"),
    taskId: input.taskId,
    sessionId: session.id,
    title: input.title?.trim() || undefined,
    noteMarkdown: input.noteMarkdown?.trim() || session.noteMarkdown || task.noteMarkdown || undefined,
    sessionTabs: session.tabs.map((tab) => ({
      ...tab,
    })),
    createdAt,
    basedOnCheckpointId: previousCheckpoint?.id,
  };

  await appDb.checkpoints.add(checkpoint);
  return checkpoint;
}

export async function archiveTaskSession(input: CreateCheckpointInput) {
  const checkpoint = await createCheckpoint(input);
  const session = input.sessionId ? await appDb.sessions.get(input.sessionId) : undefined;
  if (session) {
    await appDb.sessions.put({
      ...session,
      state: "closed",
      closedAt: checkpoint.createdAt,
      checkpointId: checkpoint.id,
      updatedAt: checkpoint.createdAt,
    });
  }
  return checkpoint;
}

export async function deleteTaskSession(input: DeleteTaskSessionInput) {
  const session = await appDb.sessions.get(input.sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }
  const settings = await appDb.settings.get("app");
  await appDb.transaction("rw", [appDb.sessions, appDb.checkpoints, appDb.settings], async () => {
    await appDb.sessions.delete(input.sessionId);
    if (session.checkpointId) {
      await appDb.checkpoints.delete(session.checkpointId);
    }
    if (settings?.activeSessionId === input.sessionId) {
      await appDb.settings.put({
        ...settings,
        activeSessionId: undefined,
        activeTaskId: settings.activeTaskId === session.taskId ? undefined : settings.activeTaskId,
      });
    }
  });
}

export async function updateTaskSessionState(input: UpdateTaskSessionStateInput) {
  const session = await appDb.sessions.get(input.sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }
  const timestamp = nowIso();
  await appDb.sessions.put({
    ...session,
    state: input.state,
    archivedAt: input.state === "archived" ? timestamp : undefined,
    updatedAt: timestamp,
  });
}

export async function updateTaskSession(input: UpdateTaskSessionInput) {
  const session = await appDb.sessions.get(input.id);
  if (!session) {
    throw new Error("Session not found.");
  }

  await appDb.sessions.put({
    ...session,
    title: input.title?.trim() || session.title,
    description: input.description?.trim() || undefined,
    noteMarkdown: input.noteMarkdown ?? session.noteMarkdown,
    updatedAt: nowIso(),
  });
}

export async function restoreTaskSession(sessionId: string) {
  const session = await appDb.sessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }
  if (!session.tabs.length) {
    await setActiveSessionState(sessionId);
    return session;
  }

  const [firstTab, ...remainingTabs] = session.tabs;
  const createdWindow = await chrome.windows.create({ url: firstTab.url });
  const firstCreatedTabId = createdWindow.tabs?.[0]?.id;
  if (typeof firstCreatedTabId === "number" && firstTab.pinned) {
    await chrome.tabs.update(firstCreatedTabId, { pinned: true });
  }
  for (const tab of remainingTabs) {
    await chrome.tabs.create({
      windowId: createdWindow.id,
      url: tab.url,
      pinned: tab.pinned,
    });
  }

  const timestamp = nowIso();
  await appDb.sessions.put({
    ...session,
    state: "active",
    archivedAt: undefined,
    trackedWindowId: createdWindow.id,
    tabs: session.tabs.map((tab, index) => ({
      ...tab,
      tabIndex: index,
      windowKey: typeof createdWindow.id === "number" ? `window-${createdWindow.id}` : tab.windowKey,
      capturedAt: timestamp,
    })),
    lastActiveAt: timestamp,
    updatedAt: timestamp,
  });
  await setActiveSessionState(sessionId);
  return session;
}

export async function restoreCheckpoint(checkpointId: string) {
  const checkpoint = await appDb.checkpoints.get(checkpointId);
  if (!checkpoint) {
    throw new Error("Checkpoint not found.");
  }

  const task = await appDb.tasks.get(checkpoint.taskId);
  if (!task) {
    throw new Error("Task for checkpoint not found.");
  }

  const [firstTab, ...remainingTabs] = checkpoint.sessionTabs;
  if (!firstTab) {
    throw new Error("Checkpoint does not contain any tabs to restore.");
  }

  const createdWindow = await chrome.windows.create({
    url: firstTab.url,
  });

  const firstCreatedTabId = createdWindow.tabs?.[0]?.id;
  if (typeof firstCreatedTabId === "number" && firstTab.pinned) {
    await chrome.tabs.update(firstCreatedTabId, { pinned: true });
  }

  for (const tab of remainingTabs) {
    await chrome.tabs.create({
      windowId: createdWindow.id,
      url: tab.url,
      pinned: tab.pinned,
    });
  }

  const restoredTabs: SessionTab[] = checkpoint.sessionTabs.map((tab, index) => ({
    ...tab,
    tabIndex: index,
    capturedAt: nowIso(),
  }));

  const restoredSession: TaskSession = {
    id: createId("session"),
    taskId: checkpoint.taskId,
    title: checkpoint.title,
    state: "active",
    tabs: restoredTabs,
    trackedWindowId: createdWindow.id,
    createdAt: nowIso(),
    lastActiveAt: nowIso(),
    updatedAt: nowIso(),
    checkpointId: checkpoint.id,
  };
  const activeSessions = await appDb.sessions.where("state").equals("active").toArray();

  await appDb.transaction("rw", [appDb.sessions, appDb.tasks, appDb.settings], async () => {
    await Promise.all(
      activeSessions.map((session) =>
        appDb.sessions.put({
          ...session,
          state: "open",
          updatedAt: nowIso(),
        }),
      ),
    );
    await appDb.sessions.put(restoredSession);

    await appDb.tasks.put({
      ...task,
      noteMarkdown: checkpoint.noteMarkdown ?? task.noteMarkdown,
      updatedAt: nowIso(),
    });

    const settings = await appDb.settings.get("app");
    await appDb.settings.put({
      id: "app",
      restoreBehavior: settings?.restoreBehavior ?? "new_window",
      confirmLargeRestoreThreshold: settings?.confirmLargeRestoreThreshold ?? 20,
      activeWorkspaceId: settings?.activeWorkspaceId,
      activeTaskId: checkpoint.taskId,
      activeSessionId: restoredSession.id,
    });
  });

  return checkpoint;
}

export async function updateProjectNote(projectId: string, noteMarkdown: string) {
  const existing = await appDb.projects.get(projectId);
  if (!existing) {
    throw new Error("Project not found.");
  }

  await appDb.projects.put({
    ...existing,
    noteMarkdown,
    updatedAt: nowIso(),
  });
}

export async function updateWorkspaceNote(workspaceId: string, noteMarkdown: string) {
  const existing = await appDb.workspaces.get(workspaceId);
  if (!existing) {
    throw new Error("Workspace not found.");
  }

  await appDb.workspaces.put({
    ...existing,
    noteMarkdown,
    updatedAt: nowIso(),
  });
}

export async function updateTaskNote(taskId: string, noteMarkdown: string) {
  const existing = await appDb.tasks.get(taskId);
  if (!existing) {
    throw new Error("Task not found.");
  }

  await appDb.tasks.put({
    ...existing,
    noteMarkdown,
    updatedAt: nowIso(),
  });
}

export async function updateSessionTabNote(input: UpdateSessionTabNoteInput) {
  const existing = await appDb.sessions.get(input.sessionId);
  if (!existing) {
    throw new Error("Session not found.");
  }

  let foundTab = false;
  const nextTabs = existing.tabs.map((tab) => {
    if (tab.id !== input.tabId) {
      return tab;
    }

    foundTab = true;
    return {
      ...tab,
      noteMarkdown: input.noteMarkdown,
    };
  });

  if (!foundTab) {
    throw new Error("Tab not found.");
  }

  await appDb.sessions.put({
    ...existing,
    tabs: nextTabs,
    updatedAt: nowIso(),
  });
}

export async function getLatestTaskSession(taskId: string) {
  const sessions = await appDb.sessions.where("taskId").equals(taskId).toArray();
  return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

export async function syncTrackedWindowSession(windowId: number) {
  const sessions = await appDb.sessions.toArray();
  const targetSessions = sessions.filter(
    (session) => session.trackedWindowId === windowId && (session.state === "active" || session.state === "open"),
  );

  if (!targetSessions.length) {
    return false;
  }

  const windowTabs = await chrome.tabs.query({ windowId });
  const trackableTabs = windowTabs.filter(isTrackableSessionTab);
  const updatedAt = nowIso();

  await Promise.all(
    targetSessions.map((session) => {
      const existingTabsByKey = new Map(session.tabs.map((tab) => [getSessionTabKey(tab), tab]));
      return appDb.sessions.put({
        ...session,
        trackedWindowId: windowId,
        tabs: trackableTabs
          .map<SessionTab>((tab) => {
            const existingTab = existingTabsByKey.get(getSessionTabKey(tab));
            return {
              id: existingTab?.id ?? createId("tab"),
              url: tab.url!,
              title: tab.title!,
              noteMarkdown: existingTab?.noteMarkdown,
              favIconUrl: tab.favIconUrl,
              pinned: Boolean(tab.pinned),
              windowKey: `window-${windowId}`,
              tabIndex: tab.index ?? 0,
              groupId: typeof tab.groupId === "number" && tab.groupId >= 0 ? String(tab.groupId) : undefined,
              capturedAt: updatedAt,
            };
          })
          .sort((left, right) => left.tabIndex - right.tabIndex),
        updatedAt,
      });
    }),
  );

  const activeTab = windowTabs.find((tab) => tab.active);
  const activeSession =
    activeTab &&
    targetSessions.find((session) =>
      session.tabs.some((tab) => tab.url === activeTab.url && tab.title === activeTab.title),
    );
  if (activeSession) {
    await setActiveSessionState(activeSession.id);
  }

  return true;
}

export async function getActiveTask() {
  const settings = await appDb.settings.get("app");

  if (!settings?.activeTaskId) {
    return undefined;
  }

  return appDb.tasks.get(settings.activeTaskId);
}

function matchesQuery(values: Array<string | undefined>, query: string) {
  return values.some((value) => value?.toLowerCase().includes(query));
}

function isTrackableSessionTab(tab: chrome.tabs.Tab) {
  if (!tab.url || !tab.title) {
    return false;
  }

  return !tab.url.startsWith(chrome.runtime.getURL(""));
}

function parseWindowId(windowKey: string) {
  const prefix = "window-";
  if (!windowKey.startsWith(prefix)) {
    return undefined;
  }

  const parsed = Number(windowKey.slice(prefix.length));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function projectHasTasks(project: WorkspaceProjectSummary) {
  return project.tasks.length > 0;
}

export function sortProjects(projects: WorkspaceProjectSummary[]) {
  return [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function sortTasks(tasks: WorkspaceTaskSummary[]) {
  return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
