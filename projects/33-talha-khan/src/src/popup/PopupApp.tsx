import { useCallback, useEffect, useMemo, useState } from "react";

import { attachCurrentTab, openWorkspace, requestWorkspace } from "../shared/messaging/client";
import { APP_VERSION } from "../shared/app-version";
import { WORKSPACE_MUTATED_EVENT, type WorkspaceResponse } from "../shared/messaging/types";

type ActiveTabSummary = Pick<chrome.tabs.Tab, "id" | "windowId" | "title" | "url">;

export function PopupApp() {
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTabSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextWorkspace, tabs] = await Promise.all([
        requestWorkspace(),
        chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        }),
      ]);
      setWorkspace(nextWorkspace);
      setActiveTab(tabs[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load popup data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handleRuntimeMessage = (message: { type?: string }) => {
      if (message.type === WORKSPACE_MUTATED_EVENT) {
        void load();
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  }, [load]);

  const activeSession = useMemo(() => {
    if (!workspace?.activeSessionId) {
      return null;
    }

    for (const project of workspace.projects) {
      for (const task of project.tasks) {
        const session = task.sessions.find((item) => item.id === workspace.activeSessionId);
        if (session) {
          return { project, task, session };
        }
      }
    }

    return null;
  }, [workspace]);

  const activeTabAssignment = useMemo(() => {
    if (!workspace || !activeTab?.url) {
      return null;
    }

    for (const project of workspace.projects) {
      for (const task of project.tasks) {
        for (const session of task.sessions) {
          const tab = session.tabs.find((item) => item.url === activeTab.url && item.title === activeTab.title);
          if (tab) {
            return { project, task, session, tab };
          }
        }
      }
    }

    return null;
  }, [workspace, activeTab]);

  async function handleOpenSmartSession() {
    setError(null);

    try {
      await openWorkspace();
      window.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to open SmartSession.");
    }
  }

  async function handleAttachCurrentTab() {
    if (!activeSession) {
      setError("Create or activate a session before attaching the current tab.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await attachCurrentTab(activeSession.task.id, activeSession.session.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to attach the current tab.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenNotes() {
    if (!activeTabAssignment || typeof activeTab?.id !== "number" || typeof activeTab.windowId !== "number") {
      setError("This tab is not associated with a session yet.");
      return;
    }

    setError(null);

    try {
      await chrome.sidePanel.setOptions({
        tabId: activeTab.id,
        path: `src/sidepanel/index.html?mode=tab-notes&sessionId=${encodeURIComponent(activeTabAssignment.session.id)}&tabId=${encodeURIComponent(activeTabAssignment.tab.id)}`,
        enabled: true,
      });

      await chrome.sidePanel.open({
        windowId: activeTab.windowId,
      });

      window.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to open notes.");
    }
  }

  return (
    <main className="surface popup-shell">
      <section className="popup-card stack-sm">
        <div className="popup-brand-row">
          <div>
            <h1 className="popup-title">SmartSession</h1>
            <p className="popup-subtitle">Quick actions</p>
          </div>
          <span className="popup-version">v{APP_VERSION}</span>
        </div>
        {activeSession ? (
          <div className="popup-context">
            <span className="eyebrow">Active session</span>
            <strong>{activeSession.session.title ?? activeSession.task.title}</strong>
          </div>
        ) : (
          <p className="muted">No active session selected.</p>
        )}
        {error ? <p className="error-text">{error}</p> : null}

        <button className="primary-button popup-action-primary" type="button" onClick={() => void handleOpenSmartSession()} disabled={loading}>
          Open SmartSession
        </button>
        <button className="popup-action" type="button" onClick={() => void handleAttachCurrentTab()} disabled={loading || !activeSession}>
          Attach tab to active session
        </button>
        <button className="popup-action" type="button" onClick={() => void handleOpenNotes()} disabled={loading || !activeTabAssignment}>
          Create notes
        </button>
      </section>
    </main>
  );
}
