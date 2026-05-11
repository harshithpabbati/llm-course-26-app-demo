import type { ProjectStatus, TaskStatus, TaskSession } from "../../domain/models";
import type { BootstrapSnapshot } from "../../domain/services/bootstrap-service";
import type { WorkspaceSnapshot } from "../../domain/services/workspace-service";

export enum MessageType {
  PING = "PING",
  GET_BOOTSTRAP = "GET_BOOTSTRAP",
  GET_WORKSPACE = "GET_WORKSPACE",
  CREATE_WORKSPACE = "CREATE_WORKSPACE",
  UPDATE_WORKSPACE = "UPDATE_WORKSPACE",
  DELETE_WORKSPACE = "DELETE_WORKSPACE",
  SET_ACTIVE_WORKSPACE = "SET_ACTIVE_WORKSPACE",
  CREATE_PROJECT = "CREATE_PROJECT",
  UPDATE_PROJECT = "UPDATE_PROJECT",
  DELETE_PROJECT = "DELETE_PROJECT",
  CREATE_TASK = "CREATE_TASK",
  UPDATE_TASK = "UPDATE_TASK",
  DELETE_TASK = "DELETE_TASK",
  SET_ACTIVE_TASK = "SET_ACTIVE_TASK",
  UPDATE_WORKSPACE_NOTE = "UPDATE_WORKSPACE_NOTE",
  UPDATE_PROJECT_NOTE = "UPDATE_PROJECT_NOTE",
  UPDATE_TASK_NOTE = "UPDATE_TASK_NOTE",
  UPDATE_SESSION_TAB_NOTE = "UPDATE_SESSION_TAB_NOTE",
  ATTACH_CURRENT_TAB = "ATTACH_CURRENT_TAB",
  ATTACH_CURRENT_WINDOW = "ATTACH_CURRENT_WINDOW",
  REMOVE_SESSION_TAB = "REMOVE_SESSION_TAB",
  REORDER_PROJECTS = "REORDER_PROJECTS",
  REORDER_TASKS = "REORDER_TASKS",
  MOVE_SESSION_TAB = "MOVE_SESSION_TAB",
  ATTACH_DRAGGED_TAB_TO_SESSION = "ATTACH_DRAGGED_TAB_TO_SESSION",
  CREATE_TASK_SESSION = "CREATE_TASK_SESSION",
  SET_ACTIVE_SESSION = "SET_ACTIVE_SESSION",
  ARCHIVE_TASK_SESSION = "ARCHIVE_TASK_SESSION",
  UPDATE_TASK_SESSION_STATE = "UPDATE_TASK_SESSION_STATE",
  UPDATE_TASK_SESSION = "UPDATE_TASK_SESSION",
  DELETE_TASK_SESSION = "DELETE_TASK_SESSION",
  RESTORE_TASK_SESSION = "RESTORE_TASK_SESSION",
  CREATE_CHECKPOINT = "CREATE_CHECKPOINT",
  RESTORE_CHECKPOINT = "RESTORE_CHECKPOINT",
  OPEN_WORKSPACE = "OPEN_WORKSPACE",
}

export type AppMessage =
  | { type: MessageType.PING }
  | { type: MessageType.GET_BOOTSTRAP }
  | { type: MessageType.GET_WORKSPACE; query?: string }
  | { type: MessageType.CREATE_WORKSPACE; input: { title: string; description?: string; noteMarkdown?: string } }
  | {
      type: MessageType.UPDATE_WORKSPACE;
      input: { id: string; title: string; description?: string; noteMarkdown?: string; archivedAt?: string | null };
    }
  | { type: MessageType.DELETE_WORKSPACE; workspaceId: string }
  | { type: MessageType.SET_ACTIVE_WORKSPACE; workspaceId: string }
  | { type: MessageType.CREATE_PROJECT; input: { title: string; workspaceId?: string; status?: ProjectStatus; description?: string; noteMarkdown?: string } }
  | {
      type: MessageType.UPDATE_PROJECT;
      input: { id: string; title: string; status?: ProjectStatus; description?: string; noteMarkdown?: string };
    }
  | { type: MessageType.DELETE_PROJECT; projectId: string }
  | {
      type: MessageType.CREATE_TASK;
      input: { projectId: string; title: string; description?: string; status?: TaskStatus; noteMarkdown?: string };
    }
  | {
      type: MessageType.UPDATE_TASK;
      input: { id: string; title: string; description?: string; status: TaskStatus; noteMarkdown?: string };
    }
  | { type: MessageType.DELETE_TASK; taskId: string }
  | { type: MessageType.SET_ACTIVE_TASK; taskId: string }
  | { type: MessageType.UPDATE_WORKSPACE_NOTE; workspaceId: string; noteMarkdown: string }
  | { type: MessageType.UPDATE_PROJECT_NOTE; projectId: string; noteMarkdown: string }
  | { type: MessageType.UPDATE_TASK_NOTE; taskId: string; noteMarkdown: string }
  | { type: MessageType.UPDATE_SESSION_TAB_NOTE; input: { sessionId: string; tabId: string; noteMarkdown: string } }
  | { type: MessageType.ATTACH_CURRENT_TAB; taskId?: string; sessionId?: string }
  | { type: MessageType.ATTACH_CURRENT_WINDOW; taskId?: string; sessionId?: string }
  | { type: MessageType.REMOVE_SESSION_TAB; sessionId: string; tabId: string; closeBrowserTab?: boolean }
  | { type: MessageType.REORDER_PROJECTS; input: { projectId: string; status: ProjectStatus; orderedProjectIds: string[] } }
  | { type: MessageType.REORDER_TASKS; input: { taskId: string; status: TaskStatus; orderedTaskIds: string[] } }
  | { type: MessageType.MOVE_SESSION_TAB; input: { sourceSessionId: string; targetSessionId: string; tabId: string; orderedTabIds: string[] } }
  | {
      type: MessageType.ATTACH_DRAGGED_TAB_TO_SESSION;
      input: {
        taskId: string;
        sessionId: string;
        tab: Pick<chrome.tabs.Tab, "id" | "url" | "title" | "favIconUrl" | "pinned" | "windowId" | "index" | "groupId">;
        orderedTabIds?: string[];
        beforeTabId?: string;
      };
    }
  | { type: MessageType.CREATE_TASK_SESSION; taskId: string; title?: string }
  | { type: MessageType.SET_ACTIVE_SESSION; sessionId: string }
  | { type: MessageType.ARCHIVE_TASK_SESSION; input: { taskId: string; sessionId?: string; title?: string; noteMarkdown?: string } }
  | { type: MessageType.UPDATE_TASK_SESSION_STATE; input: { sessionId: string; state: "open" | "closed" | "archived" } }
  | { type: MessageType.UPDATE_TASK_SESSION; input: { id: string; title?: string; description?: string; noteMarkdown?: string } }
  | { type: MessageType.DELETE_TASK_SESSION; input: { sessionId: string } }
  | { type: MessageType.RESTORE_TASK_SESSION; sessionId: string }
  | { type: MessageType.CREATE_CHECKPOINT; input: { taskId: string; sessionId?: string; title?: string; noteMarkdown?: string } }
  | { type: MessageType.RESTORE_CHECKPOINT; checkpointId: string }
  | { type: MessageType.OPEN_WORKSPACE };

export type MessageSuccess<T> = {
  ok: true;
  data: T;
};

export type MessageFailure = {
  ok: false;
  error: string;
};

export type AppMessageResponse =
  | MessageSuccess<{ status: "ready" }>
  | MessageSuccess<BootstrapSnapshot>
  | MessageSuccess<WorkspaceSnapshot>
  | MessageSuccess<TaskSession>
  | MessageSuccess<{ opened: true }>
  | MessageFailure;

export type BootstrapResponse = BootstrapSnapshot;
export type WorkspaceResponse = WorkspaceSnapshot;

export const WORKSPACE_MUTATED_EVENT = "WORKSPACE_MUTATED";
