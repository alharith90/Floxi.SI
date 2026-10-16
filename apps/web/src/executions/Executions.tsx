import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  Square,
  XCircle,
} from "lucide-react";
import type { Run } from "@floxi/shared";
import { Modal } from "../../../../packages/ui/src/Modal";
import { api, post } from "../api";
import { ErrorNote } from "../../../../packages/ui/src/ErrorNote";
import { DataViewer } from "../editor/Workbench";
type Summary = Omit<Run, "steps" | "input"> & { workflow: { name: string } };
export function Executions() {
  const [rid, setRid] = useState<string>();
  const query = useQuery({
    queryKey: ["runs"],
    queryFn: () => api<Summary[]>("executions"),
    refetchInterval: 5000,
  });
  return (
    <>
      <div className="topbar">
        <span>Workspace / Executions</span>
        <span className="pill">Persisted run history</span>
      </div>
      <main className="page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">EVERY STEP, ACCOUNTED FOR</span>
            <h1>
              Execution history<span className="blue">.</span>
            </h1>
            <p className="subtitle">
              Understand what happened, what changed, and what comes next.
            </p>
          </div>
          <button onClick={() => void query.refetch()}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        <ErrorNote error={query.error} />
        {query.isPending ? (
          <p>Loading executions…</p>
        ) : query.data?.length ? (
          <div className="execution-table">
            <table>
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Started</th>
                  <th>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.workflow.name}</strong>
                      <small className="run-id">{r.id.slice(0, 8)}</small>
                    </td>
                    <td>
                      <Status value={r.status} />
                    </td>
                    <td>v{r.version}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => setRid(r.id)}
                        aria-label={`Inspect run ${r.id.slice(0, 8)}`}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Activity size={30} />
            </span>
            <h2>No runs yet</h2>
            <p>
              Publish a workflow and start a run. Its timeline and results will
              appear here.
            </p>
            <Link className="primary" to="/">
              Go to Studio
            </Link>
          </div>
        )}
      </main>
      {rid && (
        <Modal title="Execution details" wide onClose={() => setRid(undefined)}>
          <RunDetail runId={rid} />
        </Modal>
      )}
    </>
  );
}
function Status({ value }: { value: string }) {
  const Icon =
    value === "SUCCEEDED" ? CheckCircle2 : value === "FAILED" ? XCircle : Clock;
  return (
    <span
      className={`pill status-pill ${value === "SUCCEEDED" ? "success" : value === "FAILED" ? "failure" : ""}`}
    >
      <Icon size={13} />
      {value.toLowerCase()}
    </span>
  );
}
export function RunDetail({
  runId,
  compact = false,
  onNode,
}: {
  runId: string;
  compact?: boolean;
  onNode?: (id: string) => void;
}) {
  const client = useQueryClient(),
    [error, setError] = useState<unknown>();
  const cursor = useRef(0);
  const query = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api<Run>(`executions/${runId}`),
    refetchInterval: (q) =>
      q.state.data &&
      ["SUCCEEDED", "FAILED", "CANCELLED"].includes(q.state.data.status)
        ? false
        : 1000,
  });
  useEffect(() => {
    cursor.current = 0;
    const socket = io({ withCredentials: true });
    socket.on("connect", () =>
      socket.emit("subscribe", { runId, after: cursor.current }),
    );
    socket.on("execution.event", (event: { sequence: number }) => {
      cursor.current = event.sequence;
      void client.invalidateQueries({ queryKey: ["run", runId] });
      void client.invalidateQueries({ queryKey: ["runs"] });
    });
    return () => {
      socket.disconnect();
    };
  }, [runId, client]);
  const run = query.data;
  return (
    <div className={compact ? "run-detail compact" : "run-detail"}>
      <ErrorNote error={error ?? query.error} />
      {!run ? (
        <p>Loading execution…</p>
      ) : (
        <>
          <div className="run-summary">
            <Status value={run.status} />
            <span>Published v{run.version}</span>
            <code>{run.id.slice(0, 8)}</code>
            {!["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status) && (
              <button
                onClick={async () => {
                  try {
                    await post(`executions/${runId}/cancel`);
                    await client.invalidateQueries({
                      queryKey: ["run", runId],
                    });
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                <Square size={13} />
                Cancel run
              </button>
            )}
          </div>
          {run.error && (
            <div role="alert" className="error-note">
              {run.error}
            </div>
          )}
          <div className="run-steps">
            {run.steps.map((step) => (
              <div className="run-step" key={step.nodeId}>
                {onNode && (
                  <button onClick={() => onNode(step.nodeId)}>
                    Inspect node
                  </button>
                )}
                <Status value={step.status} />
                <code>{step.nodeId.slice(0, 8)}</code>
                {step.wakeAt && step.status === "WAITING" && (
                  <small>
                    Resumes {new Date(step.wakeAt).toLocaleTimeString()}
                  </small>
                )}
                {step.error && (
                  <span className="field-error">{step.error}</span>
                )}
                {!compact && <DataViewer data={step.output} />}
              </div>
            ))}
          </div>
          {!run.steps.length && (
            <p className="muted">
              Queued · waiting for the database worker to claim this run.
            </p>
          )}
        </>
      )}
    </div>
  );
}
