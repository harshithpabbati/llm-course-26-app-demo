import { appDb } from "../db/schema";
import { ensureDefaultSettings, getBootstrapSnapshot } from "../domain/services/bootstrap-service";
import {
  attachTabToTask,
  attachWindowToTask,
  attachDraggedTabToSession,
  archiveTaskSession,
  createCheckpoint,
  createProject,
  createWorkspace,
  createTask,
  createTaskSession,
  deleteTaskSession,
  deleteWorkspace,
  deleteProject,
  deleteTask,
  getActiveTask,
  getWorkspaceSnapshot,
  removeSessionTab,
  reorderProjects,
  reorderTasks,
  moveSessionTab,
  restoreTaskSession,
  restoreCheckpoint,
  setActiveWorkspace,
  setActiveSession,
  setActiveTask,
  updateWorkspaceNote,
  updateWorkspace,
  syncTrackedWindowSession,
  updateTaskSession,
  updateTaskSessionState,
  updateSessionTabNote,
  updateProjectNote,
  updateProject,
  updateTaskNote,
  updateTask,
} from "../domain/services/workspace-service";
import {
  MessageType,
  WORKSPACE_MUTATED_EVENT,
  type AppMessage,
  type AppMessageResponse,
} from "../shared/messaging/types";

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaultSettings();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaultSettings();
});

chrome.runtime.onMessage.addListener((message: AppMessage, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((cause) =>
      sendResponse({
        ok: false,
        error: cause instanceof Error ? cause.message : "Unknown background error.",
      }),
    );

  return true;
});

chrome.tabs.onCreated.addListener((tab) => {
  if (typeof tab.windowId === "number") {
    void syncWindowAndBroadcast(tab.windowId);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && !changeInfo.title && changeInfo.status !== "complete") {
    return;
  }

  if (typeof tab.windowId === "number") {
    void syncWindowAndBroadcast(tab.windowId);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (typeof removeInfo.windowId === "number") {
    void syncWindowAndBroadcast(removeInfo.windowId);
  }
});

chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
  void syncWindowAndBroadcast(attachInfo.newWindowId);
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
  void syncWindowAndBroadcast(detachInfo.oldWindowId);
});

async function handleMessage(
  message: AppMessage,
  sender: chrome.runtime.MessageSender,
): Promise<AppMessageResponse> {
  switch (message.type) {
    case MessageType.PING:
      return { ok: true, data: { status: "ready" } };

    case MessageType.GET_BOOTSTRAP:
      return {
        ok: true,
        data: await getBootstrapSnapshot(),
      };

    case MessageType.GET_WORKSPACE:
      return {
        ok: true,
        data: await getWorkspaceSnapshot(message.query),
      };

    case MessageType.CREATE_WORKSPACE:
      await createWorkspace(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.UPDATE_WORKSPACE:
      await updateWorkspace(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.DELETE_WORKSPACE:
      await deleteWorkspace(message.workspaceId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.SET_ACTIVE_WORKSPACE:
      await setActiveWorkspace(message.workspaceId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.CREATE_PROJECT:
      await createProject(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.UPDATE_PROJECT:
      await updateProject(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.DELETE_PROJECT:
      await deleteProject(message.projectId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.CREATE_TASK:
      await createTask(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.UPDATE_TASK:
      await updateTask(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.DELETE_TASK:
      await deleteTask(message.taskId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.SET_ACTIVE_TASK:
      await setActiveTask(message.taskId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.UPDATE_WORKSPACE_NOTE:
      await updateWorkspaceNote(message.workspaceId, message.noteMarkdown);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.UPDATE_PROJECT_NOTE:
      await updateProjectNote(message.projectId, message.noteMarkdown);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.UPDATE_TASK_NOTE:
      await updateTaskNote(message.taskId, message.noteMarkdown);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.UPDATE_SESSION_TAB_NOTE:
      await updateSessionTabNote(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.ATTACH_CURRENT_TAB: {
      const activeTab = await getLastFocusedActiveTab();

      if (!activeTab) {
        throw new Error("No active browser tab was available to attach.");
      }

      const resolvedTaskId = message.taskId ?? (await getActiveTask())?.id;
      if (!resolvedTaskId) {
        throw new Error("Set an active task before attaching the current tab.");
      }

      const data = await attachTabToTask(resolvedTaskId, activeTab, message.sessionId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data,
      };
    }

    case MessageType.ATTACH_CURRENT_WINDOW: {
      const activeTabs = await getLastFocusedWindowTabs();
      const resolvedTaskId = message.taskId ?? (await getActiveTask())?.id;

      if (!resolvedTaskId) {
        throw new Error("Set an active task before attaching the current window.");
      }

      const data = await attachWindowToTask(resolvedTaskId, activeTabs, message.sessionId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data,
      };
    }

    case MessageType.REMOVE_SESSION_TAB:
      await removeSessionTab(message.sessionId, message.tabId, Boolean(message.closeBrowserTab));
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.REORDER_PROJECTS:
      await reorderProjects(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.REORDER_TASKS:
      await reorderTasks(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.MOVE_SESSION_TAB:
      await moveSessionTab(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.ATTACH_DRAGGED_TAB_TO_SESSION:
      await attachDraggedTabToSession(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.CREATE_TASK_SESSION:
      await createTaskSession(message.taskId, message.title);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.SET_ACTIVE_SESSION:
      await setActiveSession(message.sessionId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.ARCHIVE_TASK_SESSION:
      await archiveTaskSession(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.UPDATE_TASK_SESSION_STATE:
      await updateTaskSessionState(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.UPDATE_TASK_SESSION:
      await updateTaskSession(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.RESTORE_TASK_SESSION:
      await restoreTaskSession(message.sessionId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.DELETE_TASK_SESSION:
      await deleteTaskSession(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.CREATE_CHECKPOINT:
      await createCheckpoint(message.input);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.RESTORE_CHECKPOINT:
      await restoreCheckpoint(message.checkpointId);
      await broadcastWorkspaceMutated();
      return {
        ok: true,
        data: await getWorkspaceSnapshot(),
      };

    case MessageType.OPEN_WORKSPACE:
      await chrome.tabs.create({
        url: chrome.runtime.getURL("src/options/index.html"),
      });
      return { ok: true, data: { opened: true } };

    default:
      return { ok: false, error: "Unsupported message type." };
  }
}

async function getLastFocusedActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  return tabs[0];
}

async function getLastFocusedWindowTabs() {
  return chrome.tabs.query({
    lastFocusedWindow: true,
  });
}

async function broadcastWorkspaceMutated() {
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: WORKSPACE_MUTATED_EVENT,
      },
      () => {
        void chrome.runtime.lastError;
        resolve();
      },
    );
  });
}

async function syncWindowAndBroadcast(windowId: number) {
  const didUpdate = await syncTrackedWindowSession(windowId);
  if (didUpdate) {
    await broadcastWorkspaceMutated();
  }
}

void appDb.open();
