import { useState } from "react";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Archive,
  Copy,
  GitBranch,
  Grid2X2,
  List,
  Plus,
  Search,
  Sparkles,
  Workflow as FlowIcon,
} from "lucide-react";
import { WorkflowCreate, type Workflow } from "@floxi/shared";
import { Modal } from "../../../packages/ui/src/Modal";
import { api, post } from "./api";
import { ErrorNote } from "../../../packages/ui/src/ErrorNote";
export function Studio() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "",
    tab = params.get("tab") ?? "all";
  const [create, setCreate] = useState(false),
    [error, setError] = useState<unknown>();
  const [view, setView] = useState(
    () => localStorage.getItem("floxi.view") ?? "grid",
  );
  const client = useQueryClient();
  const flows = useQuery({
    queryKey: ["flows", q, tab === "archived"],
    queryFn: () =>
      api<Workflow[]>(
        `studio/apps?q=${encodeURIComponent(q)}&archived=${tab === "archived"}`,
      ),
  });
  const visible = (flows.data ?? []).filter(
    (w) => tab !== "published" || w.publishedVersion,
  );
  async function action(
    id: string,
    kind: "duplicate" | "archive",
    archived = true,
  ) {
    try {
      setError(undefined);
      await post(
        `workflows/${id}/${kind}`,
        kind === "archive" ? { archived } : {},
      );
      await client.invalidateQueries({ queryKey: ["flows"] });
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <div className="topbar">
        <span>
          Workspace <span className="slash">/</span> Studio
        </span>
        <span className="topbar-caption">
          <span className="online-dot" />
          Development workspace
        </span>
      </div>
      <main className="page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOUR AUTOMATION WORKSPACE</span>
            <h1>
              Make the next thing happen<span className="blue">.</span>
            </h1>
            <p className="subtitle">
              Turn everyday processes into connected, repeatable workflows.
            </p>
          </div>
          <button className="primary" onClick={() => setCreate(true)}>
            <Plus size={18} />
            Create workflow
          </button>
        </div>
        <div className="studio-banner">
          <div>
            <span className="pill banner-pill">
              <Sparkles size={13} />A little less manual. A lot more possible.
            </span>
            <h2>From an idea to a working flow.</h2>
            <p>
              Connect your steps, shape your data, and see every run clearly.
            </p>
            <button onClick={() => setCreate(true)}>
              Build your first workflow <ArrowRight size={16} />
            </button>
          </div>
          <div className="flow-illustration" aria-hidden="true">
            <span className="illustration-node">
              <FlowIcon size={25} />
              <small>Trigger</small>
            </span>
            <i />
            <span className="illustration-node raised">
              <GitBranch size={25} />
              <small>Decide</small>
            </span>
            <i />
            <span className="illustration-node">
              <Sparkles size={25} />
              <small>Deliver</small>
            </span>
          </div>
        </div>
        <div className="section-title">
          <div>
            <h2>
              Your workflows{" "}
              <span className="count">{flows.data?.length ?? 0}</span>
            </h2>
            <p>Everything you’re building, in one place.</p>
          </div>
        </div>
        <div className="library-toolbar">
          <div className="tabs" role="tablist" aria-label="Workflow filters">
            {[
              ["all", "All workflows"],
              ["published", "Published"],
              ["archived", "Archived"],
            ].map(([value, label]) => (
              <button
                role="tab"
                aria-selected={tab === value}
                key={value}
                className={tab === value ? "active" : ""}
                onClick={() =>
                  setParams((p) => {
                    p.set("tab", value);
                    return p;
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="toolbar-end">
            <label className="search">
              <Search size={16} />
              <input
                aria-label="Search workflows"
                placeholder="Search workflows…"
                value={q}
                onChange={(e) =>
                  setParams((p) => {
                    p.set("q", e.target.value);
                    return p;
                  })
                }
              />
            </label>
            <div className="view-toggle">
              {["grid", "list"].map((v) => (
                <button
                  key={v}
                  aria-label={`${v} view`}
                  aria-pressed={view === v}
                  className={view === v ? "active" : ""}
                  onClick={() => {
                    setView(v);
                    localStorage.setItem("floxi.view", v);
                  }}
                >
                  {v === "grid" ? <Grid2X2 size={16} /> : <List size={16} />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ErrorNote error={error ?? flows.error} />
        {flows.isPending ? (
          <div className="center-state">Loading workflows…</div>
        ) : visible.length ? (
          <div className={view === "grid" ? "workflow-grid" : "workflow-list"}>
            {visible.map((w) => (
              <article className="workflow-card" key={w.id}>
                <div className="card-top">
                  <span className="flow-icon">
                    <FlowIcon size={23} />
                  </span>
                  <span
                    className={`pill ${w.publishedVersion ? "success" : ""}`}
                  >
                    {w.archived
                      ? "Archived"
                      : w.publishedVersion
                        ? `Published · v${w.publishedVersion}`
                        : "Draft"}
                  </span>
                </div>
                <Link
                  className="card-title"
                  to={`/studio/flows/${w.id}/editor`}
                >
                  {w.name}
                  <ArrowRight size={16} />
                </Link>
                <p>
                  {w.description ||
                    "A blank canvas for your next connected process."}
                </p>
                <div className="card-bottom">
                  <span>
                    {w.graph.nodes.length} nodes ·{" "}
                    {new Date(w.updatedAt).toLocaleDateString()}
                  </span>
                  <div className="card-actions">
                    <button
                      aria-label={`Duplicate ${w.name}`}
                      title="Duplicate workflow"
                      onClick={() => action(w.id, "duplicate")}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      aria-label={`${w.archived ? "Restore" : "Archive"} ${w.name}`}
                      title={w.archived ? "Restore" : "Archive"}
                      onClick={() => {
                        if (
                          w.archived ||
                          confirm(
                            `Archive “${w.name}”? You can restore it from Archived.`,
                          )
                        )
                          void action(w.id, "archive", !w.archived);
                      }}
                    >
                      <Archive size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {tab !== "archived" && (
              <button className="new-card" onClick={() => setCreate(true)}>
                <span>
                  <Plus size={24} />
                </span>
                <strong>Create a workflow</strong>
                <small>Start with a blank canvas</small>
              </button>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <FlowIcon size={32} />
            </span>
            <h2>
              {q
                ? "No matching workflows"
                : tab === "archived"
                  ? "No archived workflows"
                  : tab === "published"
                    ? "No published workflows yet"
                    : "Your next great workflow starts here"}
            </h2>
            <p>
              {q
                ? "Try a different name or description."
                : "Create a workflow, connect a few steps, and make it your own."}
            </p>
            {tab === "all" && (
              <button className="primary" onClick={() => setCreate(true)}>
                <Plus size={16} />
                Create workflow
              </button>
            )}
          </div>
        )}
        <footer className="studio-footer">
          <span>
            <span className="online-dot" />
            Durable by design
          </span>
          <span>
            PostgreSQL persistence · Versioned workflows · Observable execution
          </span>
        </footer>
      </main>
      {create && <CreateDialog onClose={() => setCreate(false)} />}
    </>
  );
}
function CreateDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate(),
    client = useQueryClient();
  const [error, setError] = useState<unknown>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<
    z.input<typeof WorkflowCreate>,
    unknown,
    z.output<typeof WorkflowCreate>
  >({
    resolver: zodResolver(WorkflowCreate),
    defaultValues: { name: "", description: "" },
  });
  return (
    <Modal title="Create a workflow" onClose={onClose}>
      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            const w = await post<Workflow>("workflows", values);
            await client.invalidateQueries({ queryKey: ["flows"] });
            onClose();
            navigate(`/studio/flows/${w.id}/editor`);
          } catch (e) {
            setError(e);
          }
        })}
      >
        <div className="create-type">
          <FlowIcon />
          <div>
            <strong>Blank workflow</strong>
            <p>A manual trigger, your logic, your result.</p>
          </div>
          <span className="pill">Workflow</span>
        </div>
        <label>
          Workflow name
          <input
            autoFocus
            placeholder="e.g. Customer intake"
            {...register("name")}
          />
        </label>
        <small className="field-error">{errors.name?.message}</small>
        <label>
          Description <span className="muted">(optional)</span>
          <textarea
            placeholder="What will this workflow do?"
            rows={3}
            {...register("description")}
          />
        </label>
        <small className="field-error">{errors.description?.message}</small>
        <ErrorNote error={error} />
        <div className="dialog-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create workflow"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
