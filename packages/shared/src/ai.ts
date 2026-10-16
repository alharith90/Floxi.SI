import { z } from "zod";
export const EndpointCreate = z
  .object({
    name: z.string().trim().min(1).max(100),
    baseUrl: z.url().max(500),
    apiStyle: z
      .enum(["chat-completions", "responses"])
      .default("chat-completions"),
    chatModel: z.string().trim().min(1).max(200).nullable().default(null),
    embeddingModel: z.string().trim().min(1).max(200).nullable().default(null),
    dimensions: z.number().int().min(1).max(4096).nullable().default(null),
    credentialEnv: z
      .string()
      .regex(/^FLOXI_MODEL_KEY_[A-Z0-9_]+$/)
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((v, c) => {
    if (!v.chatModel && !v.embeddingModel)
      c.addIssue({
        code: "custom",
        message: "Configure a chat model, an embedding model, or both.",
      });
    if (v.embeddingModel && !v.dimensions)
      c.addIssue({
        code: "custom",
        message:
          "Embedding dimensions are required and must match your provider.",
      });
  });
export const KnowledgeCreate = z
  .object({ name: z.string().trim().min(1).max(100), endpointId: z.uuid() })
  .strict();
export const DocumentCreate = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(50000),
  })
  .strict();
export const SearchKnowledge = z
  .object({
    query: z.string().trim().min(1).max(8000),
    topK: z.number().int().min(1).max(10).default(5),
  })
  .strict();
export type ModelEndpoint = z.output<typeof EndpointCreate> & {
  id: string;
  health: string;
  lastError: string | null;
  testedAt: string | null;
  credentialConfigured: boolean;
  createdAt: string;
};
export type KnowledgeBase = {
  id: string;
  name: string;
  endpointId: string;
  endpoint: { name: string; embeddingModel: string; dimensions: number };
  _count: { documents: number };
};
export type KnowledgeDocument = {
  id: string;
  title: string;
  status: string;
  error: string | null;
  chunkCount: number;
  createdAt: string;
};
export type Retrieval = {
  query: string;
  context: string;
  matches: {
    chunkId: string;
    documentId: string;
    title: string;
    ordinal: number;
    body: string;
    distance: number;
    citation: string;
  }[];
};
