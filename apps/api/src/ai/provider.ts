import { Agent, EnvHttpProxyAgent, fetch as httpFetch } from "undici";
import type { ModelEndpoint } from "@prisma/client";
import { z } from "zod";
const direct = new Agent({ connections: 4 }),
  proxy = new EnvHttpProxyAgent({ connections: 8 });
export class ProviderError extends Error {}
export function validateProviderUrl(raw: string) {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new ProviderError(
      "Use an HTTP(S) base URL without credentials, query, or fragment.",
    );
  if (
    ["169.254.169.254", "169.254.170.2", "metadata.google.internal"].includes(
      url.hostname,
    )
  )
    throw new ProviderError("Metadata service endpoints are blocked.");
  const origins = new Set([
    "https://api.openai.com",
    ...(process.env.MODEL_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  ]);
  if (!origins.has(url.origin))
    throw new ProviderError(
      "Endpoint origin is not approved. Add its exact scheme, hostname, and port to MODEL_ALLOWED_ORIGINS on the server.",
    );
  return url.toString().replace(/\/$/, "");
}
export async function providerRequest(
  endpoint: ModelEndpoint,
  path: string,
  body: unknown | undefined,
  signal?: AbortSignal,
): Promise<unknown> {
  const base = validateProviderUrl(endpoint.baseUrl),
    url = new URL(base + "/" + path),
    headers: Record<string, string> = { "Content-Type": "application/json" };
  if (endpoint.credentialEnv) {
    const key = process.env[endpoint.credentialEnv];
    if (!key)
      throw new ProviderError(
        "The configured model credential binding is not available on the server.",
      );
    headers.Authorization = `Bearer ${key}`;
  }
  try {
    const response = await httpFetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
      dispatcher: ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
        ? direct
        : proxy,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderError(
        `Provider returned HTTP ${response.status}. Check the endpoint, model name, credentials, and provider capacity.`,
      );
    }
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (!response.body)
      throw new ProviderError("Provider returned an empty response.");
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) {
        await response.body.cancel().catch(() => {});
        throw new ProviderError("Provider response exceeds the 4 MiB limit.");
      }
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ProviderError("Provider returned invalid JSON.");
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (signal?.aborted)
      throw new ProviderError("Model operation was cancelled.");
    throw new ProviderError(
      "Inference request failed or timed out. Check the server allowlist, network route, and provider availability.",
    );
  }
}
export async function embeddings(
  endpoint: ModelEndpoint,
  input: string[],
  signal?: AbortSignal,
) {
  if (!endpoint.embeddingModel || !endpoint.dimensions)
    throw new ProviderError(
      "Select an endpoint with an embedding model and dimensions.",
    );
  const raw = await providerRequest(
    endpoint,
    "embeddings",
    { model: endpoint.embeddingModel, input, encoding_format: "float" },
    signal,
  );
  const parsed = z
    .object({
      data: z.array(
        z.object({
          index: z.number().int().nonnegative(),
          embedding: z.array(z.number().finite()),
        }),
      ),
    })
    .safeParse(raw);
  if (!parsed.success || parsed.data.data.length !== input.length)
    throw new ProviderError("Provider returned an invalid embedding response.");
  const ordered = [...parsed.data.data].sort((a, b) => a.index - b.index);
  for (let i = 0; i < ordered.length; i++)
    if (
      ordered[i].index !== i ||
      ordered[i].embedding.length !== endpoint.dimensions ||
      !ordered[i].embedding.some((v) => v !== 0)
    )
      throw new ProviderError(
        "Provider embedding indices, dimensions, or vector values do not match the configured model.",
      );
  return ordered.map((d) => d.embedding);
}
export async function complete(
  endpoint: ModelEndpoint,
  p: { prompt: string; system: string; temperature: number; maxTokens: number },
  signal?: AbortSignal,
) {
  if (!endpoint.chatModel)
    throw new ProviderError("Select an endpoint with a chat model.");
  const responses = endpoint.apiStyle === "responses";
  const raw = await providerRequest(
    endpoint,
    responses ? "responses" : "chat/completions",
    responses
      ? {
          model: endpoint.chatModel,
          instructions: p.system,
          input: p.prompt,
          max_output_tokens: p.maxTokens,
        }
      : {
          model: endpoint.chatModel,
          messages: [
            { role: "system", content: p.system },
            { role: "user", content: p.prompt },
          ],
          temperature: p.temperature,
          max_tokens: p.maxTokens,
          stream: false,
        },
    signal,
  );
  const usage = z
    .object({
      prompt_tokens: z.number().nonnegative().optional(),
      completion_tokens: z.number().nonnegative().optional(),
      input_tokens: z.number().nonnegative().optional(),
      output_tokens: z.number().nonnegative().optional(),
      total_tokens: z.number().nonnegative().optional(),
    })
    .optional();
  const parsed = responses
    ? z
        .object({
          output: z.array(
            z.object({
              type: z.string(),
              content: z
                .array(
                  z.object({ type: z.string(), text: z.string().optional() }),
                )
                .optional(),
            }),
          ),
          usage,
        })
        .safeParse(raw)
    : z
        .object({
          choices: z
            .array(
              z.object({
                message: z.object({ content: z.string().nullable() }),
                finish_reason: z.string().nullable().optional(),
              }),
            )
            .min(1),
          usage,
        })
        .safeParse(raw);
  if (!parsed.success)
    throw new ProviderError(
      "Provider returned an unsupported completion response. Check the selected API style and model capabilities.",
    );
  const data = parsed.data;
  const text =
    "output" in data
      ? data.output
          .filter((v) => v.type === "message")
          .flatMap((v) => v.content ?? [])
          .filter((v) => v.type === "output_text")
          .map((v) => v.text ?? "")
          .join("")
      : data.choices[0].message.content;
  if (!text)
    throw new ProviderError(
      "Model returned no text. Tool-only, refusal-only, and non-text responses require a different capability adapter.",
    );
  return {
    text,
    model: endpoint.chatModel,
    endpointId: endpoint.id,
    usage: {
      inputTokens:
        data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? null,
      outputTokens:
        data.usage?.output_tokens ?? data.usage?.completion_tokens ?? null,
      totalTokens: data.usage?.total_tokens ?? null,
    },
  };
}
