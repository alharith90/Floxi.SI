import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CompletionRequest,
  EndpointCreate,
  type ModelEndpoint,
  type CompletionResult,
} from "@floxi/shared";
import { api, post } from "./api";
import { ErrorNote } from "../../../packages/ui/src/ErrorNote";
export function Models() {
  const client = useQueryClient();
  const endpoints = useQuery({
    queryKey: ["models"],
    queryFn: () => api<ModelEndpoint[]>("models"),
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ role: string }>("auth/me"),
  });
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<unknown>();
  const [result, setResult] = useState<CompletionResult>();
  const [testing, setTesting] = useState<string>();
  const form = useForm<
    z.input<typeof EndpointCreate>,
    unknown,
    z.output<typeof EndpointCreate>
  >({
    resolver: zodResolver(EndpointCreate),
    defaultValues: {
      name: "",
      baseUrl: "",
      chatModel: "",
      embeddingModel: null,
      dimensions: null,
      credentialEnv: null,
      apiStyle: "chat-completions",
    },
  });
  const prompt = useForm<
    z.input<typeof CompletionRequest>,
    unknown,
    z.output<typeof CompletionRequest>
  >({
    resolver: zodResolver(CompletionRequest),
    defaultValues: { prompt: "", system: "", temperature: 0.7, maxTokens: 512 },
  });
  const canExecute = ["admin", "publisher", "editor", "operator"].includes(
    me.data?.role ?? "",
  );
  return (
    <>
      <div className="topbar">
        <span>Workspace / Models</span>
      </div>
      <main className="page">
        <h1>Models</h1>
        <p className="subtitle">
          Connect an OpenAI-compatible endpoint and try a text prompt.
          Connection tests check model discovery; use the playground to verify
          inference.
        </p>
        <ErrorNote error={error ?? endpoints.error} />
        {endpoints.isPending && <p role="status">Loading models…</p>}
        {endpoints.data?.length === 0 && (
          <p>No endpoints configured. An administrator can add one below.</p>
        )}
        <div className="roadmap-grid">
          {endpoints.data?.map((e) => (
            <article className="roadmap-card" key={e.id}>
              <h2>{e.name}</h2>
              <p>{e.baseUrl}</p>
              <p>
                Chat model: {e.chatModel ?? "None"} · {e.apiStyle}
              </p>
              <p>
                Connection: {e.health} · Credential:{" "}
                {e.credentialEnv
                  ? e.credentialConfigured
                    ? "Configured"
                    : "Missing on server"
                  : "None"}
              </p>
              {e.testedAt && (
                <small>Tested {new Date(e.testedAt).toLocaleString()}</small>
              )}
              {e.lastError && <p role="alert">{e.lastError}</p>}
              {me.data?.role === "admin" && (
                <button
                  disabled={Boolean(testing)}
                  onClick={async () => {
                    setTesting(e.id);
                    setError(undefined);
                    try {
                      await post(`models/${e.id}/test`);
                      await client.invalidateQueries({ queryKey: ["models"] });
                    } catch (err) {
                      setError(err);
                    } finally {
                      setTesting(undefined);
                    }
                  }}
                >
                  {testing === e.id ? "Testing…" : "Test connection"}
                </button>
              )}
            </article>
          ))}
        </div>
        {me.data?.role === "admin" && (
          <section className="roadmap-card model-form">
            <h2>Add model endpoint</h2>
            <p>
              The server must approve the exact endpoint origin in
              MODEL_ALLOWED_ORIGINS. API keys stay on the server.
            </p>
            <form
              onSubmit={form.handleSubmit(async (data) => {
                setError(undefined);
                try {
                  const e = await post<ModelEndpoint>("models", data);
                  setSelected(e.id);
                  form.reset();
                  await client.invalidateQueries({ queryKey: ["models"] });
                } catch (err) {
                  setError(err);
                }
              })}
            >
              <label>
                Name
                <input {...form.register("name")} />
              </label>
              <label>
                Base URL
                <input
                  placeholder="http://localhost:8000/v1"
                  {...form.register("baseUrl")}
                />
              </label>
              <label>
                Chat model
                <input
                  placeholder="Your provider's model ID"
                  {...form.register("chatModel")}
                />
              </label>
              <label>
                API style
                <select {...form.register("apiStyle")}>
                  <option value="chat-completions">Chat Completions</option>
                  <option value="responses">Responses</option>
                </select>
              </label>
              <label>
                Credential environment variable (optional)
                <input
                  placeholder="FLOXI_MODEL_KEY_LOCAL"
                  {...form.register("credentialEnv", {
                    setValueAs: (v) => (v === "" ? null : v),
                  })}
                />
              </label>
              {Object.entries(form.formState.errors).map(([key, value]) => (
                <p role="alert" key={key}>
                  {key}: {value.message}
                </p>
              ))}
              <button
                className="primary"
                disabled={form.formState.isSubmitting}
              >
                Add endpoint
              </button>
            </form>
          </section>
        )}
        {canExecute && (
          <section className="roadmap-card model-form">
            <h2>Text playground</h2>
            <p>
              Requests are sent to your selected provider. Responses are
              displayed here; prompt and answer content are not stored by Floxi.
            </p>
            <form
              onSubmit={prompt.handleSubmit(async (data) => {
                setError(undefined);
                setResult(undefined);
                try {
                  setResult(
                    await post<CompletionResult>(
                      `models/${selected}/completions`,
                      data,
                    ),
                  );
                } catch (err) {
                  setError(err);
                }
              })}
            >
              <label>
                Endpoint
                <select
                  aria-label="Endpoint"
                  required
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setResult(undefined);
                  }}
                >
                  <option value="">Select an endpoint</option>
                  {endpoints.data
                    ?.filter((e) => e.chatModel)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                System instructions
                <textarea {...prompt.register("system")} />
              </label>
              <label>
                Prompt
                <textarea {...prompt.register("prompt")} />
              </label>
              <label>
                Maximum output tokens
                <input
                  type="number"
                  {...prompt.register("maxTokens", { valueAsNumber: true })}
                />
              </label>
              {Object.entries(prompt.formState.errors).map(([key, value]) => (
                <p role="alert" key={key}>
                  {key}: {value.message}
                </p>
              ))}
              <button
                className="primary"
                disabled={!selected || prompt.formState.isSubmitting}
              >
                {prompt.formState.isSubmitting
                  ? "Generating…"
                  : "Generate text"}
              </button>
            </form>
            {result && (
              <div role="status">
                <h3>Model response</h3>
                <pre
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {result.text}
                </pre>
                <small>
                  {result.model} · Total tokens:{" "}
                  {result.usage.totalTokens ?? "Not reported"}
                </small>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
