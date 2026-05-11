import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from "react";

import type { ProjectStatus, SessionState, SessionTab, TaskStatus } from "../domain/models";
import type { WorkspaceCheckpointSummary, WorkspaceProjectSummary, WorkspaceTaskSummary } from "../domain/services/workspace-service";
import {
  attachCurrentTab,
  attachCurrentWindow,
  attachDraggedTabToSession,
  archiveTaskSession,
  createCheckpoint,
  createProject,
  createTaskSession,
  createWorkspace,
  createTask,
  deleteProject,
  deleteTaskSession,
  deleteWorkspace,
  deleteTask,
  removeSessionTab,
  reorderProjects,
  reorderTasks,
  moveSessionTab,
  requestWorkspace,
  restoreCheckpoint,
  restoreTaskSession,
  setActiveWorkspace,
  setActiveSession,
  setActiveTask,
  updateWorkspace,
  updateWorkspaceNote,
  updateProject,
  updateProjectNote,
  updateTask,
  updateTaskSession,
  updateTaskSessionState,
  updateTaskNote,
  updateSessionTabNote,
} from "../shared/messaging/client";
import { WORKSPACE_MUTATED_EVENT, type WorkspaceResponse } from "../shared/messaging/types";

type WorkspaceHomeProps = {
  onOpenWorkspace?: () => void;
  variant: "sidepanel" | "workspace";
};

type ProjectFormState = {
  title: string;
  description: string;
};

type WorkspaceFormState = {
  title: string;
  description: string;
};

type TaskFormState = {
  title: string;
  description: string;
  status: TaskStatus;
};

type WorkspaceView = "workspace" | "project" | "task" | "session";

type ColumnCreateTarget =
  | { kind: "project"; status: Extract<ProjectStatus, "backlog" | "active"> }
  | { kind: "task"; status: Extract<TaskStatus, "todo" | "in_progress"> };

type DragPayload =
  | { type: "project"; id: string }
  | { type: "task"; id: string }
  | { type: "session-tab"; sessionId: string; tabId: string }
  | {
      type: "browser-tab";
      tab: Pick<chrome.tabs.Tab, "id" | "url" | "title" | "favIconUrl" | "pinned" | "windowId" | "index" | "groupId">;
    };

type BrowserWindowSummary = {
  id: number;
  focused: boolean;
  tabs: chrome.tabs.Tab[];
};

const EMPTY_PROJECT_FORM: ProjectFormState = {
  title: "",
  description: "",
};

const EMPTY_WORKSPACE_FORM: WorkspaceFormState = {
  title: "",
  description: "",
};

const EMPTY_TASK_FORM: TaskFormState = {
  title: "",
  description: "",
  status: "todo",
};

export function WorkspaceHome({ onOpenWorkspace, variant }: WorkspaceHomeProps) {
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>("project");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [checkpointNameOpen, setCheckpointNameOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [columnCreateTarget, setColumnCreateTarget] = useState<ColumnCreateTarget | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [taskDraft, setTaskDraft] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [checkpointTitle, setCheckpointTitle] = useState("");
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [workspaceNoteDraft, setWorkspaceNoteDraft] = useState("");
  const [projectNoteDraft, setProjectNoteDraft] = useState("");
  const [taskNoteDraft, setTaskNoteDraft] = useState("");
  const [sessionNoteDraft, setSessionNoteDraft] = useState("");
  const [workspaceNoteTargetId, setWorkspaceNoteTargetId] = useState<string | null>(null);
  const [projectNoteTargetId, setProjectNoteTargetId] = useState<string | null>(null);
  const [taskNoteTargetId, setTaskNoteTargetId] = useState<string | null>(null);
  const [sessionNoteTargetId, setSessionNoteTargetId] = useState<string | null>(null);
  const [workspaceNoteState, setWorkspaceNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [projectNoteState, setProjectNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [taskNoteState, setTaskNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sessionNoteState, setSessionNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selectedSessionTab, setSelectedSessionTab] = useState<{ source: "checkpoint" | "current"; tabId: string } | null>(null);
  const [sessionTabNoteDraft, setSessionTabNoteDraft] = useState("");
  const [sessionTabNoteTarget, setSessionTabNoteTarget] = useState<{ sessionId: string; tabId: string } | null>(null);
  const [sessionTabNoteState, setSessionTabNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceDescriptionId, setEditingWorkspaceDescriptionId] = useState<string | null>(null);
  const [editingWorkspaceNotesId, setEditingWorkspaceNotesId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectDescriptionId, setEditingProjectDescriptionId] = useState<string | null>(null);
  const [editingProjectNotesId, setEditingProjectNotesId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskDescriptionId, setEditingTaskDescriptionId] = useState<string | null>(null);
  const [editingTaskNotesId, setEditingTaskNotesId] = useState<string | null>(null);
  const [editingSessionDescriptionId, setEditingSessionDescriptionId] = useState<string | null>(null);
  const [editingSessionNotesId, setEditingSessionNotesId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceFormState>(EMPTY_WORKSPACE_FORM);
  const [taskForm, setTaskForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [workspaceDraftTitle, setWorkspaceDraftTitle] = useState("");
  const [browserWindows, setBrowserWindows] = useState<BrowserWindowSummary[]>([]);
  const [selectedBrowserWindowId, setSelectedBrowserWindowId] = useState<number | null>(null);
  const [browserRailPinned, setBrowserRailPinned] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);
  const ribbonRailRef = useRef<HTMLElement | null>(null);
  const workspaceProjectColumnsRef = useRef<HTMLDivElement | null>(null);
  const projectViewShellRef = useRef<HTMLElement | null>(null);
  const taskSessionColumnsRef = useRef<HTMLDivElement | null>(null);
  const sessionColumnsRef = useRef<HTMLDivElement | null>(null);
  const horizontalDragRef = useRef<{
    element: HTMLElement;
    pointerId: number;
    startX: number;
    scrollLeft: number;
    dragged: boolean;
  } | null>(null);
  const suppressHorizontalClickRef = useRef(false);
  const horizontalAutoScrollRef = useRef<number | null>(null);

  useEffect(() => {
    void loadWorkspace();
    if (variant === "workspace") {
      void loadBrowserWindows();
    }
  }, []);

  useEffect(() => {
    if (variant !== "workspace") {
      return;
    }

    const refresh = () => void loadBrowserWindows();

    chrome.tabs.onCreated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(refresh);
    chrome.tabs.onRemoved.addListener(refresh);
    chrome.tabs.onMoved.addListener(refresh);
    chrome.tabs.onAttached.addListener(refresh);
    chrome.tabs.onDetached.addListener(refresh);
    chrome.windows.onCreated.addListener(refresh);
    chrome.windows.onRemoved.addListener(refresh);
    chrome.windows.onFocusChanged.addListener(refresh);

    return () => {
      chrome.tabs.onCreated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(refresh);
      chrome.tabs.onRemoved.removeListener(refresh);
      chrome.tabs.onMoved.removeListener(refresh);
      chrome.tabs.onAttached.removeListener(refresh);
      chrome.tabs.onDetached.removeListener(refresh);
      chrome.windows.onCreated.removeListener(refresh);
      chrome.windows.onRemoved.removeListener(refresh);
      chrome.windows.onFocusChanged.removeListener(refresh);
    };
  }, [variant]);

  useEffect(() => {
    function handleRuntimeMessage(message: unknown) {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type?: string }).type === WORKSPACE_MUTATED_EVENT
      ) {
        void loadWorkspace(searchQuery);
      }
    }

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  }, [searchQuery]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    const project = workspace.projects.find((item) => item.id === selectedProjectId) ?? workspace.projects[0] ?? null;
    const nextProjectId = project?.id ?? null;

    if (nextProjectId !== selectedProjectId) {
      setSelectedProjectId(nextProjectId);
    }

    const task =
      project?.tasks.find((item) => item.id === selectedTaskId) ??
      (workspace.activeTaskId ? project?.tasks.find((item) => item.id === workspace.activeTaskId) : undefined) ??
      project?.tasks[0] ??
      null;
    const nextTaskId = task?.id ?? null;

    if (nextTaskId !== selectedTaskId) {
      setSelectedTaskId(nextTaskId);
    }
  }, [workspace, selectedProjectId, selectedTaskId]);

  const selectedProject =
    workspace?.projects.find((project) => project.id === selectedProjectId) ?? workspace?.projects[0] ?? null;
  const selectedWorkspace =
    workspace?.workspaces.find((item) => item.id === workspace.activeWorkspaceId) ?? workspace?.workspaces[0] ?? null;
  const selectedTask =
    selectedProject?.tasks.find((task) => task.id === selectedTaskId) ??
    selectedProject?.tasks.find((task) => task.id === workspace?.activeTaskId) ??
    selectedProject?.tasks[0] ??
    null;
  const selectedSession =
    selectedTask?.sessions.find((session) => session.id === selectedSessionId) ??
    selectedTask?.sessions.find((session) => session.id === workspace?.activeSessionId) ??
    selectedTask?.sessions[0] ??
    null;
  const assignedBrowserTabs = new Map<string, { sessionId: string; sessionTitle: string; taskTitle: string }>();
  workspace?.projects.forEach((project) => {
    project.tasks.forEach((task) => {
      task.sessions.forEach((session) => {
        session.tabs.forEach((tab) => {
          assignedBrowserTabs.set(getBrowserTabKey(tab), {
            sessionId: session.id,
            sessionTitle: session.title ?? "Session",
            taskTitle: task.title,
          });
        });
      });
    });
  });
  const openTasks = selectedProject?.tasks.filter((task) => task.status !== "done") ?? [];
  const completedTasks = selectedProject?.tasks.filter((task) => task.status === "done") ?? [];
  const sessionTimeline =
    selectedTask && selectedSession
      ? selectedTask.checkpoints
          .filter(
            (checkpoint) =>
              checkpoint.sessionId === selectedSession.id ||
              checkpoint.id === selectedSession.checkpointId ||
              (!checkpoint.sessionId && selectedTask.sessions.length === 1),
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      : [];
  const selectedCheckpoint =
    sessionTimeline.find((checkpoint) => checkpoint.id === selectedCheckpointId) ??
    sessionTimeline[0] ??
    null;
  const selectedSessionTabDetails =
    selectedSessionTab?.source === "checkpoint"
      ? selectedCheckpoint?.sessionTabs.find((tab) => tab.id === selectedSessionTab.tabId)
      : selectedSession?.tabs.find((tab) => tab.id === selectedSessionTab?.tabId);
  const backlogTasks = selectedProject?.tasks.filter((task) => task.status === "todo" || task.status === "blocked") ?? [];
  const inProgressTasks = selectedProject?.tasks.filter((task) => task.status === "in_progress") ?? [];
  const doneTasks = selectedProject?.tasks.filter((task) => task.status === "done") ?? [];
  const backlogProjects = workspace?.projects.filter((project) => (project.status ?? "backlog") === "backlog") ?? [];
  const activeProjects = workspace?.projects.filter((project) => (project.status ?? "backlog") === "active") ?? [];
  const completedProjects = workspace?.projects.filter((project) => (project.status ?? "backlog") === "completed") ?? [];
  const archivedProjects = workspace?.projects.filter((project) => (project.status ?? "backlog") === "archived") ?? [];
  const taskSessionColumns = selectedTask
    ? [...selectedTask.sessions].sort((left, right) => {
        const leftRank = left.id === workspace?.activeSessionId ? 0 : left.state === "active" ? 1 : left.state === "open" ? 2 : left.state === "closed" ? 3 : 4;
        const rightRank = right.id === workspace?.activeSessionId ? 0 : right.state === "active" ? 1 : right.state === "open" ? 2 : right.state === "closed" ? 3 : 4;
        return leftRank - rightRank || getSessionActivityAt(right).localeCompare(getSessionActivityAt(left));
      })
    : [];
  const workspaceRibbonItems = workspace?.workspaces ?? [];
  const projectRibbonItems = [...activeProjects, ...backlogProjects, ...completedProjects, ...archivedProjects];
  const createMode: "workspace" | "task" | "project" | "session" =
    activeView === "workspace"
      ? "workspace"
      : activeView === "project"
        ? "project"
        : activeView === "task" || activeView === "session"
          ? "session"
          : selectedProject
            ? "task"
            : "project";
  const createLabel =
    createMode === "workspace"
      ? "Create workspace"
      : createMode === "task"
        ? "Create task"
        : createMode === "session"
          ? "Create session"
          : "Create project";
  const selectedProjectStatus = selectedProject?.status ?? "backlog";
  const selectedTaskStatusVisual =
    selectedTask?.status === "done" ? "completed" : selectedTask?.status === "in_progress" ? "active" : "backlog";
  const selectedSessionStatusVisual = getSessionStatusVisual(selectedSession?.state);
  const canMoveUpView = activeView !== "workspace";

  useEffect(() => {
    setWorkspaceNoteDraft(selectedWorkspace?.noteMarkdown ?? "");
    setWorkspaceNoteTargetId(selectedWorkspace?.id ?? null);
    setWorkspaceNoteState("idle");
  }, [selectedWorkspace?.id, selectedWorkspace?.noteMarkdown]);

  useEffect(() => {
    setProjectNoteDraft(selectedProject?.noteMarkdown ?? "");
    setProjectNoteTargetId(selectedProject?.id ?? null);
    setProjectNoteState("idle");
  }, [selectedProject?.id, selectedProject?.noteMarkdown]);

  useEffect(() => {
    setTaskNoteDraft(selectedTask?.noteMarkdown ?? "");
    setTaskNoteTargetId(selectedTask?.id ?? null);
    setTaskNoteState("idle");
  }, [selectedTask?.id, selectedTask?.noteMarkdown]);

  useEffect(() => {
    setSessionNoteDraft(selectedSession?.noteMarkdown ?? "");
    setSessionNoteTargetId(selectedSession?.id ?? null);
    setSessionNoteState("idle");
  }, [selectedSession?.id, selectedSession?.noteMarkdown]);

  useEffect(() => {
    setSelectedCheckpointId(null);
    setSelectedSessionId(null);
    setSelectedSessionTab(null);
  }, [selectedTask?.id]);

  useEffect(() => {
    setSelectedCheckpointId(null);
    setSelectedSessionTab(null);
  }, [selectedSession?.id]);

  useEffect(() => {
    const targetSessionId = selectedSessionTab?.source === "current" ? selectedSession?.id : undefined;
    const targetTab = selectedSessionTabDetails;

    setSessionTabNoteDraft(targetTab?.noteMarkdown ?? "");
    setSessionTabNoteTarget(targetSessionId && targetTab ? { sessionId: targetSessionId, tabId: targetTab.id } : null);
    setSessionTabNoteState("idle");
  }, [selectedSessionTab?.source, selectedSessionTab?.tabId, selectedSession?.id, selectedSessionTabDetails?.id, selectedSessionTabDetails?.noteMarkdown]);

  useEffect(() => {
    if (!selectedWorkspace) {
      return;
    }

    if (workspaceNoteTargetId !== selectedWorkspace.id) {
      return;
    }

    if (workspaceNoteDraft === (selectedWorkspace.noteMarkdown ?? "")) {
      return;
    }

    setWorkspaceNoteState("saving");
    const timer = window.setTimeout(() => {
      void updateWorkspaceNote(selectedWorkspace.id, workspaceNoteDraft)
        .then((next) => {
          setWorkspace(next);
          setWorkspaceNoteState("saved");
        })
        .catch((cause) => {
          setWorkspaceNoteState("error");
          setError(cause instanceof Error ? cause.message : "Failed to save workspace notes.");
        });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [workspaceNoteDraft, workspaceNoteTargetId, selectedWorkspace]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    if (projectNoteTargetId !== selectedProject.id) {
      return;
    }

    if (projectNoteDraft === (selectedProject.noteMarkdown ?? "")) {
      return;
    }

    setProjectNoteState("saving");
    const timer = window.setTimeout(() => {
      void updateProjectNote(selectedProject.id, projectNoteDraft)
        .then((next) => {
          setWorkspace(next);
          setProjectNoteState("saved");
        })
        .catch((cause) => {
          setProjectNoteState("error");
          setError(cause instanceof Error ? cause.message : "Failed to save project notes.");
        });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [projectNoteDraft, projectNoteTargetId, selectedProject]);

  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    if (taskNoteTargetId !== selectedTask.id) {
      return;
    }

    if (taskNoteDraft === (selectedTask.noteMarkdown ?? "")) {
      return;
    }

    setTaskNoteState("saving");
    const timer = window.setTimeout(() => {
      void updateTaskNote(selectedTask.id, taskNoteDraft)
        .then((next) => {
          setWorkspace(next);
          setTaskNoteState("saved");
        })
        .catch((cause) => {
          setTaskNoteState("error");
          setError(cause instanceof Error ? cause.message : "Failed to save task notes.");
        });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [taskNoteDraft, selectedTask, taskNoteTargetId]);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    if (sessionNoteTargetId !== selectedSession.id) {
      return;
    }

    if (sessionNoteDraft === (selectedSession.noteMarkdown ?? "")) {
      return;
    }

    setSessionNoteState("saving");
    const timer = window.setTimeout(() => {
      void updateTaskSession({
        id: selectedSession.id,
        title: selectedSession.title,
        description: selectedSession.description,
        noteMarkdown: sessionNoteDraft,
      })
        .then((next) => {
          setWorkspace(next);
          setSessionNoteState("saved");
        })
        .catch((cause) => {
          setSessionNoteState("error");
          setError(cause instanceof Error ? cause.message : "Failed to save session notes.");
        });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [sessionNoteDraft, selectedSession, sessionNoteTargetId]);

  useEffect(() => {
    if (!sessionTabNoteTarget || selectedSessionTab?.source !== "current" || !selectedSessionTabDetails) {
      return;
    }

    if (sessionTabNoteDraft === (selectedSessionTabDetails.noteMarkdown ?? "")) {
      return;
    }

    setSessionTabNoteState("saving");
    const timer = window.setTimeout(() => {
      void updateSessionTabNote({ ...sessionTabNoteTarget, noteMarkdown: sessionTabNoteDraft })
        .then((next) => {
          setWorkspace(next);
          setSessionTabNoteState("saved");
        })
        .catch((cause) => {
          setSessionTabNoteState("error");
          setError(cause instanceof Error ? cause.message : "Failed to save tab notes.");
        });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [sessionTabNoteDraft, sessionTabNoteTarget, selectedSessionTab?.source, selectedSessionTabDetails]);

  useEffect(() => {
    if (searchDebounceRef.current !== null) {
      window.clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = window.setTimeout(() => {
      void loadWorkspace(searchQuery);
    }, 180);

    return () => {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  function updateHorizontalOverflowState(element: HTMLElement) {
    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    element.classList.toggle("horizontal-scroll-has-left", maxScrollLeft > 1 && element.scrollLeft > 1);
    element.classList.toggle("horizontal-scroll-has-right", maxScrollLeft > 1 && element.scrollLeft < maxScrollLeft - 1);
  }

  useEffect(() => {
    const elements = [
      ribbonRailRef.current,
      workspaceProjectColumnsRef.current,
      projectViewShellRef.current,
      taskSessionColumnsRef.current,
      sessionColumnsRef.current,
    ].filter((element): element is HTMLElement => Boolean(element));

    const handleWheel = (event: globalThis.WheelEvent) => {
      const element = event.currentTarget as HTMLElement;
      const maxScrollLeft = element.scrollWidth - element.clientWidth;

      if (maxScrollLeft <= 0) {
        return;
      }

      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

      if (delta === 0) {
        return;
      }

      const canScrollLeft = delta < 0 && element.scrollLeft > 0;
      const canScrollRight = delta > 0 && element.scrollLeft < maxScrollLeft;

      if (!canScrollLeft && !canScrollRight) {
        return;
      }

      event.preventDefault();
      element.scrollLeft = Math.max(0, Math.min(maxScrollLeft, element.scrollLeft + delta));
      updateHorizontalOverflowState(element);
    };

    const handleScroll = (event: Event) => updateHorizontalOverflowState(event.currentTarget as HTMLElement);
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => updateHorizontalOverflowState(entry.target as HTMLElement));
    });

    elements.forEach((element) => {
      updateHorizontalOverflowState(element);
      element.addEventListener("wheel", handleWheel, { passive: false });
      element.addEventListener("scroll", handleScroll);
      resizeObserver.observe(element);
    });

    return () => {
      elements.forEach((element) => {
        element.removeEventListener("wheel", handleWheel);
        element.removeEventListener("scroll", handleScroll);
        element.classList.remove("horizontal-scroll-has-left");
        element.classList.remove("horizontal-scroll-has-right");
      });
      resizeObserver.disconnect();
    };
  }, [
    activeView,
    workspace?.activeWorkspaceId,
    workspace?.projects.length,
    workspace?.workspaces.length,
    selectedTask?.id,
    selectedTask?.checkpoints.length,
    selectedSession?.id,
    selectedSession?.tabs.length,
  ]);

  const totalTaskCount = workspace?.projects.reduce((sum, project) => sum + project.tasks.length, 0) ?? 0;
  async function loadWorkspace(query = searchQuery) {
    setLoading(true);
    setError(null);

    try {
      const next = await requestWorkspace(query || undefined);
      setWorkspace(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load workspace state.");
    } finally {
      setLoading(false);
    }
  }

  async function loadBrowserWindows(preferredWindowId = selectedBrowserWindowId) {
    try {
      const windows = await chrome.windows.getAll({
        populate: true,
        windowTypes: ["normal"],
      });
      const summaries = windows
        .filter((window): window is chrome.windows.Window & { id: number } => typeof window.id === "number")
        .map<BrowserWindowSummary>((window) => ({
          id: window.id,
          focused: Boolean(window.focused),
          tabs: [...(window.tabs ?? [])].sort((left, right) => (left.index ?? 0) - (right.index ?? 0)),
        }));
      const selectedWindow =
        summaries.find((window) => window.id === preferredWindowId) ??
        summaries.find((window) => window.focused) ??
        summaries[0] ??
        null;

      setBrowserWindows(summaries);
      setSelectedBrowserWindowId(selectedWindow?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load browser windows.");
    }
  }

  async function handleBrowserWindowSelect(windowId: number) {
    setSelectedBrowserWindowId(windowId);
    setBrowserWindows((current) =>
      current.map((window) => ({
        ...window,
        focused: window.id === windowId,
      })),
    );

    try {
      await loadBrowserWindows(windowId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to inspect browser window.");
    }
  }

  async function handleBrowserTabSelect(tab: chrome.tabs.Tab) {
    if (typeof tab.id !== "number" || typeof tab.windowId !== "number") {
      return;
    }

    try {
      await chrome.windows.update(tab.windowId, {
        focused: true,
      });
      await chrome.tabs.update(tab.id, {
        active: true,
      });
      setSelectedBrowserWindowId(tab.windowId);
      await loadBrowserWindows(tab.windowId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to focus browser tab.");
    }
  }

  async function runMutation(action: () => Promise<WorkspaceResponse>) {
    setBusy(true);
    setError(null);

    try {
      const next = await action();
      setWorkspace(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workspace action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleProjectSubmit(status: ProjectStatus = "backlog", nextView: WorkspaceView = "project") {
    if (!projectDraft.title.trim()) {
      setError("Project title is required.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const next = await createProject({
        title: projectDraft.title,
        workspaceId: workspace?.activeWorkspaceId,
        status,
        description: projectDraft.description,
      });
      setWorkspace(next);
      const newestProject = [...next.projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
      setSelectedProjectId(newestProject?.id ?? null);
      setSelectedTaskId(newestProject?.tasks[0]?.id ?? null);
      setActiveView(nextView);
      setProjectDraft(EMPTY_PROJECT_FORM);
      setProjectCreateOpen(false);
      setColumnCreateTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create project.");
    } finally {
      setBusy(false);
    }
  }

  async function handleWorkspaceSubmit() {
    if (!workspaceDraftTitle.trim()) {
      setError("Workspace title is required.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const next = await createWorkspace({
        title: workspaceDraftTitle,
      });
      setWorkspace(next);
      setSelectedProjectId(next.projects[0]?.id ?? null);
      setSelectedTaskId(next.projects[0]?.tasks[0]?.id ?? null);
      setWorkspaceDraftTitle("");
      setActiveView("workspace");
      setProjectCreateOpen(false);
      setColumnCreateTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create workspace.");
    } finally {
      setBusy(false);
    }
  }

  async function handleWorkspaceSelect(workspaceId: string) {
    setBusy(true);
    setError(null);

    try {
      const next = await setActiveWorkspace(workspaceId);
      setWorkspace(next);
      setSelectedProjectId(next.projects[0]?.id ?? null);
      setSelectedTaskId(next.projects[0]?.tasks[0]?.id ?? null);
      setActiveView("workspace");
      setProjectCreateOpen(false);
      setColumnCreateTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to switch workspace.");
    } finally {
      setBusy(false);
    }
  }

  function startHorizontalDrag(event: PointerEvent<HTMLElement>, allowInteractiveTarget: boolean) {
    if (event.button !== 0) {
      return;
    }

    if (!allowInteractiveTarget && (event.target as HTMLElement).closest("button, input, textarea, select, summary, a")) {
      return;
    }

    const element = event.currentTarget;

    if (element.scrollWidth <= element.clientWidth) {
      return;
    }

    horizontalDragRef.current = {
      element,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: element.scrollLeft,
      dragged: false,
    };
    element.setPointerCapture(event.pointerId);
  }

  function handleHorizontalPointerDown(event: PointerEvent<HTMLElement>) {
    startHorizontalDrag(event, false);
  }

  function handleRibbonPointerDown(event: PointerEvent<HTMLElement>) {
    startHorizontalDrag(event, false);
  }

  function handleHorizontalPointerMove(event: PointerEvent<HTMLElement>) {
    const drag = horizontalDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.startX;

    if (Math.abs(deltaX) > 3) {
      drag.dragged = true;
    }

    drag.element.scrollLeft = drag.scrollLeft - deltaX;
    updateHorizontalOverflowState(drag.element);

    if (drag.dragged) {
      event.preventDefault();
    }
  }

  function handleHorizontalPointerEnd(event: PointerEvent<HTMLElement>) {
    const drag = horizontalDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (drag.dragged) {
      suppressHorizontalClickRef.current = true;
      window.setTimeout(() => {
        suppressHorizontalClickRef.current = false;
      }, 0);
    }

    drag.element.releasePointerCapture(event.pointerId);
    horizontalDragRef.current = null;
  }

  function handleHorizontalClickCapture(event: MouseEvent<HTMLElement>) {
    if (!suppressHorizontalClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function stopHorizontalAutoScroll() {
    if (horizontalAutoScrollRef.current !== null) {
      window.cancelAnimationFrame(horizontalAutoScrollRef.current);
      horizontalAutoScrollRef.current = null;
    }
  }

  function startHorizontalAutoScroll(ref: { current: HTMLElement | null }, direction: -1 | 1) {
    stopHorizontalAutoScroll();

    const step = () => {
      const element = ref.current;

      if (!element) {
        stopHorizontalAutoScroll();
        return;
      }

      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, element.scrollLeft + direction * 14));
      element.scrollLeft = nextScrollLeft;
      updateHorizontalOverflowState(element);

      if ((direction < 0 && nextScrollLeft <= 0) || (direction > 0 && nextScrollLeft >= maxScrollLeft)) {
        stopHorizontalAutoScroll();
        return;
      }

      horizontalAutoScrollRef.current = window.requestAnimationFrame(step);
    };

    horizontalAutoScrollRef.current = window.requestAnimationFrame(step);
  }

  async function handleTaskSubmit(status: TaskStatus = taskDraft.status) {
    if (!selectedProject) {
      setError("Create or select a project before adding a task.");
      return;
    }

    if (!taskDraft.title.trim()) {
      setError("Task title is required.");
      return;
    }

    await runMutation(() =>
      createTask({
        projectId: selectedProject.id,
        title: taskDraft.title,
        description: taskDraft.description,
        status,
      }),
    );
    setTaskDraft(EMPTY_TASK_FORM);
    setProjectCreateOpen(false);
    setColumnCreateTarget(null);
    setSelectedProjectId(selectedProject.id);
    setActiveView("project");
  }

  async function handleAttachCurrentTab(sessionId = selectedSession?.id) {
    if (!selectedTask) {
      setError("Select a task before attaching the current tab.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await setActiveTask(selectedTask.id);
      await attachCurrentTab(selectedTask.id, sessionId);
      await loadWorkspace(searchQuery);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to attach the current tab.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAttachCurrentWindow(sessionId = selectedSession?.id) {
    if (!selectedTask) {
      setError("Select a task before attaching the current window.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await setActiveTask(selectedTask.id);
      await attachCurrentWindow(selectedTask.id, sessionId);
      await loadWorkspace(searchQuery);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to attach the current window.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTaskSession() {
    if (!selectedTask) {
      setError("Select a task before creating a session.");
      return;
    }

    const sessionTitle = checkpointTitle.trim();
    if (!sessionTitle) {
      setError("Session name is required.");
      return;
    }
    if (/^(active|open|closed|archived) session$/i.test(sessionTitle)) {
      setError("Use a unique session name instead of a session state.");
      return;
    }

    if (selectedTask.sessions.some((session) => session.title?.trim().toLowerCase() === sessionTitle.toLowerCase())) {
      setError("Session names must be unique within a task.");
      return;
    }

    await runMutation(() => createTaskSession(selectedTask.id, sessionTitle));
    setCheckpointTitle("");
    setSelectedCheckpointId(null);
    setProjectCreateOpen(false);
    setActiveView("task");
  }

  async function handleSetActiveSession(sessionId: string) {
    await runMutation(() => setActiveSession(sessionId));
    setSelectedSessionId(sessionId);
  }

  async function handleArchiveTaskSession(sessionId = selectedSession?.id) {
    if (!selectedTask) {
      setError("Select a task before archiving a session.");
      return;
    }
    if (!sessionId) {
      setError("Select a session before closing it.");
      return;
    }

    await runMutation(() =>
      archiveTaskSession({
        taskId: selectedTask.id,
        sessionId,
        title: checkpointTitle,
      }),
    );
    setCheckpointTitle("");
    setSelectedCheckpointId(null);
  }

  async function handleCreateCheckpoint(sessionId = selectedSession?.id) {
    if (!selectedTask) {
      setError("Select a task before saving a checkpoint.");
      return;
    }
    if (!sessionId) {
      setError("Select a session before saving a checkpoint.");
      return;
    }

    await runMutation(() =>
      createCheckpoint({
        taskId: selectedTask.id,
        sessionId,
        title: checkpointTitle,
      }),
    );
    setCheckpointTitle("");
    setCheckpointNameOpen(false);
    setSelectedSessionTab(null);
  }

  async function handleDeleteTaskSession(sessionId = selectedSession?.id) {
    if (!selectedTask || !sessionId) {
      setError("Select a task before deleting a session.");
      return;
    }

    if (!window.confirm("Delete this session?")) {
      return;
    }

    await runMutation(() => deleteTaskSession({ sessionId }));
    setSelectedCheckpointId(null);
  }

  async function handleRemoveSessionTab(tabId: string, sessionId = selectedSession?.id, closeBrowserTab = false) {
    if (!sessionId) {
      return;
    }

    await runMutation(() => removeSessionTab(sessionId, tabId, closeBrowserTab));
  }

  function writeDragPayload(event: DragEvent<HTMLElement>, payload: DragPayload, id: string) {
    setDraggingId(id);
    event.dataTransfer.effectAllowed = "move";
    const serialized = JSON.stringify(payload);
    event.dataTransfer.setData("application/smartsession", serialized);
    event.dataTransfer.setData("text/plain", serialized);
  }

  function readDragPayload(event: DragEvent<HTMLElement>) {
    const raw = event.dataTransfer.getData("application/smartsession") || event.dataTransfer.getData("text/plain");
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function insertId(ids: string[], draggedId: string, targetId?: string, position: "before" | "after" = "before") {
    const nextIds = ids.filter((id) => id !== draggedId);
    const targetIndex = targetId ? nextIds.indexOf(targetId) : -1;
    nextIds.splice(targetIndex >= 0 ? targetIndex + (position === "after" ? 1 : 0) : nextIds.length, 0, draggedId);
    return nextIds;
  }

  function getDropPosition(event: DragEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  }

  async function handleProjectDrop(
    event: DragEvent<HTMLElement>,
    status: ProjectStatus,
    targetProjectId?: string,
    position: "before" | "after" = "before",
  ) {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event);
    setDraggingId(null);
    if (payload?.type !== "project" || !workspace) {
      return;
    }

    const targetIds = workspace.projects
      .filter((project) => (project.status ?? "backlog") === status)
      .map((project) => project.id);
    await runMutation(() =>
      reorderProjects({
        projectId: payload.id,
        status,
        orderedProjectIds: insertId(targetIds, payload.id, targetProjectId, position),
      }),
    );
  }

  async function handleTaskDrop(
    event: DragEvent<HTMLElement>,
    status: TaskStatus,
    targetTaskId?: string,
    position: "before" | "after" = "before",
  ) {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event);
    setDraggingId(null);
    if (payload?.type !== "task" || !selectedProject) {
      return;
    }

    const targetIds = selectedProject.tasks
      .filter((task) => (task.status === "blocked" ? "todo" : task.status) === (status === "blocked" ? "todo" : status))
      .map((task) => task.id);
    await runMutation(() =>
      reorderTasks({
        taskId: payload.id,
        status,
        orderedTaskIds: insertId(targetIds, payload.id, targetTaskId, position),
      }),
    );
  }

  async function handleSessionTabDrop(event: DragEvent<HTMLElement>, targetSessionId: string, targetTabId?: string) {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event);
    setDraggingId(null);
    const targetSession = selectedTask?.sessions.find((session) => session.id === targetSessionId);
    if (!selectedTask || !targetSession || !payload) {
      return;
    }

    const targetIds = targetSession.tabs.map((tab) => tab.id);
    if (payload.type === "session-tab") {
      await runMutation(() =>
        moveSessionTab({
          sourceSessionId: payload.sessionId,
          targetSessionId,
          tabId: payload.tabId,
          orderedTabIds: insertId(targetIds, payload.tabId, targetTabId),
        }),
      );
      return;
    }

    if (payload.type === "browser-tab") {
      await runMutation(() =>
        attachDraggedTabToSession({
          taskId: selectedTask.id,
          sessionId: targetSessionId,
          tab: payload.tab,
          beforeTabId: targetTabId,
        }),
      );
    }
  }

  function handleViewSelect(view: WorkspaceView) {
    setActiveView(view);
    setViewMenuOpen(false);
    setProjectCreateOpen(false);
    setColumnCreateTarget(null);
  }

  function handleViewUp() {
    if (activeView === "session") {
      handleViewSelect("task");
      return;
    }

    if (activeView === "task") {
      handleViewSelect("project");
      return;
    }

    if (activeView === "project") {
      handleViewSelect("workspace");
    }
  }

  const breadcrumbItems: Array<{ label: string; view: WorkspaceView; onClick: () => void }> = selectedWorkspace
    ? [
        {
          label: selectedWorkspace.title,
          view: "workspace",
          onClick: () => handleViewSelect("workspace"),
        },
        ...(selectedProject && activeView !== "workspace"
          ? [
              {
                label: selectedProject.title,
                view: "project" as const,
                onClick: () => {
                  setSelectedProjectId(selectedProject.id);
                  setSelectedTaskId(null);
                  handleViewSelect("project");
                },
              },
            ]
          : []),
        ...(selectedTask && (activeView === "task" || activeView === "session")
          ? [
              {
                label: selectedTask.title,
                view: "task" as const,
                onClick: () => {
                  setSelectedTaskId(selectedTask.id);
                  handleViewSelect("task");
                },
              },
            ]
          : []),
        ...(selectedSession && activeView === "session"
          ? [
              {
                label: selectedSession.title ?? "Selected session",
                view: "session" as const,
                onClick: () => {
                  setSelectedSessionId(selectedSession.id);
                  handleViewSelect("session");
                },
              },
            ]
          : []),
      ]
    : [];

  return (
    <main
      className={`surface ${variant === "workspace" ? "workspace-shell" : "sidepanel-shell"} ${
        variant === "workspace" && browserRailPinned ? "workspace-shell-rail-pinned" : ""
      }`}
    >
      {variant === "workspace" ? (
        <BrowserWindowRail
          windows={browserWindows}
          selectedWindowId={selectedBrowserWindowId}
          pinned={browserRailPinned}
          onPinnedChange={setBrowserRailPinned}
          onSelectWindow={(windowId) => void handleBrowserWindowSelect(windowId)}
          onSelectTab={(tab) => void handleBrowserTabSelect(tab)}
          getTabAssignment={(tab) => assignedBrowserTabs.get(getBrowserTabKey(tab))}
          onTabDragStart={(event, tab) =>
            writeDragPayload(
              event,
              {
                type: "browser-tab",
                tab: {
                  id: tab.id,
                  url: tab.url,
                  title: tab.title,
                  favIconUrl: tab.favIconUrl,
                  pinned: tab.pinned,
                  windowId: tab.windowId,
                  index: tab.index,
                  groupId: tab.groupId,
                },
              },
              `browser-tab-${tab.id ?? tab.url}`,
            )
          }
          onTabDragEnd={() => setDraggingId(null)}
        />
      ) : null}

      <header className="app-topbar">
        <div className="view-control-group">
          <button
            className="icon-button"
            type="button"
            aria-label="Go up one view level"
            title="Up one level"
            onClick={handleViewUp}
            disabled={!canMoveUpView}
          >
            ←
          </button>
          <div className="view-menu-anchor">
            <button
              className={`icon-button workspace-menu-button ${viewMenuOpen ? "icon-button-active" : ""}`}
              type="button"
              aria-label="Choose view"
              title="Choose view"
              aria-expanded={viewMenuOpen}
              onClick={() => {
                setViewMenuOpen((current) => !current);
                setProjectCreateOpen(false);
                setColumnCreateTarget(null);
              }}
            >
              ▤
            </button>
            {viewMenuOpen ? (
              <div className="view-menu-popover">
                {(["workspace", "project", "task", "session"] as WorkspaceView[]).map((view) => (
                  <button
                    key={view}
                    className={view === activeView ? "view-menu-item-active" : ""}
                    type="button"
                    onClick={() => handleViewSelect(view)}
                  >
                    <span>{view}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="horizontal-scroll-frame ribbon-scroll-frame">
          <button
            className="horizontal-scroll-arrow horizontal-scroll-arrow-left"
            type="button"
            aria-label="Scroll ribbon left"
            onMouseEnter={() => startHorizontalAutoScroll(ribbonRailRef, -1)}
            onMouseLeave={stopHorizontalAutoScroll}
            onFocus={() => startHorizontalAutoScroll(ribbonRailRef, -1)}
            onBlur={stopHorizontalAutoScroll}
          >
            ‹
          </button>
          <nav
            ref={ribbonRailRef}
            className="project-pill-rail horizontal-scroll-surface horizontal-scroll-edge"
            aria-label={`${activeView} navigation`}
            onPointerDown={handleRibbonPointerDown}
            onPointerMove={handleHorizontalPointerMove}
            onPointerUp={handleHorizontalPointerEnd}
            onPointerCancel={handleHorizontalPointerEnd}
            onClickCapture={handleHorizontalClickCapture}
          >
            {activeView === "workspace" ? (
              workspaceRibbonItems.map((item) => (
                <button
                  key={item.id}
                  className={`project-pill project-pill-status-${item.archivedAt ? "archived" : "active"} ${
                    item.id === workspace?.activeWorkspaceId ? "project-pill-active" : ""
                  }`}
                  type="button"
                  onClick={() => void handleWorkspaceSelect(item.id)}
                  disabled={busy}
                >
                  {item.title}
                </button>
              ))
            ) : activeView === "task" ? (
              selectedProject?.tasks.length ? (
                selectedProject.tasks.map((task) => (
                  <button
                    key={task.id}
                    className={`project-pill ${task.id === selectedTask?.id ? "project-pill-active" : ""}`}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setActiveView("task");
                      setProjectCreateOpen(false);
                      setEditingTaskId(null);
                    }}
                  >
                    {task.title}
                  </button>
                ))
              ) : (
                <span className="project-pill-empty">No tasks yet</span>
              )
            ) : activeView === "session" ? (
              selectedTask?.sessions.length ? (
                [...selectedTask.sessions]
                  .sort(compareSessionsForRibbon)
                  .map((session) => (
                    <button
                      key={session.id}
                      className={`project-pill project-pill-status-${getSessionStatusVisual(session.state)} ${
                        session.id === selectedSession?.id ? "project-pill-active" : ""
                      }`}
                      type="button"
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        setActiveView("session");
                        setProjectCreateOpen(false);
                      }}
                    >
                      {session.title ?? "Untitled session"}
                    </button>
                  ))
              ) : (
                <span className="project-pill-empty">No sessions yet</span>
              )
            ) : (
              <>
                {projectRibbonItems.map((project) => (
                  <button
                    key={project.id}
                    className={`project-pill project-pill-status-${project.status ?? "backlog"} ${
                      project.id === selectedProject?.id ? "project-pill-active" : ""
                    }`}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setSelectedTaskId(null);
                      setActiveView("project");
                      setProjectCreateOpen(false);
                      setEditingProjectId(null);
                      setEditingTaskId(null);
                    }}
                  >
                    {project.title}
                  </button>
                ))}
                {!projectRibbonItems.length ? <span className="project-pill-empty">No projects yet</span> : null}
              </>
            )}
          </nav>
          <button
            className="horizontal-scroll-arrow horizontal-scroll-arrow-right"
            type="button"
            aria-label="Scroll ribbon right"
            onMouseEnter={() => startHorizontalAutoScroll(ribbonRailRef, 1)}
            onMouseLeave={stopHorizontalAutoScroll}
            onFocus={() => startHorizontalAutoScroll(ribbonRailRef, 1)}
            onBlur={stopHorizontalAutoScroll}
          >
            ›
          </button>
        </div>

        <div className="topbar-actions">
          <div className={`topbar-search ${searchOpen ? "topbar-search-open" : ""}`}>
            {searchOpen ? (
              <input
                id={`search-${variant}`}
                className="text-input topbar-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search"
                autoFocus
              />
            ) : null}
            <button
              className="icon-button"
              type="button"
              aria-label={searchOpen ? "Close search" : "Search"}
              title={searchOpen ? "Close search" : "Search"}
              onClick={() => {
                if (searchOpen && searchQuery) {
                  setSearchQuery("");
                }
                setSearchOpen((current) => !current);
              }}
            >
              ⌕
            </button>
          </div>

          <div className="project-create-anchor">
            <button
              className="icon-button icon-button-primary"
              type="button"
              aria-label={createLabel}
              title={createLabel}
              onClick={() => {
                setColumnCreateTarget(null);
                setProjectCreateOpen((current) => !current);
              }}
            >
              +
            </button>
            {projectCreateOpen ? (
              <div className="compact-popover stack-sm">
                <span className="eyebrow">
                  {createMode === "workspace"
                    ? "New workspace"
                    : createMode === "task"
                      ? "New task"
                      : createMode === "session"
                        ? "New session"
                        : "New project"}
                </span>
                {createMode === "workspace" ? (
                  <input
                    className="text-input"
                    value={workspaceDraftTitle}
                    onChange={(event) => setWorkspaceDraftTitle(event.target.value)}
                    placeholder="Workspace title"
                  />
                ) : createMode === "session" ? (
                  <>
                    <input
                      className="text-input"
                      value={checkpointTitle}
                      onChange={(event) => setCheckpointTitle(event.target.value)}
                      placeholder="Session name"
                      autoFocus
                    />
                    <p className="muted">Start a fresh empty active session for this task.</p>
                  </>
                ) : createMode === "task" ? (
                  <>
                    <input
                      className="text-input"
                      value={taskDraft.title}
                      onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Task title"
                    />
                    <input
                      className="text-input"
                      value={taskDraft.description}
                      onChange={(event) =>
                        setTaskDraft((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Optional note"
                    />
                  </>
                ) : (
                  <input
                    className="text-input"
                    value={projectDraft.title}
                    onChange={(event) => setProjectDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Project title"
                  />
                )}
                <div className="toolbar-actions">
                  <button
                    className="primary-button"
                    onClick={() =>
                      void (createMode === "workspace"
                        ? handleWorkspaceSubmit()
                        : createMode === "session"
                          ? handleCreateTaskSession()
                          : createMode === "task"
                          ? handleTaskSubmit()
                          : handleProjectSubmit())
                    }
                    disabled={
                      busy ||
                      (createMode === "session" &&
                        (selectedTask?.status === "done" || !checkpointTitle.trim()))
                    }
                  >
                    Create
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setProjectCreateOpen(false);
                      setColumnCreateTarget(null);
                      setProjectDraft(EMPTY_PROJECT_FORM);
                      setTaskDraft(EMPTY_TASK_FORM);
                      setWorkspaceDraftTitle("");
                      setCheckpointTitle("");
                    }}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button className="ghost-button topbar-text-button" onClick={() => void loadWorkspace()} disabled={busy || loading}>
            Refresh
          </button>
          {onOpenWorkspace ? (
            <button className="secondary-button topbar-text-button" onClick={onOpenWorkspace}>
              Full
            </button>
          ) : null}
        </div>
      </header>

      {breadcrumbItems.length ? (
        <nav className="workspace-breadcrumbs" aria-label="Current workspace path">
          {breadcrumbItems.map((item, index) => (
            <span className="workspace-breadcrumb-segment" key={`${item.view}-${item.label}`}>
              {index > 0 ? <span className="workspace-breadcrumb-separator">&gt;</span> : null}
              <button
                className={item.view === activeView ? "workspace-breadcrumb-current" : ""}
                type="button"
                onClick={item.onClick}
              >
                {item.label}
              </button>
            </span>
          ))}
        </nav>
      ) : null}

      {error ? <section className="panel error-text">{error}</section> : null}

      {activeView === "workspace" ? (
        <section className="workspace-board-shell">
          <aside className="project-column project-context-column">
            {selectedWorkspace ? (
              <>
                <div className="project-context-header">
                  {editingWorkspaceId === selectedWorkspace.id ? (
                    <div className="project-title-edit">
                      <input
                        className="text-input"
                        value={workspaceForm.title}
                        onChange={(event) => setWorkspaceForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Workspace name"
                        autoFocus
                      />
                      <button
                        className="ghost-button"
                        onClick={() =>
                          void runMutation(() =>
                            updateWorkspace({
                              id: selectedWorkspace.id,
                              title: workspaceForm.title || selectedWorkspace.title,
                              description: selectedWorkspace.description ?? "",
                              noteMarkdown: selectedWorkspace.noteMarkdown,
                            }),
                          ).then(() => setEditingWorkspaceId(null))
                        }
                        disabled={busy}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      className="kanban-column-header project-column-title"
                      type="button"
                      onDoubleClick={() => {
                        setEditingWorkspaceId(selectedWorkspace.id);
                        setWorkspaceForm({
                          title: selectedWorkspace.title,
                          description: selectedWorkspace.description ?? "",
                        });
                      }}
                    >
                      <span>{selectedWorkspace.title}</span>
                    </button>
                  )}
                  <button
                    className="project-delete-icon"
                    type="button"
                    title="Delete workspace"
                    aria-label="Delete workspace"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete "${selectedWorkspace.title}" and all of its projects, tasks, notes, tabs, and checkpoints?`,
                        )
                      ) {
                        void runMutation(() => deleteWorkspace(selectedWorkspace.id));
                      }
                    }}
                    disabled={busy || (workspace?.workspaces.length ?? 0) < 2}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2l1 10h4l1-10h2l-1.2 12H8.2L7 9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
                <div className="kanban-column-header project-description-title">
                  <span>Workspace description</span>
                </div>
                {editingWorkspaceDescriptionId === selectedWorkspace.id ? (
                  <textarea
                    className="text-area note-editor project-description-field"
                    value={workspaceForm.description}
                    onChange={(event) =>
                      setWorkspaceForm((current) => ({ ...current, description: event.target.value }))
                    }
                    onBlur={() => {
                      void runMutation(() =>
                        updateWorkspace({
                          id: selectedWorkspace.id,
                          title: selectedWorkspace.title,
                          description: workspaceForm.description,
                          noteMarkdown: selectedWorkspace.noteMarkdown,
                        }),
                      ).then(() => setEditingWorkspaceDescriptionId(null));
                    }}
                    placeholder="Workspace description"
                    autoFocus
                  />
                ) : (
                  <button
                    className="project-text-window note-editor project-description-display"
                    type="button"
                    onDoubleClick={() => {
                      setEditingWorkspaceDescriptionId(selectedWorkspace.id);
                      setWorkspaceForm({
                        title: selectedWorkspace.title,
                        description: selectedWorkspace.description ?? "",
                      });
                    }}
                  >
                    <span className="project-description-display-text">
                      {selectedWorkspace.description || "Double-click to add a workspace description."}
                    </span>
                  </button>
                )}
                {editingWorkspaceNotesId === selectedWorkspace.id ? (
                  <>
                    <div className="kanban-column-header project-notes-title">
                      <span>Workspace notes</span>
                    </div>
                    <textarea
                      className="text-area note-editor project-notes-field"
                      value={workspaceNoteDraft}
                      onChange={(event) => setWorkspaceNoteDraft(event.target.value)}
                      onBlur={() => setEditingWorkspaceNotesId(null)}
                      placeholder="Workspace notes"
                      autoFocus
                    />
                  </>
                ) : (
                  <>
                    <div className="kanban-column-header project-notes-title">
                      <span>Workspace notes</span>
                    </div>
                    <button
                      className="project-text-window note-editor project-notes-preview"
                      type="button"
                      onDoubleClick={() => setEditingWorkspaceNotesId(selectedWorkspace.id)}
                    >
                      <span className="project-notes-preview-text">
                        {workspaceNoteDraft || "Double-click to add workspace notes."}
                      </span>
                    </button>
                  </>
                )}
                <div className="project-context-footer">
                  <select
                    className={`note-status project-status-select project-status-${selectedWorkspace.archivedAt ? "archived" : "active"}`}
                    value={selectedWorkspace.archivedAt ? "archived" : "active"}
                    onChange={(event) =>
                      void runMutation(() =>
                        updateWorkspace({
                          id: selectedWorkspace.id,
                          title: selectedWorkspace.title,
                          description: selectedWorkspace.description,
                          noteMarkdown: selectedWorkspace.noteMarkdown,
                          archivedAt: event.target.value === "archived" ? new Date().toISOString() : null,
                        }),
                      )
                    }
                    disabled={busy}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </>
            ) : (
              <p className="muted">Select a workspace from the ribbon or use + to create one.</p>
            )}
          </aside>

          <div className="horizontal-scroll-frame horizontal-scroll-frame-strong">
            <button
              className="horizontal-scroll-arrow horizontal-scroll-arrow-left"
              type="button"
              aria-label="Scroll columns left"
              onMouseEnter={() => startHorizontalAutoScroll(workspaceProjectColumnsRef, -1)}
              onMouseLeave={stopHorizontalAutoScroll}
              onFocus={() => startHorizontalAutoScroll(workspaceProjectColumnsRef, -1)}
              onBlur={stopHorizontalAutoScroll}
            >
              ‹
            </button>
            <div
              ref={workspaceProjectColumnsRef}
              className="workspace-project-columns horizontal-scroll-surface horizontal-scroll-edge horizontal-scroll-edge-strong"
              aria-label="Workspace project status columns"
              onPointerDown={handleHorizontalPointerDown}
              onPointerMove={handleHorizontalPointerMove}
              onPointerUp={handleHorizontalPointerEnd}
              onPointerCancel={handleHorizontalPointerEnd}
              onClickCapture={handleHorizontalClickCapture}
            >
              {[
                { label: "Backlog", status: "backlog" as ProjectStatus, projects: backlogProjects },
                { label: "Active", status: "active" as ProjectStatus, projects: activeProjects },
                { label: "Completed", status: "completed" as ProjectStatus, projects: completedProjects },
                { label: "Archived", status: "archived" as ProjectStatus, projects: archivedProjects },
              ].map((column) => (
              <div
                className="kanban-column"
                key={column.status}
                onDragOver={handleDragOver}
                onDrop={(event) => void handleProjectDrop(event, column.status)}
              >
                <div className="kanban-column-header">
                  <span>{column.label}</span>
                  <strong>{column.projects.length}</strong>
                </div>
                <div className="kanban-task-list">
                  {column.projects.length ? (
                    column.projects.map((project) => (
                      <WorkspaceProjectCard
                        key={project.id}
                        project={project}
                        selected={project.id === selectedProject?.id}
                        disabled={busy}
                        onSelect={() => {
                          setSelectedProjectId(project.id);
                          setSelectedTaskId(project.tasks[0]?.id ?? null);
                          setActiveView("project");
                          setProjectCreateOpen(false);
                        }}
                        onStatusChange={(status) =>
                          void runMutation(() =>
                            updateProject({
                              id: project.id,
                              title: project.title,
                              status,
                              description: project.description,
                              noteMarkdown: project.noteMarkdown,
                            }),
                          )
                        }
                        onDelete={() => void runMutation(() => deleteProject(project.id))}
                        dragging={draggingId === project.id}
                        onDragStart={(event) => writeDragPayload(event, { type: "project", id: project.id }, project.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onDropBefore={(event) => void handleProjectDrop(event, column.status, project.id, getDropPosition(event))}
                      />
                    ))
                  ) : (
                    <p className="muted">No {column.label.toLowerCase()} projects.</p>
                  )}
                </div>
                {column.status === "backlog" || column.status === "active" ? (
                  <ColumnCreateControl
                    open={columnCreateTarget?.kind === "project" && columnCreateTarget.status === column.status}
                    label="Add project"
                    titleValue={projectDraft.title}
                    descriptionValue={projectDraft.description}
                    titlePlaceholder="Project title"
                    descriptionPlaceholder="Optional description"
                    disabled={busy}
                    onOpen={() => {
                      setColumnCreateTarget({
                        kind: "project",
                        status: column.status as Extract<ProjectStatus, "backlog" | "active">,
                      });
                      setProjectCreateOpen(false);
                      setProjectDraft(EMPTY_PROJECT_FORM);
                    }}
                    onTitleChange={(title) => setProjectDraft((current) => ({ ...current, title }))}
                    onDescriptionChange={(description) => setProjectDraft((current) => ({ ...current, description }))}
                    onCreate={() =>
                      void handleProjectSubmit(column.status as Extract<ProjectStatus, "backlog" | "active">, "workspace")
                    }
                    onCancel={() => {
                      setColumnCreateTarget(null);
                      setProjectDraft(EMPTY_PROJECT_FORM);
                    }}
                  />
                ) : null}
              </div>
              ))}
            </div>
            <button
              className="horizontal-scroll-arrow horizontal-scroll-arrow-right"
              type="button"
              aria-label="Scroll columns right"
              onMouseEnter={() => startHorizontalAutoScroll(workspaceProjectColumnsRef, 1)}
              onMouseLeave={stopHorizontalAutoScroll}
              onFocus={() => startHorizontalAutoScroll(workspaceProjectColumnsRef, 1)}
              onBlur={stopHorizontalAutoScroll}
            >
              ›
            </button>
          </div>
        </section>
      ) : null}

      {activeView === "project" ? (
        <div className="horizontal-scroll-frame horizontal-scroll-frame-strong project-view-scroll-frame">
          <button
            className="horizontal-scroll-arrow horizontal-scroll-arrow-left"
            type="button"
            aria-label="Scroll project board left"
            onMouseEnter={() => startHorizontalAutoScroll(projectViewShellRef, -1)}
            onMouseLeave={stopHorizontalAutoScroll}
            onFocus={() => startHorizontalAutoScroll(projectViewShellRef, -1)}
            onBlur={stopHorizontalAutoScroll}
          >
            ‹
          </button>
          <section
            ref={projectViewShellRef}
            className="project-view-shell horizontal-scroll-surface horizontal-scroll-edge horizontal-scroll-edge-strong"
            onPointerDown={handleHorizontalPointerDown}
            onPointerMove={handleHorizontalPointerMove}
            onPointerUp={handleHorizontalPointerEnd}
            onPointerCancel={handleHorizontalPointerEnd}
            onClickCapture={handleHorizontalClickCapture}
          >
          <aside className="project-column project-context-column">
            {selectedProject ? (
              <>
                <div className="project-context-header">
                  {editingProjectId === selectedProject.id ? (
                    <div className="project-title-edit">
                      <input
                        className="text-input"
                        value={projectForm.title}
                        onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Project name"
                        autoFocus
                      />
                      <button
                        className="ghost-button"
                        onClick={() =>
                          void runMutation(() =>
                            updateProject({
                          id: selectedProject.id,
                          title: projectForm.title || selectedProject.title,
                          status: selectedProject.status,
                          description: selectedProject.description ?? "",
                            }),
                          ).then(() => setEditingProjectId(null))
                        }
                        disabled={busy}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      className="kanban-column-header project-column-title"
                      type="button"
                      onDoubleClick={() => {
                        setEditingProjectId(selectedProject.id);
                        setProjectForm({
                          title: selectedProject.title,
                          description: selectedProject.description ?? "",
                        });
                      }}
                    >
                      <span>{selectedProject.title}</span>
                    </button>
                  )}
                  <button
                    className="project-delete-icon"
                    type="button"
                    title="Delete project"
                    aria-label="Delete project"
                    onClick={() => {
                      if (window.confirm(`Delete "${selectedProject.title}" and all of its tasks, notes, tabs, and checkpoints?`)) {
                        void runMutation(() => deleteProject(selectedProject.id));
                      }
                    }}
                    disabled={busy}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2l1 10h4l1-10h2l-1.2 12H8.2L7 9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                  {loading ? <span className="status-pill">Loading</span> : null}
                </div>
                <div className="kanban-column-header project-description-title">
                  <span>Project description</span>
                </div>
                {editingProjectDescriptionId === selectedProject.id ? (
                  <textarea
                    className="text-area note-editor project-description-field"
                    value={projectForm.description}
                    onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))}
                    onBlur={() => {
                      void runMutation(() =>
                        updateProject({
                          id: selectedProject.id,
                          title: selectedProject.title,
                          status: selectedProject.status,
                          description: projectForm.description,
                        }),
                      ).then(() => setEditingProjectDescriptionId(null));
                    }}
                    placeholder="Project description"
                    autoFocus
                  />
                ) : (
                  <button
                    className="project-text-window note-editor project-description-display"
                    type="button"
                    onDoubleClick={() => {
                      setEditingProjectDescriptionId(selectedProject.id);
                      setProjectForm({
                        title: selectedProject.title,
                        description: selectedProject.description ?? "",
                      });
                    }}
                  >
                    <span className="project-description-display-text">
                      {selectedProject.description || "Double-click to add a project description."}
                    </span>
                  </button>
                )}
                {editingProjectNotesId === selectedProject.id ? (
                  <>
                    <div className="kanban-column-header project-notes-title">
                      <span>Project notes</span>
                    </div>
                  <textarea
                    className="text-area note-editor project-notes-field"
                    value={projectNoteDraft}
                    onChange={(event) => setProjectNoteDraft(event.target.value)}
                    onBlur={() => setEditingProjectNotesId(null)}
                    placeholder="Project notes"
                    autoFocus
                  />
                  </>
                ) : (
                  <>
                    <div className="kanban-column-header project-notes-title">
                      <span>Project notes</span>
                    </div>
                  <button
                    className="project-text-window note-editor project-notes-preview"
                    type="button"
                    onDoubleClick={() => setEditingProjectNotesId(selectedProject.id)}
                  >
                    <span className="project-notes-preview-text">
                      {projectNoteDraft || "Double-click to add project notes."}
                    </span>
                  </button>
                  </>
                )}
                <div className="project-context-footer">
                  <select
                    className={`note-status project-status-select project-status-${selectedProjectStatus}`}
                    value={selectedProjectStatus}
                    onChange={(event) =>
                      void runMutation(() =>
                        updateProject({
                          id: selectedProject.id,
                          title: selectedProject.title,
                          status: event.target.value as ProjectStatus,
                          description: selectedProject.description,
                          noteMarkdown: selectedProject.noteMarkdown,
                        }),
                      )
                    }
                    disabled={busy}
                  >
                    <option value="backlog">Backlog</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </>
            ) : (
              <p className="muted">Select a project from the ribbon or use + to create one.</p>
            )}
          </aside>

          {selectedProject ? (
            <>
              <div className="kanban-column" onDragOver={handleDragOver} onDrop={(event) => void handleTaskDrop(event, "todo")}>
                  <div className="kanban-column-header">
                    <span>Backlog</span>
                    <strong>{backlogTasks.length}</strong>
                  </div>
                  <div className="kanban-task-list">
                    {backlogTasks.length ? (
                      backlogTasks.map((task) => (
                        <KanbanTaskCard
                          key={task.id}
                          task={task}
                          selected={task.id === selectedTask?.id}
                          activeTaskId={workspace?.activeTaskId}
                          disabled={busy}
                          onSelect={() => {
                            setSelectedTaskId(task.id);
                            setActiveView("task");
                            setEditingTaskId(null);
                          }}
                          onStatusChange={(status) =>
                            void runMutation(() =>
                              updateTask({
                                id: task.id,
                                title: task.title,
                                description: task.description,
                                status,
                                noteMarkdown: task.noteMarkdown,
                              }),
                            )
                          }
                          onDelete={() => void runMutation(() => deleteTask(task.id))}
                          dragging={draggingId === task.id}
                          onDragStart={(event) => writeDragPayload(event, { type: "task", id: task.id }, task.id)}
                          onDragEnd={() => setDraggingId(null)}
                          onDropBefore={(event) => void handleTaskDrop(event, "todo", task.id, getDropPosition(event))}
                        />
                      ))
                  ) : (
                    <p className="muted">No backlog tasks.</p>
                  )}
                  </div>
                  <ColumnCreateControl
                    open={columnCreateTarget?.kind === "task" && columnCreateTarget.status === "todo"}
                    label="Add task"
                    titleValue={taskDraft.title}
                    descriptionValue={taskDraft.description}
                    titlePlaceholder="Task title"
                    descriptionPlaceholder="Optional note"
                    disabled={busy}
                    onOpen={() => {
                      setColumnCreateTarget({ kind: "task", status: "todo" });
                      setProjectCreateOpen(false);
                      setTaskDraft({ ...EMPTY_TASK_FORM, status: "todo" });
                    }}
                    onTitleChange={(title) => setTaskDraft((current) => ({ ...current, title, status: "todo" }))}
                    onDescriptionChange={(description) => setTaskDraft((current) => ({ ...current, description }))}
                    onCreate={() => void handleTaskSubmit("todo")}
                    onCancel={() => {
                      setColumnCreateTarget(null);
                      setTaskDraft(EMPTY_TASK_FORM);
                    }}
                  />
                </div>

                <div className="kanban-column" onDragOver={handleDragOver} onDrop={(event) => void handleTaskDrop(event, "in_progress")}>
                  <div className="kanban-column-header">
                    <span>In progress</span>
                    <strong>{inProgressTasks.length}</strong>
                  </div>
                  <div className="kanban-task-list">
                    {inProgressTasks.length ? (
                      inProgressTasks.map((task) => (
                        <KanbanTaskCard
                          key={task.id}
                          task={task}
                          selected={task.id === selectedTask?.id}
                          activeTaskId={workspace?.activeTaskId}
                          disabled={busy}
                          onSelect={() => {
                            setSelectedTaskId(task.id);
                            setActiveView("task");
                            setEditingTaskId(null);
                          }}
                          onStatusChange={(status) =>
                            void runMutation(() =>
                              updateTask({
                                id: task.id,
                                title: task.title,
                                description: task.description,
                                status,
                                noteMarkdown: task.noteMarkdown,
                              }),
                            )
                          }
                          onDelete={() => void runMutation(() => deleteTask(task.id))}
                          dragging={draggingId === task.id}
                          onDragStart={(event) => writeDragPayload(event, { type: "task", id: task.id }, task.id)}
                          onDragEnd={() => setDraggingId(null)}
                          onDropBefore={(event) => void handleTaskDrop(event, "in_progress", task.id, getDropPosition(event))}
                        />
                      ))
                  ) : (
                    <p className="muted">Nothing in progress.</p>
                  )}
                  </div>
                  <ColumnCreateControl
                    open={columnCreateTarget?.kind === "task" && columnCreateTarget.status === "in_progress"}
                    label="Add task"
                    titleValue={taskDraft.title}
                    descriptionValue={taskDraft.description}
                    titlePlaceholder="Task title"
                    descriptionPlaceholder="Optional note"
                    disabled={busy}
                    onOpen={() => {
                      setColumnCreateTarget({ kind: "task", status: "in_progress" });
                      setProjectCreateOpen(false);
                      setTaskDraft({ ...EMPTY_TASK_FORM, status: "in_progress" });
                    }}
                    onTitleChange={(title) => setTaskDraft((current) => ({ ...current, title, status: "in_progress" }))}
                    onDescriptionChange={(description) => setTaskDraft((current) => ({ ...current, description }))}
                    onCreate={() => void handleTaskSubmit("in_progress")}
                    onCancel={() => {
                      setColumnCreateTarget(null);
                      setTaskDraft(EMPTY_TASK_FORM);
                    }}
                  />
                </div>

                <div className="kanban-column" onDragOver={handleDragOver} onDrop={(event) => void handleTaskDrop(event, "done")}>
                  <div className="kanban-column-header">
                    <span>Done</span>
                    <strong>{doneTasks.length}</strong>
                  </div>
                  <div className="kanban-task-list">
                    {doneTasks.length ? (
                      doneTasks.map((task) => (
                        <KanbanTaskCard
                          key={task.id}
                          task={task}
                          selected={task.id === selectedTask?.id}
                          activeTaskId={workspace?.activeTaskId}
                          disabled={busy}
                          onSelect={() => {
                            setSelectedTaskId(task.id);
                            setActiveView("task");
                            setEditingTaskId(null);
                          }}
                          onStatusChange={(status) =>
                            void runMutation(() =>
                              updateTask({
                                id: task.id,
                                title: task.title,
                                description: task.description,
                                status,
                                noteMarkdown: task.noteMarkdown,
                              }),
                            )
                          }
                          onDelete={() => void runMutation(() => deleteTask(task.id))}
                          dragging={draggingId === task.id}
                          onDragStart={(event) => writeDragPayload(event, { type: "task", id: task.id }, task.id)}
                          onDragEnd={() => setDraggingId(null)}
                          onDropBefore={(event) => void handleTaskDrop(event, "done", task.id, getDropPosition(event))}
                        />
                      ))
                    ) : (
                      <p className="muted">No completed tasks.</p>
                    )}
                  </div>
                </div>
            </>
          ) : (
            <section className="kanban-empty-state">
              <p className="muted">Create a project to start shaping the workspace.</p>
            </section>
          )}
        </section>
          <button
            className="horizontal-scroll-arrow horizontal-scroll-arrow-right"
            type="button"
            aria-label="Scroll project board right"
            onMouseEnter={() => startHorizontalAutoScroll(projectViewShellRef, 1)}
            onMouseLeave={stopHorizontalAutoScroll}
            onFocus={() => startHorizontalAutoScroll(projectViewShellRef, 1)}
            onBlur={stopHorizontalAutoScroll}
          >
            ›
          </button>
        </div>
      ) : activeView === "task" ? (
        <section className="task-board-shell">
          <aside className="project-column project-context-column task-context-column">
            {selectedTask ? (
              <>
                <div className="project-context-header">
                  {editingTaskId === selectedTask.id ? (
                    <div className="project-title-edit">
                      <input
                        className="text-input"
                        value={taskForm.title}
                        onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Task title"
                        autoFocus
                      />
                      <button
                        className="ghost-button"
                        onClick={() =>
                          void runMutation(() =>
                            updateTask({
                              id: selectedTask.id,
                              title: taskForm.title || selectedTask.title,
                              description: selectedTask.description,
                              status: selectedTask.status,
                              noteMarkdown: selectedTask.noteMarkdown,
                            }),
                          ).then(() => setEditingTaskId(null))
                        }
                        disabled={busy}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      className="kanban-column-header project-column-title"
                      type="button"
                      onDoubleClick={() => {
                        setEditingTaskId(selectedTask.id);
                        setTaskForm({
                          title: selectedTask.title,
                          description: selectedTask.description ?? "",
                          status: selectedTask.status,
                        });
                      }}
                    >
                      <span>{selectedTask.title}</span>
                    </button>
                  )}
                  <button
                    className="project-delete-icon"
                    type="button"
                    title="Delete task"
                    aria-label="Delete task"
                    onClick={() => {
                      if (window.confirm(`Delete "${selectedTask.title}" and all of its notes, tabs, and sessions?`)) {
                        void runMutation(() => deleteTask(selectedTask.id));
                      }
                    }}
                    disabled={busy}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2l1 10h4l1-10h2l-1.2 12H8.2L7 9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>

                <div className="kanban-column-header project-description-title">
                  <span>Task description</span>
                </div>
                {editingTaskDescriptionId === selectedTask.id ? (
                  <textarea
                    className="text-area note-editor project-description-field"
                    value={taskForm.description}
                    onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                    onBlur={() => {
                      void runMutation(() =>
                        updateTask({
                          id: selectedTask.id,
                          title: selectedTask.title,
                          description: taskForm.description,
                          status: selectedTask.status,
                          noteMarkdown: selectedTask.noteMarkdown,
                        }),
                      ).then(() => setEditingTaskDescriptionId(null));
                    }}
                    placeholder="Task description"
                    autoFocus
                  />
                ) : (
                  <button
                    className="project-text-window note-editor project-description-display"
                    type="button"
                    onDoubleClick={() => {
                      setEditingTaskDescriptionId(selectedTask.id);
                      setTaskForm({
                        title: selectedTask.title,
                        description: selectedTask.description ?? "",
                        status: selectedTask.status,
                      });
                    }}
                  >
                    <span className="project-description-display-text">
                      {selectedTask.description || "Double-click to add a task description."}
                    </span>
                  </button>
                )}

                {editingTaskNotesId === selectedTask.id ? (
                  <>
                    <div className="kanban-column-header project-notes-title">
                      <span>Task notes</span>
                    </div>
                    <textarea
                      className="text-area note-editor project-notes-field"
                      value={taskNoteDraft}
                      onChange={(event) => setTaskNoteDraft(event.target.value)}
                      onBlur={() => setEditingTaskNotesId(null)}
                      placeholder="Task notes"
                      autoFocus
                    />
                  </>
                ) : (
                  <>
                    <div className="kanban-column-header project-notes-title">
                      <span>Task notes</span>
                    </div>
                    <button
                      className="project-text-window note-editor project-notes-preview"
                      type="button"
                      onDoubleClick={() => setEditingTaskNotesId(selectedTask.id)}
                    >
                      <span className="project-notes-preview-text">
                        {taskNoteDraft || "Double-click to add task notes."}
                      </span>
                    </button>
                  </>
                )}

                <div className="project-context-footer">
                  <select
                    className={`note-status project-status-select project-status-${selectedTaskStatusVisual}`}
                    value={selectedTask.status}
                    onChange={(event) =>
                      void runMutation(() =>
                        updateTask({
                          id: selectedTask.id,
                          title: selectedTask.title,
                          description: selectedTask.description,
                          status: event.target.value as TaskStatus,
                          noteMarkdown: selectedTask.noteMarkdown,
                        }),
                      )
                    }
                    disabled={busy}
                  >
                    <option value="todo">Backlog</option>
                    <option value="in_progress">In progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </>
            ) : (
              <p className="muted">Select a task from the ribbon or the project board.</p>
            )}
          </aside>

          <div className="horizontal-scroll-frame horizontal-scroll-frame-strong">
            <button
              className="horizontal-scroll-arrow horizontal-scroll-arrow-left"
              type="button"
              aria-label="Scroll sessions left"
              onMouseEnter={() => startHorizontalAutoScroll(taskSessionColumnsRef, -1)}
              onMouseLeave={stopHorizontalAutoScroll}
              onFocus={() => startHorizontalAutoScroll(taskSessionColumnsRef, -1)}
              onBlur={stopHorizontalAutoScroll}
            >
              ‹
            </button>
            <div
              ref={taskSessionColumnsRef}
              className="task-session-columns horizontal-scroll-surface horizontal-scroll-edge horizontal-scroll-edge-strong"
              aria-label="Task session columns"
              onPointerDown={handleHorizontalPointerDown}
              onPointerMove={handleHorizontalPointerMove}
              onPointerUp={handleHorizontalPointerEnd}
              onPointerCancel={handleHorizontalPointerEnd}
              onClickCapture={handleHorizontalClickCapture}
            >
              {selectedTask ? (
                taskSessionColumns.map((session) => (
                  <TaskSessionColumn
                    key={session.id}
                    title={session.title}
                    state={session.state}
                    activeAt={getSessionActivityAt(session)}
                    tabs={session.tabs}
                    selected={session.id === workspace?.activeSessionId}
                    disabled={busy || selectedTask.status === "done"}
                    onOpen={() => {
                      setSelectedSessionId(session.id);
                      setSelectedCheckpointId(session.checkpointId ?? null);
                      setActiveView("session");
                      setProjectCreateOpen(false);
                    }}
                    onActivate={session.state === "open" ? () => void handleSetActiveSession(session.id) : undefined}
                    onAttachCurrentWindow={session.state !== "archived" ? () => void handleAttachCurrentWindow(session.id) : undefined}
                    onClose={session.state === "active" || session.state === "open" ? () => void handleArchiveTaskSession(session.id) : undefined}
                    onArchive={session.state === "closed" ? () => void runMutation(() => updateTaskSessionState({ sessionId: session.id, state: "archived" })) : undefined}
                    onRestore={session.state === "closed" || session.state === "archived" ? () => void runMutation(() => restoreTaskSession(session.id)) : undefined}
                    onDelete={() => void handleDeleteTaskSession(session.id)}
                    draggingId={draggingId}
                    onColumnDragOver={handleDragOver}
                    onColumnDrop={(event) => void handleSessionTabDrop(event, session.id)}
                    onTabDragStart={(event, tabId) => writeDragPayload(event, { type: "session-tab", sessionId: session.id, tabId }, tabId)}
                    onTabDragEnd={() => setDraggingId(null)}
                    onTabDropBefore={(event, tabId) => void handleSessionTabDrop(event, session.id, tabId)}
                    onRemoveTab={(tabId) => void handleRemoveSessionTab(tabId, session.id)}
                  />
                ))
              ) : (
                <section className="kanban-empty-state">
                  <p className="muted">Select a task to inspect its sessions.</p>
                </section>
              )}
            </div>
            <button
              className="horizontal-scroll-arrow horizontal-scroll-arrow-right"
              type="button"
              aria-label="Scroll sessions right"
              onMouseEnter={() => startHorizontalAutoScroll(taskSessionColumnsRef, 1)}
              onMouseLeave={stopHorizontalAutoScroll}
              onFocus={() => startHorizontalAutoScroll(taskSessionColumnsRef, 1)}
              onBlur={stopHorizontalAutoScroll}
            >
              ›
            </button>
          </div>
        </section>
      ) : activeView === "session" ? (
        <section className="session-view-shell">
          {selectedTask ? (
            <>
              <aside className="session-info-column project-context-pane stack-md">
                <div className="pane-header session-pane-header">
                  <div>
                    <span className="eyebrow">Session</span>
                    <h2>{selectedSession?.title ?? selectedTask.title}</h2>
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setCheckpointNameOpen((current) => !current)}
                    disabled={busy || selectedTask.status === "done" || !selectedSession}
                  >
                    Save checkpoint
                  </button>
                  {checkpointNameOpen ? (
                    <div className="compact-popover session-checkpoint-popover stack-sm">
                      <span className="eyebrow">Checkpoint</span>
                      <input
                        className="text-input"
                        value={checkpointTitle}
                        onChange={(event) => setCheckpointTitle(event.target.value)}
                        placeholder="Optional checkpoint name"
                        autoFocus
                      />
                      <div className="toolbar-actions">
                        <button className="primary-button" type="button" onClick={() => void handleCreateCheckpoint()} disabled={busy}>
                          Save
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setCheckpointNameOpen(false);
                            setCheckpointTitle("");
                          }}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="kanban-column-header project-description-title">
                  <span>Session description</span>
                </div>
                {selectedSession && editingSessionDescriptionId === selectedSession.id ? (
                  <textarea
                    className="text-area note-editor project-description-field"
                    value={taskForm.description}
                    onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                    onBlur={() => {
                      void runMutation(() =>
                        updateTaskSession({
                          id: selectedSession.id,
                          title: selectedSession.title,
                          description: taskForm.description,
                          noteMarkdown: selectedSession.noteMarkdown,
                        }),
                      ).then(() => setEditingSessionDescriptionId(null));
                    }}
                    placeholder="Session description"
                    autoFocus
                  />
                ) : (
                  <button
                    className="project-text-window note-editor project-description-display"
                    type="button"
                    onDoubleClick={() => {
                      if (!selectedSession) {
                        return;
                      }
                      setEditingSessionDescriptionId(selectedSession.id);
                      setTaskForm({
                        title: selectedTask.title,
                        description: selectedSession.description ?? "",
                        status: selectedTask.status,
                      });
                    }}
                  >
                    <span className="project-description-display-text">
                      {selectedSession?.description || "Double-click to add a session description."}
                    </span>
                  </button>
                )}

                {selectedSession && editingSessionNotesId === selectedSession.id ? (
                  <>
                    <div className="kanban-column-header project-notes-title">
                      <span>Session notes</span>
                    </div>
                    <textarea
                      className="text-area note-editor project-notes-field"
                      value={sessionNoteDraft}
                      onChange={(event) => setSessionNoteDraft(event.target.value)}
                      onBlur={() => setEditingSessionNotesId(null)}
                      placeholder="Session notes"
                      autoFocus
                    />
                  </>
                ) : (
                  <>
                    <div className="kanban-column-header project-notes-title">
                      <span>Session notes</span>
                    </div>
                    <button
                      className="project-text-window note-editor project-notes-preview"
                      type="button"
                      onDoubleClick={() => selectedSession && setEditingSessionNotesId(selectedSession.id)}
                    >
                      <span className="project-notes-preview-text">
                        {sessionNoteDraft || "Double-click to add session notes."}
                      </span>
                    </button>
                  </>
                )}

                {selectedSession ? (
                  <div className="project-context-footer">
                    <select
                      className={`note-status project-status-select project-status-${selectedSessionStatusVisual}`}
                      value={selectedSession.state}
                      onChange={(event) => {
                        const nextState = event.target.value as SessionState;
                        if (nextState === "active") {
                          void handleSetActiveSession(selectedSession.id);
                          return;
                        }
                        void runMutation(() =>
                          updateTaskSessionState({
                            sessionId: selectedSession.id,
                            state: nextState as Extract<SessionState, "open" | "closed" | "archived">,
                          }),
                        );
                      }}
                      disabled={busy}
                    >
                      <option value="active">Active</option>
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                ) : null}
              </aside>

              <div className="horizontal-scroll-frame horizontal-scroll-frame-strong">
                <button
                  className="horizontal-scroll-arrow horizontal-scroll-arrow-left"
                  type="button"
                  aria-label="Scroll session view left"
                  onMouseEnter={() => startHorizontalAutoScroll(sessionColumnsRef, -1)}
                  onMouseLeave={stopHorizontalAutoScroll}
                  onFocus={() => startHorizontalAutoScroll(sessionColumnsRef, -1)}
                  onBlur={stopHorizontalAutoScroll}
                >
                  ‹
                </button>
                <section
                  ref={sessionColumnsRef}
                  className="session-island horizontal-scroll-surface horizontal-scroll-edge horizontal-scroll-edge-strong"
                  aria-label="Session comparison columns"
                  onPointerDown={handleHorizontalPointerDown}
                  onPointerMove={handleHorizontalPointerMove}
                  onPointerUp={handleHorizontalPointerEnd}
                  onPointerCancel={handleHorizontalPointerEnd}
                  onClickCapture={handleHorizontalClickCapture}
                >
                  <section className="kanban-column session-column session-timeline-column">
                    <div className="kanban-column-header">
                      <span>Timeline</span>
                      <strong>{sessionTimeline.length}</strong>
                    </div>
                    <div className="session-column-scroll">
                      {sessionTimeline.length ? (
                        sessionTimeline.map((checkpoint) => (
                          <div key={checkpoint.id} className="task-session-tab-shell">
                            <button
                              className={`session-checkpoint-card ${selectedCheckpoint?.id === checkpoint.id ? "task-session-open-selected" : ""}`}
                              type="button"
                              onClick={() => {
                                setSelectedCheckpointId(checkpoint.id);
                                setSelectedSessionTab(null);
                              }}
                            >
                              <span className="browser-tab-copy">
                                <strong>{formatCheckpointTitle(checkpoint.title, checkpoint.createdAt)}</strong>
                                {checkpoint.title ? <span>{formatTimestamp(checkpoint.createdAt)}</span> : null}
                                <span>{checkpoint.tabCount} tabs captured</span>
                              </span>
                            </button>
                            <button
                              className="task-session-tab-delete session-card-action"
                              type="button"
                              aria-label={`Restore ${formatCheckpointTitle(checkpoint.title, checkpoint.createdAt)}`}
                              title="Restore checkpoint"
                              onClick={() => void runMutation(() => restoreCheckpoint(checkpoint.id))}
                              disabled={busy}
                            >
                              ↻
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="muted">No checkpoints yet.</p>
                      )}
                    </div>
                  </section>

                  <section className="kanban-column session-column">
                    <div className="kanban-column-header">
                      <span>Checkpoint tabs</span>
                      <button
                        className="session-count-action"
                        type="button"
                        aria-label="Restore checkpoint"
                        title="Restore checkpoint"
                        onClick={() => selectedCheckpoint && void runMutation(() => restoreCheckpoint(selectedCheckpoint.id))}
                        disabled={!selectedCheckpoint || busy}
                      >
                        <span className="session-count-value">{selectedCheckpoint?.tabCount ?? 0}</span>
                        <span className="session-count-restore">↻</span>
                      </button>
                    </div>
                    <div className="session-column-scroll">
                      {selectedCheckpoint?.sessionTabs.length ? (
                        selectedCheckpoint.sessionTabs.map((tab, index) => (
                          <SessionTabButton
                            key={tab.id}
                            tab={tab}
                            index={index}
                            selected={selectedSessionTab?.source === "checkpoint" && selectedSessionTab.tabId === tab.id}
                            onClick={() => setSelectedSessionTab({ source: "checkpoint", tabId: tab.id })}
                          />
                        ))
                      ) : (
                        <p className="muted">Select a checkpoint to inspect its tabs.</p>
                      )}
                    </div>
                  </section>

                  <section
                    className="kanban-column session-column"
                    onDragOver={handleDragOver}
                    onDrop={(event) => selectedSession && void handleSessionTabDrop(event, selectedSession.id)}
                  >
                    <div className="kanban-column-header">
                      <span>Current session</span>
                      <button
                        className="session-count-action"
                        type="button"
                        aria-label="Restore current session"
                        title="Restore current session"
                        onClick={() => selectedSession && void runMutation(() => restoreTaskSession(selectedSession.id))}
                        disabled={!selectedSession || busy}
                      >
                        <span className="session-count-value">{selectedSession?.tabCount ?? 0}</span>
                        <span className="session-count-restore">↻</span>
                      </button>
                    </div>
                    <div className="session-column-scroll">
                      {selectedSession?.tabs.length ? (
                        selectedSession.tabs.map((tab, index) => (
                          <div key={tab.id} className="task-session-tab-shell">
                            <SessionTabButton
                              tab={tab}
                              index={index}
                              selected={selectedSessionTab?.source === "current" && selectedSessionTab.tabId === tab.id}
                              onClick={() => setSelectedSessionTab({ source: "current", tabId: tab.id })}
                            />
                            <button
                              className="task-session-tab-delete"
                              type="button"
                              aria-label={`Remove ${tab.title}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRemoveSessionTab(tab.id, selectedSession.id, true);
                              }}
                              disabled={busy || selectedTask.status === "done"}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="muted">No tabs attached yet.</p>
                      )}
                    </div>
                  </section>

                  <section className="kanban-column session-column session-notes-column">
                    <div className="kanban-column-header">
                      <span>Notes</span>
                    </div>
                    {selectedSessionTabDetails ? (
                      <div className="session-notes-content stack-sm">
                        <strong className="session-notes-tab-title">{selectedSessionTabDetails.title}</strong>
                        {selectedSessionTab?.source === "current" ? (
                          <textarea
                            className="text-area note-editor session-tab-note-editor"
                            value={sessionTabNoteDraft}
                            onChange={(event) => setSessionTabNoteDraft(event.target.value)}
                            placeholder="Tab notes"
                            disabled={busy || selectedTask.status === "done"}
                          />
                        ) : selectedSessionTabDetails.noteMarkdown ? (
                          <pre className="note-preview">{selectedSessionTabDetails.noteMarkdown}</pre>
                        ) : (
                          <p className="muted">No notes were saved with this checkpoint tab.</p>
                        )}
                      </div>
                    ) : (
                      <p className="muted">Select a tab to view its notes.</p>
                    )}
                  </section>
                </section>
                <button
                  className="horizontal-scroll-arrow horizontal-scroll-arrow-right"
                  type="button"
                  aria-label="Scroll session view right"
                  onMouseEnter={() => startHorizontalAutoScroll(sessionColumnsRef, 1)}
                  onMouseLeave={stopHorizontalAutoScroll}
                  onFocus={() => startHorizontalAutoScroll(sessionColumnsRef, 1)}
                  onBlur={stopHorizontalAutoScroll}
                >
                  ›
                </button>
              </div>
            </>
          ) : (
            <section className="kanban-empty-state">
              <p className="muted">Select a task before working with sessions.</p>
            </section>
          )}
        </section>
      ) : null}
    </main>
  );
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function formatCheckpointTitle(title: string | undefined, createdAt: string) {
  return title?.trim() || formatTimestamp(createdAt);
}

function getSessionStatusVisual(state?: SessionState) {
  if (state === "active") {
    return "active";
  }
  if (state === "open") {
    return "backlog";
  }
  if (state === "closed") {
    return "completed";
  }
  return "archived";
}

function compareSessionsForRibbon(
  left: { state: SessionState; updatedAt: string; lastActiveAt?: string; createdAt: string },
  right: { state: SessionState; updatedAt: string; lastActiveAt?: string; createdAt: string },
) {
  const rank = (state: SessionState) => (state === "active" ? 0 : state === "open" ? 1 : state === "closed" ? 2 : 3);
  return rank(left.state) - rank(right.state) || getSessionActivityAt(right).localeCompare(getSessionActivityAt(left));
}

function getBrowserTabKey(tab: Pick<SessionTab, "url" | "title"> | chrome.tabs.Tab) {
  return `${tab.url ?? ""}::${tab.title ?? ""}`;
}

function getSessionActivityAt(session: { lastActiveAt?: string; updatedAt: string; createdAt: string }) {
  return session.lastActiveAt ?? session.updatedAt ?? session.createdAt;
}

function groupBrowserTabsByAssignment(
  tabs: chrome.tabs.Tab[],
  getTabAssignment: (tab: chrome.tabs.Tab) => { sessionId: string; sessionTitle: string; taskTitle: string } | undefined,
) {
  const groups: Array<{
    assignment?: { sessionId: string; sessionTitle: string; taskTitle: string };
    tabs: chrome.tabs.Tab[];
  }> = [];

  tabs.forEach((tab) => {
    const assignment = getTabAssignment(tab);
    const lastGroup = groups[groups.length - 1];
    if (assignment && lastGroup?.assignment?.sessionId === assignment.sessionId) {
      lastGroup.tabs.push(tab);
      return;
    }
    if (!assignment && lastGroup && !lastGroup.assignment) {
      lastGroup.tabs.push(tab);
      return;
    }
    groups.push({ assignment, tabs: [tab] });
  });

  return groups;
}

function BrowserWindowRail({
  windows,
  selectedWindowId,
  pinned,
  onPinnedChange,
  onSelectWindow,
  onSelectTab,
  getTabAssignment,
  onTabDragStart,
  onTabDragEnd,
}: {
  windows: BrowserWindowSummary[];
  selectedWindowId: number | null;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  onSelectWindow: (windowId: number) => void;
  onSelectTab: (tab: chrome.tabs.Tab) => void;
  getTabAssignment: (tab: chrome.tabs.Tab) => { sessionId: string; sessionTitle: string; taskTitle: string } | undefined;
  onTabDragStart: (event: DragEvent<HTMLElement>, tab: chrome.tabs.Tab) => void;
  onTabDragEnd: () => void;
}) {
  const selectedWindow = windows.find((window) => window.id === selectedWindowId) ?? windows[0] ?? null;
  const tabGroups = groupBrowserTabsByAssignment(selectedWindow?.tabs ?? [], getTabAssignment);

  return (
    <aside className={`browser-window-rail ${pinned ? "browser-window-rail-pinned" : ""}`} aria-label="Browser windows">
      <div className="browser-window-strip">
        {windows.map((window, index) => (
          <button
            key={window.id}
            className={`browser-window-chip ${window.id === selectedWindow?.id ? "browser-window-chip-active" : ""}`}
            type="button"
            title={`Window ${index + 1}`}
            onClick={() => onSelectWindow(window.id)}
          >
            <span className="browser-window-dot-row">
              <span />
              <span />
              <span />
            </span>
            <strong>{window.tabs.length}</strong>
          </button>
        ))}
      </div>

      <div className="browser-window-panel">
        <div className="browser-window-panel-header">
          <span className="muted">{selectedWindow ? `${selectedWindow.tabs.length} tabs` : "No windows"}</span>
          <button
            className={`browser-window-pin-button ${pinned ? "browser-window-pin-button-active" : ""}`}
            type="button"
            aria-label={pinned ? "Unpin browser rail" : "Pin browser rail"}
            title={pinned ? "Unpin rail" : "Pin rail"}
            onClick={() => onPinnedChange(!pinned)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
              {pinned ? (
                <path
                  d="M8.5 3 21 15.5 19.6 17l-3.4-3.4-3 3v4.9h-2.4v-4.9l-4.5-4.5H4.8l3.8-3.8-1.5-1.5L8.5 3Zm2.2 5.5L8.6 10.6h1l3.6 3.6 1.3-1.3-3.8-4.4ZM3.8 2.4 21.6 20.2 20.2 21.6 2.4 3.8 3.8 2.4Z"
                  fill="currentColor"
                />
              ) : (
                <path
                  d="M8.5 3h7l-1.2 5.2 4 4V14h-5.1v7.5h-2.4V14H5.7v-1.8l4-4L8.5 3Zm2.9 2 1 4.1L9.5 12h5l-2.9-2.9 1-4.1h-1.2Z"
                  fill="currentColor"
                />
              )}
            </svg>
          </button>
        </div>

        <div className="browser-tab-list">
          {tabGroups.length ? (
            tabGroups.map((group) =>
              group.assignment ? (
                <div className="browser-tab-assignment-group" key={`${group.assignment.sessionId}-${group.tabs[0]?.id ?? group.tabs[0]?.url}`}>
                  <span className="browser-tab-assignment-label">{group.assignment.sessionTitle}</span>
                  {group.tabs.map((tab) => (
                    <BrowserTabRailButton
                      key={tab.id ?? `${tab.windowId}-${tab.index}`}
                      tab={tab}
                      assigned
                      onSelectTab={onSelectTab}
                      onTabDragStart={onTabDragStart}
                      onTabDragEnd={onTabDragEnd}
                    />
                  ))}
                </div>
              ) : (
                group.tabs.map((tab) => (
                  <BrowserTabRailButton
                    key={tab.id ?? `${tab.windowId}-${tab.index}`}
                    tab={tab}
                    assigned={false}
                    onSelectTab={onSelectTab}
                    onTabDragStart={onTabDragStart}
                    onTabDragEnd={onTabDragEnd}
                  />
                ))
              ),
            )
          ) : (
            <p className="muted">No tabs in this window.</p>
          )}
        </div>
      </div>
    </aside>
  );
}

function BrowserTabRailButton({
  tab,
  assigned,
  onSelectTab,
  onTabDragStart,
  onTabDragEnd,
}: {
  tab: chrome.tabs.Tab;
  assigned: boolean;
  onSelectTab: (tab: chrome.tabs.Tab) => void;
  onTabDragStart: (event: DragEvent<HTMLElement>, tab: chrome.tabs.Tab) => void;
  onTabDragEnd: () => void;
}) {
  return (
              <button
      className={`browser-tab-row ${tab.active ? "browser-tab-row-active" : ""} ${assigned ? "browser-tab-row-assigned" : ""}`}
                type="button"
                draggable={Boolean(tab.url && tab.title)}
                onDragStart={(event) => onTabDragStart(event, tab)}
                onDragEnd={onTabDragEnd}
      onClick={() => onSelectTab(tab)}
    >
      {tab.favIconUrl ? (
        <img className="browser-tab-icon" src={tab.favIconUrl} alt="" />
      ) : (
        <span className="browser-tab-icon browser-tab-icon-fallback">{getTabInitial(tab.title)}</span>
      )}
      <span className="browser-tab-copy">
        <strong>{tab.title ?? "Untitled"}</strong>
        <span>{formatTabUrl(tab.url)}</span>
      </span>
    </button>
  );
}

function getTabInitial(title?: string) {
  return title?.trim().charAt(0).toUpperCase() || "?";
}

function formatTabUrl(url?: string) {
  if (!url) {
    return "No URL";
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname || parsed.href;
  } catch {
    return url;
  }
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-block">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ColumnCreateControl({
  open,
  label,
  titleValue,
  descriptionValue,
  titlePlaceholder,
  descriptionPlaceholder,
  disabled,
  onOpen,
  onTitleChange,
  onDescriptionChange,
  onCreate,
  onCancel,
}: {
  open: boolean;
  label: string;
  titleValue: string;
  descriptionValue: string;
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  disabled: boolean;
  onOpen: () => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  if (open) {
    return (
      <div className="column-create-form stack-sm">
        <input
          className="text-input"
          value={titleValue}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={titlePlaceholder}
          autoFocus
        />
        <input
          className="text-input"
          value={descriptionValue}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={descriptionPlaceholder}
        />
        <div className="toolbar-actions">
          <button className="primary-button" type="button" onClick={onCreate} disabled={disabled}>
            Create
          </button>
          <button className="ghost-button" type="button" onClick={onCancel} disabled={disabled}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button className="column-create-trigger" type="button" onClick={onOpen} disabled={disabled} aria-label={label}>
      <span>+</span>
    </button>
  );
}

function ProjectCard({
  project,
  selected,
  activeTaskId,
  onSelect,
}: {
  project: WorkspaceProjectSummary;
  selected: boolean;
  activeTaskId?: string;
  onSelect: () => void;
}) {
  const activeTask = project.tasks.find((task) => task.id === activeTaskId);
  const totalTabs = project.tasks.reduce((sum, task) => sum + task.sessionTabCount, 0);

  return (
    <button className={`entity-card project-card-v2 ${selected ? "entity-card-active" : ""}`} onClick={onSelect}>
      <strong>{project.title}</strong>
      <span>{project.tasks.length} tasks</span>
      <span>{totalTabs} saved tabs</span>
      <span>{activeTask ? `Active: ${activeTask.title}` : "No active task here"}</span>
    </button>
  );
}

function WorkspaceProjectCard({
  project,
  selected,
  disabled,
  dragging,
  onSelect,
  onStatusChange,
  onDelete,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  project: WorkspaceProjectSummary;
  selected: boolean;
  disabled: boolean;
  dragging: boolean;
  onSelect: () => void;
  onStatusChange: (status: ProjectStatus) => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDropBefore: (event: DragEvent<HTMLElement>) => void;
}) {
  const statusValue = project.status ?? "backlog";
  const activeTaskCount = project.tasks.filter((task) => task.status !== "done").length;
  const totalTabs = project.tasks.reduce((sum, task) => sum + task.sessionTabCount, 0);

  return (
    <article
      className={`kanban-task-card workspace-project-card workspace-project-card-${statusValue} ${
        selected ? "kanban-task-card-selected" : ""
      } ${
        statusValue === "completed" || statusValue === "archived" ? "kanban-task-card-complete" : ""
      } ${dragging ? "drag-card-active" : ""}`}
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={onDropBefore}
    >
      <button
        className="kanban-task-card-main"
        type="button"
        draggable={!disabled}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={onDropBefore}
        onClick={onSelect}
      >
        <span className="browser-tab-icon browser-tab-icon-fallback kanban-task-icon">{getTabInitial(project.title)}</span>
        <span className="browser-tab-copy kanban-task-copy">
          <strong>{project.title}</strong>
          <span>{project.description ?? statusValue}</span>
          <span>
            {project.tasks.length} tasks | {activeTaskCount} open | {totalTabs} tabs
          </span>
        </span>
      </button>
      <details className="kanban-task-menu">
        <summary aria-label={`Project actions for ${project.title}`}>⋮</summary>
        <div className="kanban-task-menu-popover workspace-project-menu-popover">
          <button
            type="button"
            onClick={() => onStatusChange("backlog")}
            disabled={disabled || statusValue === "backlog"}
          >
            Move to backlog
          </button>
          <button type="button" onClick={() => onStatusChange("active")} disabled={disabled || statusValue === "active"}>
            Move to active
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("completed")}
            disabled={disabled || statusValue === "completed"}
          >
            Move to completed
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("archived")}
            disabled={disabled || statusValue === "archived"}
          >
            Move to archived
          </button>
          <button className="danger-menu-item" type="button" onClick={onDelete} disabled={disabled}>
            Delete project
          </button>
        </div>
      </details>
    </article>
  );
}

function KanbanTaskCard({
  task,
  activeTaskId,
  selected,
  disabled,
  dragging,
  onSelect,
  onStatusChange,
  onDelete,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  task: WorkspaceTaskSummary;
  activeTaskId?: string;
  selected: boolean;
  disabled: boolean;
  dragging: boolean;
  onSelect: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDropBefore: (event: DragEvent<HTMLElement>) => void;
}) {
  const statusValue = task.status === "blocked" ? "todo" : task.status;

  return (
    <article
      className={`kanban-task-card ${selected ? "kanban-task-card-selected" : ""} ${
        task.status === "done" ? "kanban-task-card-complete" : ""
      } ${dragging ? "drag-card-active" : ""}`}
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={onDropBefore}
    >
      <button
        className="kanban-task-card-main"
        type="button"
        draggable={!disabled}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={onDropBefore}
        onClick={onSelect}
      >
        <span className="browser-tab-icon browser-tab-icon-fallback kanban-task-icon">{getTabInitial(task.title)}</span>
        <span className="browser-tab-copy kanban-task-copy">
          <strong>{task.title}</strong>
          {activeTaskId === task.id ? <span className="status-pill project-status-active">Active</span> : null}
          <span>{task.description ?? task.status.replace("_", " ")}</span>
          <span>
            {task.sessionTabCount} tabs | {task.checkpointCount} checkpoints
          </span>
        </span>
      </button>
      <details className="kanban-task-menu">
        <summary aria-label={`Task actions for ${task.title}`}>⋮</summary>
        <div className="kanban-task-menu-popover">
          <button type="button" onClick={() => onStatusChange("todo")} disabled={disabled || statusValue === "todo"}>
            Move to backlog
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("in_progress")}
            disabled={disabled || statusValue === "in_progress"}
          >
            Move to in progress
          </button>
          <button type="button" onClick={() => onStatusChange("done")} disabled={disabled || statusValue === "done"}>
            Move to done
          </button>
          <button className="danger-menu-item" type="button" onClick={onDelete} disabled={disabled}>
            Delete task
          </button>
        </div>
      </details>
    </article>
  );
}

function TaskSessionColumn({
  title,
  state,
  activeAt,
  tabs,
  selected,
  disabled,
  onOpen,
  onActivate,
  onAttachCurrentWindow,
  onClose,
  onArchive,
  onRestore,
  onDelete,
  draggingId,
  onColumnDragOver,
  onColumnDrop,
  onTabDragStart,
  onTabDragEnd,
  onTabDropBefore,
  onRemoveTab,
}: {
  title?: string;
  state: "open" | "closed" | "active" | "archived";
  activeAt: string;
  tabs: SessionTab[];
  selected: boolean;
  disabled: boolean;
  onOpen: () => void;
  onActivate?: () => void;
  onAttachCurrentWindow?: () => void;
  onClose?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete: () => void;
  draggingId: string | null;
  onColumnDragOver: (event: DragEvent<HTMLElement>) => void;
  onColumnDrop: (event: DragEvent<HTMLElement>) => void;
  onTabDragStart: (event: DragEvent<HTMLElement>, tabId: string) => void;
  onTabDragEnd: () => void;
  onTabDropBefore: (event: DragEvent<HTMLElement>, tabId: string) => void;
  onRemoveTab: (tabId: string) => void;
}) {
  const visualStatus = state === "active" ? "active" : state === "archived" || state === "closed" ? "archived" : "backlog";
  const label = state === "active" ? "Active" : state === "open" ? "Open" : state === "closed" ? "Closed" : "Archived";

  function handleColumnDoubleClick(event: MouseEvent<HTMLElement>) {
    if (!onActivate || (event.target as HTMLElement).closest("button, input, textarea, select, summary, a")) {
      return;
    }
    onActivate();
  }

  return (
    <article
      className={`kanban-column task-session-column task-session-column-${state}`}
      onDoubleClick={handleColumnDoubleClick}
      onDragOver={onColumnDragOver}
      onDrop={onColumnDrop}
    >
      <div className="kanban-column-header">
        <span>{title ?? "Untitled session"}</span>
        <strong>{tabs.length}</strong>
      </div>
      <div className={`task-session-open ${selected ? "task-session-open-selected" : ""}`}>
        <button className="task-session-open-main" type="button" onClick={onOpen}>
          <span className={`status-pill project-status-${visualStatus}`}>{label}</span>
          <span className="task-session-last-active">
            <strong>Last Active:</strong> {formatTimestamp(activeAt)}
          </span>
        </button>
        <details className="kanban-task-menu task-session-menu">
          <summary aria-label={`Session actions for ${title ?? label}`}>⋮</summary>
          <div className="kanban-task-menu-popover task-session-menu-popover">
            {onActivate ? (
              <button type="button" onClick={onActivate} disabled={disabled}>
                Make active
              </button>
            ) : null}
            {onAttachCurrentWindow ? (
              <button type="button" onClick={onAttachCurrentWindow} disabled={disabled}>
                Attach current window
              </button>
            ) : null}
            {onClose ? (
              <button type="button" onClick={onClose} disabled={disabled}>
                Close session
              </button>
            ) : null}
            {onArchive ? (
              <button type="button" onClick={onArchive} disabled={disabled}>
                Archive session
              </button>
            ) : null}
            {onRestore ? (
              <button type="button" onClick={onRestore} disabled={disabled}>
                Restore session
              </button>
            ) : null}
            <button className="danger-menu-item" type="button" onClick={onDelete} disabled={disabled}>
              Delete session
            </button>
          </div>
        </details>
      </div>
      <div className="task-session-tab-preview">
        {tabs.length ? (
          tabs.slice(0, 6).map((tab) => (
            <div key={tab.id} className="task-session-tab-shell">
              <button
              key={tab.id}
              className={`browser-tab-row task-session-tab-card ${draggingId === tab.id ? "drag-card-active" : ""}`}
              type="button"
              draggable={!disabled}
              onDragStart={(event) => onTabDragStart(event, tab.id)}
              onDragEnd={onTabDragEnd}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => onTabDropBefore(event, tab.id)}
              onClick={onOpen}
            >
              {tab.favIconUrl ? (
                <img className="browser-tab-icon" src={tab.favIconUrl} alt="" />
              ) : (
                <span className="browser-tab-icon browser-tab-icon-fallback">{getTabInitial(tab.title)}</span>
              )}
              <span className="browser-tab-copy">
                <strong>{tab.title}</strong>
                <span>{formatTabUrl(tab.url)}</span>
              </span>
              </button>
              <button
                className="task-session-tab-delete"
                type="button"
                aria-label={`Remove ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveTab(tab.id);
                }}
                disabled={disabled}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <p className="muted">No tabs captured yet.</p>
        )}
        {tabs.length > 6 ? <p className="muted">+{tabs.length - 6} more tabs</p> : null}
      </div>
    </article>
  );
}

function SessionTabButton({
  tab,
  index,
  selected,
  onClick,
}: {
  tab: SessionTab;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`browser-tab-row task-session-tab-card session-tab-button ${selected ? "session-tab-button-active" : ""}`}
      type="button"
      onClick={onClick}
    >
      {tab.favIconUrl ? (
        <img className="browser-tab-icon" src={tab.favIconUrl} alt="" />
      ) : (
        <span className="browser-tab-icon browser-tab-icon-fallback">{index + 1}</span>
      )}
        <span className="browser-tab-copy">
          <strong>{tab.title}</strong>
          <span>{formatTabUrl(tab.url)}</span>
        </span>
    </button>
  );
}

function TaskCard({
  task,
  activeTaskId,
  selected,
  onSelect,
  onActivate,
}: {
  task: WorkspaceTaskSummary;
  activeTaskId?: string;
  selected: boolean;
  onSelect: () => void;
  onActivate: () => void;
}) {
  return (
    <div
      className={`task-card task-card-v2 ${selected ? "task-card-selected" : ""} ${task.status === "done" ? "task-card-complete" : ""}`}
    >
      <button className="task-card-main" onClick={onSelect}>
        <strong>{task.title}</strong>
        <span>{task.description ?? task.status.replace("_", " ")}</span>
        <span>
          {task.sessionTabCount} tabs • {task.checkpointCount} checkpoints
        </span>
      </button>
      <button
        className={`ghost-button task-activate-button ${activeTaskId === task.id ? "task-activate-current" : ""}`}
        onClick={onActivate}
        disabled={activeTaskId === task.id || task.status === "done"}
      >
        {task.status === "done" ? "Archived" : activeTaskId === task.id ? "Active" : "Set active"}
      </button>
    </div>
  );
}

function CheckpointDetail({
  checkpoint,
  disabled,
  onRestore,
}: {
  checkpoint: WorkspaceCheckpointSummary;
  disabled: boolean;
  onRestore: () => void;
}) {
  return (
    <div className="editor-card stack-sm">
      <div className="subsection-header">
        <div>
          <span className="eyebrow">Checkpoint detail</span>
          <h3>{formatCheckpointTitle(checkpoint.title, checkpoint.createdAt)}</h3>
        </div>
        <button className="secondary-button" onClick={onRestore} disabled={disabled}>
          Restore checkpoint
        </button>
      </div>
      <p className="muted">{formatTimestamp(checkpoint.createdAt)}</p>
      {checkpoint.noteMarkdown ? (
        <pre className="note-preview">{checkpoint.noteMarkdown}</pre>
      ) : (
        <p className="muted">No note snapshot was saved with this checkpoint.</p>
      )}
      <div className="tab-list">
        {checkpoint.sessionTabs.map((tab) => (
          <a key={tab.id} className="tab-row" href={tab.url} target="_blank" rel="noreferrer">
            <strong>{tab.title}</strong>
            <span>{tab.url}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
