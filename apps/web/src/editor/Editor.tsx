import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useBlocker } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type NodeProps,
  type Node as FlowNode,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Flag,
  Play,
  Plus,
  Redo2,
  Save,
  Settings2,
  Trash2,
  Undo2,
  Workflow as FlowIcon,
  X,
} from "lucide-react";
import {
  definition,
  defaults,
  validateGraph,
  type Definition,
  type Graph,
  type GraphNode,
  type NodeType,
  type Run,
  type Workflow,
} from "@floxi/shared";
import { Modal } from "../../../../packages/ui/src/Modal";
import { ErrorNote } from "../../../../packages/ui/src/ErrorNote";
import { api, post } from "../api";
import { RunDetail } from "../executions/Executions";
import { Workbench } from "./Workbench";
import { useEditor } from "./store";
import { nodeIcons } from "./nodeIcons";
type CanvasNode = FlowNode<
  {
    node: GraphNode;
    status?: string;
    onConfigure: (id: string) => void;
    onSelect: (id: string) => void;
  },
  "workflow"
>;
function WorkflowNode({ data, selected }: NodeProps<CanvasNode>) {
  const def = definition(data.node.type),
    Icon = nodeIcons[data.node.type];
  return (
    <div
      onDoubleClick={(event) => {
        event.stopPropagation();
        data.onConfigure(data.node.id);
      }}
      onClick={(event) => {
        event.stopPropagation();
        data.onSelect(data.node.id);
      }}
      className={`canvas-node ${selected ? "selected" : ""} status-${data.status ?? "IDLE"}`}
    >
      <div className={`node-symbol ${data.node.type}`}>
        <Icon size={23} />
      </div>
      <div>
        <small>{def.title}</small>
        <strong>{data.node.label}</strong>
        {data.status && (
          <span className="node-status">{data.status.toLowerCase()}</span>
        )}
      </div>
      {data.node.type !== "manual" && (
        <Handle type="target" position={Position.Left} id="input" />
      )}
      {def.outputs.map((port, index) => (
        <Handle
          key={port}
          type="source"
          position={Position.Right}
          id={port}
          style={{ top: `${((index + 1) / (def.outputs.length + 1)) * 100}%` }}
        >
          <span className="port-label">
            {def.outputs.length > 1 ? port : ""}
          </span>
        </Handle>
      ))}
    </div>
  );
}
const nodeTypes = { workflow: WorkflowNode };
export function Editor() {
  const { id } = useParams();
  return (
    <ReactFlowProvider>
      <EditorLoader key={id} id={id!} />
    </ReactFlowProvider>
  );
}
function EditorLoader({ id }: { id: string }) {
  const [initial, setInitial] = useState<Workflow>();
  const query = useQuery({
    queryKey: ["flow", id],
    queryFn: () => api<Workflow>(`workflows/${id}`),
  });
  useEffect(() => {
    if (!initial && query.isFetchedAfterMount && query.data && !query.isError)
      setInitial(query.data);
  }, [initial, query.isFetchedAfterMount, query.data, query.isError]);
  if (!initial) {
    if (query.isError)
      return (
        <div className="page">
          <ErrorNote error={query.error} />
          <button onClick={() => void query.refetch()}>Reload workflow</button>
          <Link to="/">Back to Studio</Link>
        </div>
      );
    return <div className="center-state">Loading workflow…</div>;
  }
  return <EditorCanvas initial={initial} />;
}
function EditorCanvas({ initial }: { initial: Workflow }) {
  const { graph, reset, change, checkpoint, undo, redo, past, future } =
    useEditor();
  const { fitView } = useReactFlow();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void fitView({ padding: 0.25, maxZoom: 1 });
    }, 60);
    return () => clearTimeout(timer);
  }, [ready, graph.nodes.length, fitView]);
  useEffect(() => {
    reset(initial.graph);
    setReady(true);
  }, [initial.id, initial.graph, reset]);
  const [name, setName] = useState(initial.name),
    [revision, setRevision] = useState(initial.revision),
    [version, setVersion] = useState(initial.publishedVersion),
    [saved, setSaved] = useState(
      JSON.stringify({ graph: initial.graph, name: initial.name }),
    );
  const [selected, setSelected] = useState<string>(),
    [workbench, setWorkbench] = useState<string>(),
    [picker, setPicker] = useState(false),
    [find, setFind] = useState(""),
    [error, setError] = useState<unknown>(),
    [saving, setSaving] = useState(false),
    [conflict, setConflict] = useState(false),
    [validating, setValidating] = useState(false),
    [diagnostics, setDiagnostics] = useState<string[] | null>(null),
    [runDialog, setRunDialog] = useState(false),
    [runId, setRunId] = useState<string>(),
    [showHistory, setShowHistory] = useState(false);
  const failedSnapshot = useRef<string | null>(null);
  const lock = useRef(false),
    client = useQueryClient();
  const snapshot = JSON.stringify({ graph, name }),
    dirty = snapshot !== saved;
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: () => api<Definition[]>("nodes/catalog"),
  });
  const history = useQuery({
    queryKey: ["versions", initial.id],
    queryFn: () =>
      api<{ number: number; createdAt: string; graph: Graph }[]>(
        `workflows/${initial.id}/versions`,
      ),
    enabled: showHistory,
  });
  const run = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api<Run>(`executions/${runId}`),
    enabled: !!runId,
    refetchInterval: (q) =>
      q.state.data &&
      ["SUCCEEDED", "FAILED", "CANCELLED"].includes(q.state.data.status)
        ? false
        : 1000,
  });
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state === "blocked" && !dirty) blocker.proceed();
  }, [blocker, dirty]);
  const save = useCallback(async () => {
    if (lock.current || conflict) return false;
    lock.current = true;
    setSaving(true);
    try {
      setError(undefined);
      const w = await api<Workflow>(`workflows/${initial.id}/draft`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: initial.description,
          revision,
          graph,
        }),
      });
      setRevision(w.revision);
      setSaved(JSON.stringify({ graph, name }));
      failedSnapshot.current = null;
      await client.invalidateQueries({ queryKey: ["flows"] });
      return true;
    } catch (e) {
      failedSnapshot.current = JSON.stringify({ graph, name });
      setError(e);
      if (e instanceof Error && "status" in e && e.status === 409)
        setConflict(true);
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }, [
    client,
    conflict,
    graph,
    initial.description,
    initial.id,
    name,
    revision,
  ]);
  useEffect(() => {
    if (
      !ready ||
      !dirty ||
      saving ||
      conflict ||
      initial.archived ||
      failedSnapshot.current === snapshot
    )
      return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  }, [ready, dirty, saving, conflict, initial.archived, save]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [undo, redo, save]);
  const nodes: CanvasNode[] = useMemo(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        position: node.position,
        type: "workflow",
        selected: selected === node.id,
        data: {
          node,
          onConfigure: setWorkbench,
          onSelect: setSelected,
          status: run.data?.steps.find((s) => s.nodeId === node.id)?.status,
        },
      })),
    [graph.nodes, selected, run.data],
  );
  const edges = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourcePort,
        targetHandle: e.targetPort,
        type: "smoothstep",
        animated: run.data?.status === "RUNNING",
      })),
    [graph.edges, run.data?.status],
  );
  function updateNode(node: GraphNode) {
    change({
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === node.id ? node : n)),
    });
  }
  function onNodesChange(changes: NodeChange<CanvasNode>[]) {
    let next = graph;
    for (const c of changes) {
      if (c.type === "select") {
        if (c.selected) setSelected(c.id);
        else if (selected === c.id) setSelected(undefined);
      }
      if (c.type === "position" && c.position)
        next = {
          ...next,
          nodes: next.nodes.map((n) =>
            n.id === c.id ? { ...n, position: c.position! } : n,
          ),
        };
      if (c.type === "remove")
        next = {
          ...next,
          nodes: next.nodes.filter((n) => n.id !== c.id),
          edges: next.edges.filter(
            (e) => e.source !== c.id && e.target !== c.id,
          ),
        };
    }
    if (next !== graph)
      change(
        next,
        changes.some((c) => c.type === "remove"),
      );
  }
  function connect(c: Connection) {
    if (!c.sourceHandle || !c.targetHandle || c.source === c.target) return;
    const edge = {
      id: crypto.randomUUID(),
      source: c.source,
      target: c.target,
      sourcePort: c.sourceHandle,
      targetPort: "input" as const,
    };
    if (graph.edges.some((e) => e.target === c.target)) {
      setError(
        new Error(
          "This node already has an incoming connection. Branch joins are not supported yet.",
        ),
      );
      return;
    }
    const next = { ...graph, edges: [...graph.edges, edge] };
    const errors = validateGraph(next).filter((e) =>
      /Cycles|Duplicate|Invalid output|Triggers cannot/.test(e),
    );
    if (errors.length) {
      setError(new Error(errors.join("\n")));
      return;
    }
    change(next);
  }
  function add(type: NodeType) {
    const n: GraphNode = {
      id: crypto.randomUUID(),
      type,
      typeVersion: 1,
      label: definition(type).title,
      position: {
        x: 100 + (graph.nodes.length % 4) * 270,
        y: 100 + Math.floor(graph.nodes.length / 4) * 160,
      },
      parameters: defaults(type),
    };
    change({ ...graph, nodes: [...graph.nodes, n] });
    setSelected(n.id);
    setPicker(false);
  }
  async function publish() {
    try {
      setError(undefined);
      const errors = validateGraph(graph);
      if (errors.length) {
        setDiagnostics(errors);
        return;
      }
      const w = await post<Workflow>(`workflows/${initial.id}/publish`, {
        revision,
      });
      setVersion(w.publishedVersion);
      setRevision(w.revision);
      setDiagnostics([]);
      await client.invalidateQueries({ queryKey: ["versions", initial.id] });
      await client.invalidateQueries({ queryKey: ["flows"] });
    } catch (e) {
      setError(e);
    }
  }
  if (!ready) return null;
  return (
    <div className="editor-page">
      <header className="editor-header">
        <Link className="icon-button" to="/" aria-label="Back to Studio">
          <ArrowLeft size={19} />
        </Link>
        <span className="flow-icon small">
          <FlowIcon size={19} />
        </span>
        <div className="editor-title">
          <input
            aria-label="Workflow name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            disabled={initial.archived}
          />
          <small>
            {saving
              ? "Saving…"
              : conflict
                ? "Save conflict"
                : dirty
                  ? "Unsaved changes"
                  : `All changes saved · revision ${revision}`}
          </small>
        </div>
        <span className="pill">
          {version ? `Published v${version}` : "Draft"}
        </span>
        <div className="editor-actions">
          <button aria-label="Undo" disabled={!past.length} onClick={undo}>
            <Undo2 size={17} />
          </button>
          <button aria-label="Redo" disabled={!future.length} onClick={redo}>
            <Redo2 size={17} />
          </button>
          <button onClick={() => setShowHistory(true)}>History</button>
          <button
            onClick={() => {
              setValidating(true);
              setDiagnostics(validateGraph(graph));
              setValidating(false);
            }}
            disabled={validating}
          >
            Validate
          </button>
          <button
            onClick={() => void save()}
            disabled={!dirty || saving || initial.archived || conflict}
          >
            <Save size={15} />
            Save
          </button>
          <button
            onClick={() => void publish()}
            disabled={dirty || saving || initial.archived}
          >
            Publish
          </button>
          <button
            className="primary"
            onClick={() => setRunDialog(true)}
            disabled={!version || initial.archived}
          >
            <Play size={15} />
            Run v{version ?? "—"}
          </button>
        </div>
      </header>
      <ErrorNote error={error} />
      {conflict && (
        <div className="warning-note">
          Another session changed this draft. Copy your local graph before
          reloading.{" "}
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(graph, null, 2)], {
                type: "application/json",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "floxi-local-draft.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Export local graph
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "Discard local changes and reload the current server draft?",
                )
              )
                location.reload();
            }}
          >
            Reload draft
          </button>
        </div>
      )}
      {initial.archived && (
        <div className="warning-note">
          This workflow is archived. Restore it in Studio to edit or run.
        </div>
      )}
      <div className="canvas-area">
        <div className="canvas-toolbar">
          <button onClick={() => setPicker(true)} disabled={initial.archived}>
            <Plus size={18} />
            Add node
          </button>
          <span>Drag to connect · Double-click to configure</span>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStart={checkpoint}
          onEdgesChange={(changes) => {
            const removed = new Set(
              changes.filter((c) => c.type === "remove").map((c) => c.id),
            );
            if (removed.size)
              change({
                ...graph,
                edges: graph.edges.filter((e) => !removed.has(e.id)),
              });
          }}
          onConnect={connect}
          onNodeClick={(_, node) => setSelected(node.id)}
          onNodeDoubleClick={(_, node) => setWorkbench(node.id)}
          zoomOnDoubleClick={false}
          onEdgeClick={(_, edge) => {
            if (!initial.archived && confirm("Delete this connection?"))
              change({
                ...graph,
                edges: graph.edges.filter((e) => e.id !== edge.id),
              });
          }}
          onPaneClick={() => setSelected(undefined)}
          nodesDraggable={!initial.archived}
          nodesConnectable={!initial.archived}
          deleteKeyCode={initial.archived ? null : ["Backspace", "Delete"]}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2}
          colorMode={
            document.documentElement.dataset.theme === "dark" ? "dark" : "light"
          }
        >
          <Background gap={22} size={1} />
          <Controls />
          <MiniMap pannable zoomable nodeColor="#64a7ff" />
        </ReactFlow>
        {!graph.nodes.length && (
          <div className="canvas-empty">
            <span className="empty-icon">
              <FlowIcon size={30} />
            </span>
            <h2>Every workflow starts with a step</h2>
            <p>
              Add a manual trigger, connect your logic, then finish with a
              response.
            </p>
            <button
              className="primary"
              onClick={() => add("manual")}
              disabled={initial.archived}
            >
              <Plus size={16} />
              Add manual trigger
            </button>
          </div>
        )}
        {selected && graph.nodes.find((n) => n.id === selected) && (
          <div className="selection-toolbar">
            <strong>{graph.nodes.find((n) => n.id === selected)?.label}</strong>
            <button onClick={() => setWorkbench(selected)}>
              <Settings2 size={15} />
              Configure
            </button>
            <button
              aria-label="Delete selected node"
              disabled={initial.archived}
              onClick={() => {
                change({
                  ...graph,
                  nodes: graph.nodes.filter((n) => n.id !== selected),
                  edges: graph.edges.filter(
                    (e) => e.source !== selected && e.target !== selected,
                  ),
                });
                setSelected(undefined);
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
      {runId && (
        <div className="run-dock">
          <header>
            <strong>
              Execution{" "}
              <span className="pill">{run.data?.status ?? "Loading"}</span>
            </strong>
            <button
              className="icon-button"
              aria-label="Close execution"
              onClick={() => setRunId(undefined)}
            >
              <X size={17} />
            </button>
          </header>
          <RunDetail runId={runId} compact onNode={(id) => setWorkbench(id)} />
        </div>
      )}
      {picker && (
        <Modal title="Add a step" onClose={() => setPicker(false)}>
          <label className="search">
            <input
              autoFocus
              placeholder="Find a node…"
              aria-label="Find a node"
              value={find}
              onChange={(e) => setFind(e.target.value)}
            />
          </label>
          <ErrorNote error={catalog.error} />
          <div className="node-picker">
            {catalog.data
              ?.filter((d) =>
                `${d.title} ${d.description}`
                  .toLowerCase()
                  .includes(find.toLowerCase()),
              )
              .map((d) => {
                const Icon = nodeIcons[d.type];
                return (
                  <button key={d.type} onClick={() => add(d.type)}>
                    <span className={`node-symbol ${d.type}`}>
                      <Icon size={20} />
                    </span>
                    <div>
                      <strong>{d.title}</strong>
                      <p>{d.description}</p>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
          </div>
        </Modal>
      )}
      {workbench && graph.nodes.find((n) => n.id === workbench) && (
        <Workbench
          graph={graph}
          workflowId={initial.id}
          node={graph.nodes.find((n) => n.id === workbench)!}
          onChange={updateNode}
          onClose={() => setWorkbench(undefined)}
          run={run.data}
          readOnly={initial.archived}
        />
      )}
      {blocker.state === "blocked" && (
        <Modal title="Save your changes?" onClose={() => blocker.reset()}>
          <div className="leave-dialog">
            <p>
              This workflow has unsaved changes. Save them before leaving, or
              stay to continue editing.
            </p>
            <ErrorNote error={error} />
            <div className="dialog-footer">
              <button onClick={() => blocker.reset()}>Stay</button>
              <button onClick={() => blocker.proceed()}>
                Discard and leave
              </button>
              <button
                className="primary"
                disabled={saving || conflict}
                onClick={() => void save()}
              >
                Save and leave
              </button>
            </div>
          </div>
        </Modal>
      )}
      {diagnostics && (
        <Modal title="Workflow validation" onClose={() => setDiagnostics(null)}>
          {diagnostics.length ? (
            <ul className="diagnostics">
              {diagnostics.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : (
            <div className="validation-success">
              <Check size={30} />
              <h3>Ready to run</h3>
              <p>
                The graph is valid. Publish your saved draft to create an
                immutable version.
              </p>
            </div>
          )}
        </Modal>
      )}
      {runDialog && (
        <RunDialog
          version={version!}
          workflowId={initial.id}
          onClose={() => setRunDialog(false)}
          onRun={(id) => {
            setRunId(id);
            setRunDialog(false);
          }}
        />
      )}
      {showHistory && (
        <Modal title="Published versions" onClose={() => setShowHistory(false)}>
          <ErrorNote error={history.error} />
          {history.isPending ? (
            <p>Loading versions…</p>
          ) : !history.data?.length ? (
            <p>No published versions yet.</p>
          ) : (
            history.data.map((v) => (
              <div className="version-row" key={v.number}>
                <span className="flow-icon small">
                  <Flag size={16} />
                </span>
                <strong>Version {v.number}</strong>
                <span>{v.graph.nodes.length} nodes</span>
                <time>{new Date(v.createdAt).toLocaleString()}</time>
              </div>
            ))
          )}
        </Modal>
      )}
    </div>
  );
}
function RunDialog({
  version,
  workflowId,
  onClose,
  onRun,
}: {
  version: number;
  workflowId: string;
  onClose: () => void;
  onRun: (id: string) => void;
}) {
  const idempotencyKey = useRef(crypto.randomUUID());
  const [input, setInput] = useState("{}"),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false);
  return (
    <Modal title={`Run published version ${version}`} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setPending(true);
            setError(undefined);
            const data = JSON.parse(input);
            const run = await post<Run>(`workflows/${workflowId}/runs`, {
              input: data,
              idempotencyKey: idempotencyKey.current,
            });
            onRun(run.id);
          } catch (e) {
            setError(e);
          } finally {
            setPending(false);
          }
        }}
      >
        <p className="muted">
          Runs use the immutable published version. Unpublished edits are not
          executed.
        </p>
        <label>
          Trigger input (JSON object)
          <textarea
            className="code-input"
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <ErrorNote error={error} />
        <div className="dialog-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={pending}>
            <Play size={15} />
            {pending ? "Starting…" : "Start execution"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
