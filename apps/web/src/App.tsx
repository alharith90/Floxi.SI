import { useEffect, useState, lazy, Suspense } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Moon,
  Sun,
  Workflow as FlowIcon,
} from "lucide-react";
import logo from "../../../Logos/logo.png";
import mark from "../../../Logos/icon2.png";
import { api, post } from "./api";
import { Studio } from "./Studio";
const Editor = lazy(() =>
  import("./editor/Editor").then((m) => ({ default: m.Editor })),
);
const Executions = lazy(() =>
  import("./executions/Executions").then((m) => ({ default: m.Executions })),
);
import { ErrorNote } from "../../../packages/ui/src/ErrorNote";
export function App() {
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      api<{ email: string; role: string; workspaceName: string }>("auth/me"),
  });
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem("floxi.theme") ??
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("floxi.theme", theme);
  }, [theme]);
  if (me.isPending)
    return <div className="center-state">Opening your workspace…</div>;
  if (!me.data)
    return (
      <Auth onSuccess={() => client.invalidateQueries({ queryKey: ["me"] })} />
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <img className="brand-full" src={logo} alt="Floxi.SI" />
          <img className="brand-mark" src={mark} alt="" />
        </Link>
        <div className="workspace">
          <span className="workspace-avatar">F</span>
          <div>
            <strong>{me.data.workspaceName}</strong>
            <small>Development workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <small className="nav-label">WORKSPACE</small>
        <nav>
          <NavLink to="/" end>
            <LayoutGrid size={18} />
            Studio
          </NavLink>
          <NavLink to="/executions">
            <Activity size={18} />
            Executions
          </NavLink>
          <NavLink to="/roadmap">
            <BookOpen size={18} />
            Delivery roadmap
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <FlowIcon size={22} />
            <strong>Your ideas. In motion.</strong>
            <p>Build connected workflows with a durable execution engine.</p>
            <Link to="/roadmap">
              Explore the roadmap <ArrowUpRight size={14} />
            </Link>
          </div>
          <button
            className="theme-button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}{" "}
            {theme === "light" ? "Dark" : "Light"} appearance
          </button>
          <div className="profile">
            <span className="avatar">{me.data.email[0].toUpperCase()}</span>
            <div>
              <strong>{me.data.email}</strong>
              <small>{me.data.role}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await post("auth/logout");
                client.clear();
                location.assign("/");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <Suspense fallback={<div className="center-state">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Studio />} />
            <Route path="/studio/flows/:id/editor" element={<Editor />} />
            <Route path="/executions" element={<Executions />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route
              path="*"
              element={
                <div className="center-state">
                  Page not found. <Link to="/">Return to Studio</Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
const authSchema = z.object({
  email: z.email(),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
});
function Auth({ onSuccess }: { onSuccess: () => void }) {
  const setup = useQuery({
    queryKey: ["setup"],
    queryFn: () => api<{ needsSetup: boolean }>("auth/status"),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
  });
  const [error, setError] = useState<unknown>();
  const navigate = useNavigate();
  return (
    <main className="auth-page">
      <div className="auth-intro">
        <img src={logo} alt="Floxi.SI" />
        <span className="eyebrow">SUPER INTELLIGENCE ORCHESTRATION</span>
        <h1>
          Great ideas deserve
          <br />a workflow.
        </h1>
        <p>Your workspace for connecting data, decisions, and the next step.</p>
        <div className="auth-art">
          <FlowIcon size={90} />
          <span>Connect. Configure. Create.</span>
        </div>
      </div>
      <div className="auth-panel">
        <form
          onSubmit={handleSubmit(async (data) => {
            try {
              setError(undefined);
              await post(
                setup.data?.needsSetup ? "auth/setup" : "auth/login",
                data,
              );
              navigate("/");
              onSuccess();
            } catch (e) {
              setError(e);
            }
          })}
        >
          <span className="eyebrow">WELCOME TO FLOXI.SI</span>
          <h2>
            {setup.data?.needsSetup ? "Create your workspace" : "Welcome back"}
          </h2>
          <p>
            {setup.data?.needsSetup
              ? "Set up the first administrator to get started."
              : "Sign in to continue building."}
          </p>
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              {...register("email")}
            />
          </label>
          <small className="field-error">{errors.email?.message}</small>
          <label>
            Password
            <input
              type="password"
              autoComplete={
                setup.data?.needsSetup ? "new-password" : "current-password"
              }
              {...register("password")}
            />
          </label>
          <small className="field-error">{errors.password?.message}</small>
          <ErrorNote error={error ?? setup.error} />
          <button
            className="primary full"
            disabled={isSubmitting || !setup.data}
          >
            {isSubmitting
              ? "Please wait…"
              : setup.data?.needsSetup
                ? "Create workspace"
                : "Sign in"}{" "}
            <ArrowUpRight size={16} />
          </button>
          <small className="muted">
            Local development · PostgreSQL-backed · No cloud account required
          </small>
        </form>
      </div>
    </main>
  );
}
function Roadmap() {
  return (
    <>
      <div className="topbar">
        <span>Workspace / Delivery roadmap</span>
        <span className="pill">Foundation release · 0.1</span>
      </div>
      <main className="page">
        <span className="eyebrow">BUILT WITH INTENTION</span>
        <h1>One platform. A clear path.</h1>
        <p className="subtitle">
          Implementation status against the supplied master specification. Only
          connected features are available in navigation.
        </p>
        <div className="roadmap-grid">
          {[
            [
              "01",
              "Studio & persistence",
              "Available",
              "Authenticated workspace, workflow cards, search, create, duplicate, archive and restore.",
            ],
            [
              "02",
              "Workflow canvas",
              "Available",
              "Connectable nodes, undo/redo, node forms, conflict-safe draft saving and versioned publishing.",
            ],
            [
              "03",
              "Durable execution",
              "Available",
              "Manual runs, transformations, conditions, durable waits, response outputs and execution history.",
            ],
            [
              "04",
              "AI & knowledge",
              "Planned",
              "Provider registry, LLM nodes, document pipelines, pgvector retrieval and agents require further implementation.",
            ],
            [
              "05",
              "Forms & integrations",
              "Planned",
              "Form publishing, HTTP connectors, schedules, email, MCP and approvals.",
            ],
            [
              "06",
              "Enterprise hardening",
              "Planned",
              "OIDC/SAML, member administration, governance, retention, backup drills and production deployment.",
            ],
          ].map(([n, title, status, description]) => (
            <article className="roadmap-card" key={n}>
              <span className="roadmap-number">{n}</span>
              <span
                className={`pill ${status === "Available" ? "success" : ""}`}
              >
                {status}
              </span>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
