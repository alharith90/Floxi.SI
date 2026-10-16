import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import {
  definition,
  Reference,
  referenceParts,
  type Data,
  type Field,
  type Graph,
  type GraphNode,
  type Run,
} from "@floxi/shared";
import { Modal } from "../../../../packages/ui/src/Modal";
import { nodeIcons } from "./nodeIcons";
export function Workbench({
  graph,
  node,
  onChange,
  onClose,
  run: currentRun,
  workflowId,
  readOnly,
}: {
  graph: Graph;
  node: GraphNode;
  onChange: (n: GraphNode) => void;
  onClose: () => void;
  run?: Run;
  workflowId: string;
  readOnly: boolean;
}) {
  const [selectedRunId, setSelectedRunId] = useState(currentRun?.id ?? "");
  const runs = useQuery({
    queryKey: ["workbench-runs", workflowId],
    queryFn: () =>
      api<{ id: string; version: number; status: string; createdAt: string }[]>(
        `executions?workflowId=${workflowId}`,
      ),
  });
  const resolvedId = selectedRunId || currentRun?.id || runs.data?.[0]?.id;
  const selectedRun = useQuery({
    queryKey: ["run", resolvedId],
    queryFn: () => api<Run>(`executions/${resolvedId}`),
    enabled: !!resolvedId && resolvedId !== currentRun?.id,
  });
  const run = resolvedId === currentRun?.id ? currentRun : selectedRun.data;
  const def = definition(node.type),
    Icon = nodeIcons[node.type];
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const step = run?.steps.find((s) => s.nodeId === node.id),
    upstream = graph.edges
      .filter((e) => e.target === node.id)
      .map((e) => ({
        node: graph.nodes.find((n) => n.id === e.source),
        step: run?.steps.find((s) => s.nodeId === e.source),
      }));
  const [inputOpen, setInputOpen] = useState(true),
    [outputOpen, setOutputOpen] = useState(true);
  return (
    <Modal
      title={node.label}
      wide
      onClose={() => {
        if (
          Object.values(invalid).some(Boolean) &&
          !confirm(
            "Discard invalid parameter text? Saved valid parameters will be kept.",
          )
        )
          return;
        onClose();
      }}
    >
      <div className="workbench-heading">
        <span className={`node-symbol ${node.type}`}>
          <Icon size={22} />
        </span>
        <div>
          <strong>{def.title}</strong>
          <p>{def.description}</p>
        </div>
        <label className="run-select-label">
          Execution data
          <select
            aria-label="Execution data"
            value={resolvedId ?? ""}
            onChange={(e) => setSelectedRunId(e.target.value)}
          >
            <option value="" disabled>
              No execution selected
            </option>
            {runs.data?.map((r) => (
              <option key={r.id} value={r.id}>
                v{r.version} · {r.status.toLowerCase()} · {r.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <span className="pill">Definition v1</span>
      </div>
      <div className="workbench">
        <section className={`work-pane ${inputOpen ? "" : "collapsed"}`}>
          <button
            className="pane-title"
            aria-expanded={inputOpen}
            onClick={() => setInputOpen(!inputOpen)}
          >
            {inputOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            INPUT
          </button>
          {inputOpen && (
            <>
              <p className="pane-help">
                Drag an upstream output field into a parameter to map its value
                at runtime.
              </p>
              {upstream.map(({ node: source, step: s }) => (
                <div key={source?.id}>
                  <h4>{source?.label}</h4>
                  {s?.status === "SUCCEEDED" ? (
                    <DataViewer data={s.output} sourceId={source!.id} />
                  ) : (
                    <p className="data-empty">
                      No executed output for this source.
                    </p>
                  )}
                </div>
              ))}
              {step ? (
                <>
                  <h4>Actual input</h4>
                  <DataViewer data={step.input} />
                </>
              ) : (
                <p className="data-empty">
                  Run a published workflow to inspect actual input.
                </p>
              )}
            </>
          )}
        </section>
        <section className="work-pane parameters-pane">
          <div className="pane-title">PARAMETERS</div>
          <label>
            Node name
            <input
              value={node.label}
              maxLength={100}
              disabled={readOnly}
              onChange={(e) => {
                if (e.target.value.trim())
                  onChange({ ...node, label: e.target.value });
              }}
            />
          </label>
          {def.fields.map((field) => (
            <Parameter
              key={`${node.id}:${field.key}`}
              field={field}
              value={node.parameters[field.key]}
              disabled={readOnly}
              onInvalid={(bad) =>
                setInvalid((v) => ({ ...v, [field.key]: bad }))
              }
              onChange={(value) =>
                onChange({
                  ...node,
                  parameters: { ...node.parameters, [field.key]: value },
                })
              }
            />
          ))}
          {!def.fields.length && (
            <div className="parameter-notice">
              This trigger receives the input supplied when a run is started. No
              configuration is required.
            </div>
          )}
          <div className="parameter-notice">
            <strong>Durable references</strong>
            <p>
              Mappings store node IDs and paths, not example values. Missing
              fields cause a visible run failure.
            </p>
          </div>
        </section>
        <section className={`work-pane ${outputOpen ? "" : "collapsed"}`}>
          <button
            className="pane-title"
            aria-expanded={outputOpen}
            onClick={() => setOutputOpen(!outputOpen)}
          >
            {outputOpen ? (
              <ChevronDown size={15} />
            ) : (
              <ChevronRight size={15} />
            )}
            OUTPUT
          </button>
          {outputOpen && (
            <>
              {step ? (
                <>
                  <span
                    className={`pill ${step.status === "SUCCEEDED" ? "success" : ""}`}
                  >
                    {step.status}
                  </span>
                  {step.error && (
                    <div role="alert" className="error-note">
                      {step.error}
                    </div>
                  )}
                  <DataViewer data={step.output} sourceId={node.id} />
                  <p className="pane-help">
                    Run v{run?.version} · {run?.id.slice(0, 8)}. Actual output
                    is sample-derived, not a guaranteed schema.
                  </p>
                </>
              ) : (
                <div className="data-empty">
                  <h3>No execution data yet</h3>
                  <p>
                    Publish and run this workflow to see real output, timing,
                    and errors.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
function Parameter({
  field,
  value,
  onChange,
  onInvalid,
  disabled,
}: {
  field: Field;
  value: Data[string] | undefined;
  onChange: (v: Data[string]) => void;
  onInvalid: (v: boolean) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(() =>
      field.kind === "json" || field.kind === "value"
        ? JSON.stringify(value ?? field.default, null, 2)
        : String(value ?? field.default),
    ),
    [error, setError] = useState("");
  const reference = Reference.safeParse(value);
  useEffect(() => {
    if (reference.success) setText(JSON.stringify(reference.data, null, 2));
  }, [value, reference.success]);
  function update(text: string) {
    setText(text);
    try {
      let next: Data[string];
      if (field.kind === "json" || field.kind === "value")
        next = JSON.parse(text);
      else if (field.kind === "number") {
        next = Number(text);
        if (!Number.isInteger(next) || next < 1 || next > 3600)
          throw new Error("Use a whole number from 1 to 3600.");
      } else next = text;
      if (
        field.kind === "json" &&
        (next === null || Array.isArray(next) || typeof next !== "object")
      )
        throw new Error("Enter a JSON object.");
      setError("");
      onInvalid(false);
      onChange(next);
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "Enter valid JSON."
          : e instanceof Error
            ? e.message
            : "Invalid value.",
      );
      onInvalid(true);
    }
  }
  return (
    <div
      className="parameter-field"
      onDragOver={(e) => {
        if (!disabled && ["json", "value"].includes(field.kind)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        try {
          const ref = Reference.parse(
            JSON.parse(e.dataTransfer.getData("application/x-floxi-reference")),
          );
          if (field.kind === "json" && ref.path) {
            const current = JSON.parse(text);
            const key = referenceParts(ref.path).at(-1) ?? "value";
            const base =
              current &&
              typeof current === "object" &&
              !Array.isArray(current) &&
              !Reference.safeParse(current).success
                ? current
                : {};
            update(JSON.stringify({ ...base, [key]: ref }, null, 2));
          } else update(JSON.stringify(ref, null, 2));
        } catch {
          setError("Drop a field from actual upstream output.");
        }
      }}
    >
      <label htmlFor={`parameter-${field.key}`}>{field.label}</label>
      {field.kind === "select" ? (
        <select
          id={`parameter-${field.key}`}
          value={String(value)}
          disabled={disabled}
          onChange={(e) => update(e.target.value)}
        >
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.kind === "number" ? (
        <input
          id={`parameter-${field.key}`}
          type="number"
          min={1}
          max={3600}
          value={text}
          disabled={disabled}
          onChange={(e) => update(e.target.value)}
        />
      ) : (
        <textarea
          id={`parameter-${field.key}`}
          className="code-input mapping-target"
          rows={field.kind === "json" ? 7 : 4}
          value={text}
          disabled={disabled}
          onChange={(e) => update(e.target.value)}
          aria-invalid={!!error}
        />
      )}
      <p className="field-help">{field.description}</p>
      {reference.success && (
        <div className="mapping-chip">
          Mapped · {reference.data.nodeId.slice(0, 8)} /{" "}
          {reference.data.path || "(entire output)"}
        </div>
      )}
      {error && (
        <small role="alert" className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}
export function DataViewer({
  data,
  sourceId,
}: {
  data: unknown;
  sourceId?: string;
}) {
  const [mode, setMode] = useState("JSON");
  const entries = flatten(data);
  return (
    <div className="data-viewer">
      <div className="data-tabs">
        {["JSON", "Table", "Schema"].map((m) => (
          <button
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
      {mode === "JSON" ? (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Path</th>
              <th>{mode === "Schema" ? "Observed type" : "Value"}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([path, value]) => (
              <tr key={path}>
                <td>{path || "(root)"}</td>
                <td>
                  {mode === "Schema"
                    ? value === null
                      ? "null"
                      : Array.isArray(value)
                        ? "array"
                        : typeof value
                    : JSON.stringify(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sourceId && (
        <div className="mapping-fields">
          <small>DRAG A FIELD TO MAP</small>
          {[["", data], ...entries].map(([path, value], index) => (
            <div
              className="draggable-value"
              key={index}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/x-floxi-reference",
                  JSON.stringify({ mode: "reference", nodeId: sourceId, path }),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
            >
              <GripVertical size={13} />
              <code>{String(path) || "Entire output"}</code>
              <span>{typeof value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function flatten(data: unknown, prefix = "", depth = 0): [string, unknown][] {
  if (depth > 5 || !data || typeof data !== "object") return [[prefix, data]];
  return Object.entries(data)
    .slice(0, 50)
    .flatMap(([key, value]) => {
      const path = `${prefix}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;
      return value && typeof value === "object"
        ? [
            [path, value] as [string, unknown],
            ...flatten(value, path, depth + 1),
          ]
        : [[path, value] as [string, unknown]];
    })
    .slice(0, 100);
}
