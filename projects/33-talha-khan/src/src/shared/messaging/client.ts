import type { ProjectStatus, TaskSession, TaskStatus } from "../../domain/models";
import type { WorkspaceResponse } from "./types";
import { MessageType, type AppMessage, type AppMessageResponse, type BootstrapResponse } from "./types";

async function sendMessage<TSuccess>(message: AppMessage): Promise<TSuccess> {
  const response = (await chrome.runtime.sendMessage(message)) as AppMessageResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.data as TSuccess;
}

export function pingBackground() {
  return sendMessage<{ status: "ready" }>({ type: MessageType.PING });
}

export function requestBootstrap() {
  return sendMessage<BootstrapResponse>({ type: MessageType.GET_BOOTSTRAP });
}

export function requestWorkspace(query?: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.GET_WORKSPACE, query });
}

export function openWorkspace() {
  return sendMessage<{ opened: true }>({ type: MessageType.OPEN_WORKSPACE });
}

export function createWorkspace(input: { title: string; description?: string; noteMarkdown?: string }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.CREATE_WORKSPACE, input });
}

export function updateWorkspace(input: {
  id: string;
  title: string;
  description?: string;
  noteMarkdown?: string;
  archivedAt?: string | null;
}) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.UPDATE_WORKSPACE, input });
}

export function deleteWorkspace(workspaceId: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.DELETE_WORKSPACE, workspaceId });
}

export function setActiveWorkspace(workspaceId: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.SET_ACTIVE_WORKSPACE, workspaceId });
}

export function createProject(input: { title: string; workspaceId?: string; status?: ProjectStatus; description?: string; noteMarkdown?: string }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.CREATE_PROJECT, input });
}

export function updateProject(input: { id: string; title: string; status?: ProjectStatus; description?: string; noteMarkdown?: string }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.UPDATE_PROJECT, input });
}

export function deleteProject(projectId: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.DELETE_PROJECT, projectId });
}

export function createTask(input: {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  noteMarkdown?: string;
}) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.CREATE_TASK, input });
}

export function updateTask(input: {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  noteMarkdown?: string;
}) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.UPDATE_TASK, input });
}

export function deleteTask(taskId: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.DELETE_TASK, taskId });
}

export function setActiveTask(taskId: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.SET_ACTIVE_TASK, taskId });
}

export function updateWorkspaceNote(workspaceId: string, noteMarkdown: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.UPDATE_WORKSPACE_NOTE, workspaceId, noteMarkdown });
}

export function updateProjectNote(projectId: string, noteMarkdown: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.UPDATE_PROJECT_NOTE, projectId, noteMarkdown });
}

export function updateTaskNote(taskId: string, noteMarkdown: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.UPDATE_TASK_NOTE, taskId, noteMarkdown });
}

export function attachCurrentTab(taskId?: string, sessionId?: string) {
  return sendMessage<TaskSession>({ type: MessageType.ATTACH_CURRENT_TAB, taskId, sessionId });
}

export function attachCurrentWindow(taskId?: string, sessionId?: string) {
  return sendMessage<TaskSession>({ type: MessageType.ATTACH_CURRENT_WINDOW, taskId, sessionId });
}

export function removeSessionTab(sessionId: string, tabId: string, closeBrowserTab = false) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.REMOVE_SESSION_TAB, sessionId, tabId, closeBrowserTab });
}

export function reorderProjects(input: { projectId: string; status: ProjectStatus; orderedProjectIds: string[] }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.REORDER_PROJECTS, input });
}

export function reorderTasks(input: { taskId: string; status: TaskStatus; orderedTaskIds: string[] }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.REORDER_TASKS, input });
}

export function moveSessionTab(input: { sourceSessionId: string; targetSessionId: string; tabId: string; orderedTabIds: string[] }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.MOVE_SESSION_TAB, input });
}

export function attachDraggedTabToSession(input: {
  taskId: string;
  sessionId: string;
  tab: Pick<chrome.tabs.Tab, "id" | "url" | "title" | "favIconUrl" | "pinned" | "windowId" | "index" | "groupId">;
  orderedTabIds?: string[];
  beforeTabId?: string;
}) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.ATTACH_DRAGGED_TAB_TO_SESSION, input });
}

export function createTaskSession(taskId: string, title?: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.CREATE_TASK_SESSION, taskId, title });
}

export function setActiveSession(sessionId: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.SET_ACTIVE_SESSION, sessionId });
}

export function archiveTaskSession(input: { taskId: string; sessionId?: string; title?: string; noteMarkdown?: string }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.ARCHIVE_TASK_SESSION, input });
}

export function updateTaskSessionState(input: { sessionId: string; state: "open" | "closed" | "archived" }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.UPDATE_TASK_SESSION_STATE, input });
}

export function updateTaskSession(input: { id: string; title?: string; description?: string; noteMarkdown?: string }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.UPDATE_TASK_SESSION, input });
}

export function deleteTaskSession(input: { sessionId: string }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.DELETE_TASK_SESSION, input });
}

export function restoreTaskSession(sessionId: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.RESTORE_TASK_SESSION, sessionId });
}

export function createCheckpoint(input: { taskId: string; sessionId?: string; title?: string; noteMarkdown?: string }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.CREATE_CHECKPOINT, input });
}

export function restoreCheckpoint(checkpointId: string) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.RESTORE_CHECKPOINT, checkpointId });
}

export function updateSessionTabNote(input: { sessionId: string; tabId: string; noteMarkdown: string }) {
  return sendMessage<WorkspaceResponse>({ type: MessageType.UPDATE_SESSION_TAB_NOTE, input });
}
