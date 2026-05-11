import { useCallback, useEffect, useMemo, useState } from "react";

import { WorkspaceHome } from "../app/WorkspaceHome";
import { openWorkspace, requestWorkspace, updateSessionTabNote } from "../shared/messaging/client";
import { WORKSPACE_MUTATED_EVENT, type WorkspaceResponse } from "../shared/messaging/types";

export function SidePanelApp() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const sessionId = params.get("sessionId");
  const tabId = params.get("tabId");

  if (mode === "tab-notes" && sessionId && tabId) {
    return <TabNotesPanel sessionId={sessionId} tabId={tabId} />;
  }

  return (
    <WorkspaceHome
      onOpenWorkspace={() => void openWorkspace()}
      variant="sidepanel"
    />
  );
}

function TabNotesPanel({ sessionId, tabId }: { sessionId: string; tabId: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setWorkspace(await requestWorkspace());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load notes.");
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

  const assignment = useMemo(() => {
    if (!workspace) {
      return null;
    }

    for (const project of workspace.projects) {
      for (const task of project.tasks) {
        const session = task.sessions.find((item) => item.id === sessionId);
        const tab = session?.tabs.find((item) => item.id === tabId);
        if (session && tab) {
          return { project, task, session, tab };
        }
      }
    }

    return null;
  }, [workspace, sessionId, tabId]);

  useEffect(() => {
    const nextKey = assignment ? `${assignment.session.id}:${assignment.tab.id}` : "";
    setDraft(assignment?.tab.noteMarkdown ?? "");
    setTargetKey(nextKey);
    setStatus("idle");
  }, [assignment?.session.id, assignment?.tab.id, assignment?.tab.noteMarkdown]);

  useEffect(() => {
    if (!assignment || targetKey !== `${assignment.session.id}:${assignment.tab.id}`) {
      return;
    }

    if (draft === (assignment.tab.noteMarkdown ?? "")) {
      return;
    }

    setStatus("saving");
    const timer = window.setTimeout(() => {
      void updateSessionTabNote({
        sessionId: assignment.session.id,
        tabId: assignment.tab.id,
        noteMarkdown: draft,
      })
        .then((next) => {
          setWorkspace(next);
          setStatus("saved");
        })
        .catch((cause) => {
          setStatus("error");
          setError(cause instanceof Error ? cause.message : "Failed to save notes.");
        });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [assignment, draft, targetKey]);

  return (
    <main className="surface tab-notes-shell">
      <section className="panel tab-notes-panel">
        <div className="tab-notes-header">
          <div>
            <span className="eyebrow">Tab notes</span>
            <h1>{assignment?.tab.title ?? "Notes"}</h1>
            {assignment ? <p className="muted">{assignment.session.title ?? assignment.task.title}</p> : null}
          </div>
          <span className={`note-status note-status-${status}`}>{status === "saving" ? "Saving" : status === "error" ? "Error" : "Saved"}</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {assignment ? (
          <textarea
            className="text-area note-editor tab-notes-editor"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add notes for this tab"
            autoFocus
          />
        ) : (
          <p className="muted">This tab note could not be found.</p>
        )}
      </section>
    </main>
  );
}
