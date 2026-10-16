import { test, expect } from "@playwright/test";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Db } from "../../apps/api/src/db";
import { tick } from "../../apps/api/src/execution/engine";
import type { Workflow } from "@floxi/shared";
test.describe.configure({ mode: "serial" });
const db = new Db(),
  uid = randomUUID(),
  wid = randomUUID(),
  token = randomBytes(32).toString("hex");
let worker: ReturnType<typeof setInterval>,
  busy = false;
test.beforeAll(async () => {
  await db.user.create({
    data: {
      id: uid,
      email: `browser-${uid}@example.test`,
      passwordHash: "not-a-login",
      memberships: {
        create: {
          role: "admin",
          workspace: { create: { id: wid, name: "Browser test workspace" } },
        },
      },
    },
  });
  await db.session.create({
    data: {
      id: createHash("sha256").update(token).digest("hex"),
      userId: uid,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  worker = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await tick(db);
    } finally {
      busy = false;
    }
  }, 100);
});
test.afterAll(async () => {
  clearInterval(worker);
  while (busy) await new Promise((r) => setTimeout(r, 20));
  const flows = await db.workflow.findMany({ where: { workspaceId: wid } }),
    ids = flows.map((f) => f.id);
  const runs = await db.run.findMany({ where: { workflowId: { in: ids } } }),
    rids = runs.map((r) => r.id);
  await db.runEvent.deleteMany({ where: { runId: { in: rids } } });
  await db.step.deleteMany({ where: { runId: { in: rids } } });
  await db.run.deleteMany({ where: { id: { in: rids } } });
  await db.version.deleteMany({ where: { workflowId: { in: ids } } });
  await db.workflow.deleteMany({ where: { id: { in: ids } } });
  await db.modelEndpoint.deleteMany({ where: { workspaceId: wid } });
  await db.audit.deleteMany({ where: { workspaceId: wid } });
  await db.user.delete({ where: { id: uid } });
  await db.workspace.delete({ where: { id: wid } });
  await db.$disconnect();
});
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "floxi_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
});
test("create, connect, configure, save, publish, execute, map real output and inspect history", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => {
    consoleErrors.push(e.message);
    console.log("PAGE ERROR", e.message);
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make the next thing happen." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create workflow", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Workflow name" })
    .fill("Customer intake");
  await page
    .getByRole("textbox", { name: "Description (optional)" })
    .fill("Normalize customer data and return a consistent response.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create workflow" })
    .click();
  await expect(page).toHaveURL(/\/studio\/flows\/.+\/editor/);
  const id = page.url().split("/").at(-2)!;
  await page.getByRole("button", { name: "Add manual trigger" }).click();
  await page.getByRole("button", { name: "Add node", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Set fields/ })
    .click();
  await page.getByRole("button", { name: "Add node", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Response/ })
    .click();
  const nodes = page.locator(".react-flow__node");
  await expect(nodes).toHaveCount(3);
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  const dragHandle = async (source: number, target: number) => {
    const a = await nodes.nth(source).locator(".source").boundingBox(),
      b = await nodes.nth(target).locator(".target").boundingBox();
    if (!a || !b) throw new Error("Missing node handles");
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
    await page.mouse.up();
  };
  await dragHandle(0, 1);
  await dragHandle(1, 2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await nodes.nth(1).dblclick({ delay: 100 });
  await page
    .getByLabel("Fields to merge")
    .fill('{"message":"Welcome to Floxi"}');
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByText(/All changes saved/)).toBeVisible({
    timeout: 10000,
  });
  const flowResponse = await page.request.get(`/api/workflows/${id}`);
  const flow = (await flowResponse.json()) as Workflow;
  await nodes.nth(2).dblclick({ delay: 100 });
  await page.getByLabel("Response body").fill(
    JSON.stringify({
      message: {
        mode: "reference",
        nodeId: flow.graph.nodes[1].id,
        path: "message",
      },
    }),
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByText(/All changes saved/)).toBeVisible({
    timeout: 10000,
  });
  await page.reload();
  await expect(nodes).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Workflow validation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("button", { name: "Run v1" })).toBeEnabled();
  await page.getByRole("button", { name: "Run v1" }).click();
  await page
    .getByLabel("Trigger input (JSON object)")
    .fill('{"email":"customer@example.test"}');
  await page.getByRole("button", { name: "Start execution" }).click();
  await expect(
    page.locator(".run-dock").getByText("SUCCEEDED", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await nodes.nth(2).dblclick({ delay: 100 });
  await expect(
    page
      .getByRole("dialog")
      .getByText("Welcome to Floxi", { exact: false })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/workbench-light.png",
    fullPage: true,
    animations: "disabled",
  });
  // Map actual output using a native drag event and the same durable payload as pointer DnD.
  const field = page
    .getByRole("dialog")
    .locator(".work-pane")
    .first()
    .locator(".draggable-value")
    .filter({ hasText: "email" })
    .first();
  const target = page.getByLabel("Response body");
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await field.dispatchEvent("dragstart", { dataTransfer: transfer });
  await target.dispatchEvent("drop", { dataTransfer: transfer });
  await expect(target).toHaveValue(/"mode": "reference"/);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByText(/All changes saved/)).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Run v2" }).click();
  await page
    .getByLabel("Trigger input (JSON object)")
    .fill('{"email":"mapped@example.test"}');
  await page.getByRole("button", { name: "Start execution" }).click();
  await expect(
    page.locator(".run-dock").getByText("SUCCEEDED", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await nodes.nth(2).dblclick({ delay: 100 });
  await expect(
    page
      .getByRole("dialog")
      .getByText("mapped@example.test", { exact: false })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Back to Studio" }).click();
  await expect(
    page.getByRole("link", { name: "Customer intake", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/studio-light.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Dark appearance" }).click();
  await page.screenshot({
    path: "docs/screenshots/studio-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("link", { name: "Customer intake", exact: true })
    .click();
  await nodes.nth(1).dblclick({ delay: 100 });
  await page.screenshot({
    path: "docs/screenshots/workbench-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Back to Studio" }).click();
  await page.getByRole("button", { name: "Light appearance" }).click();
  await page.getByRole("link", { name: "Executions", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Customer intake" }).first(),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
test("responsive Studio, search, duplicate, archive and restore", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Duplicate Customer intake" }).click();
  await expect(
    page.getByRole("link", { name: "Customer intake (copy)", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search workflows" }).fill("copy");
  await expect(
    page.getByRole("link", { name: "Customer intake", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search workflows" }).fill("");
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Archive Customer intake (copy)" })
    .click();
  await page.getByRole("tab", { name: "Archived" }).click();
  await expect(
    page.getByRole("link", { name: "Customer intake (copy)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restore Customer intake (copy)" })
    .click();
  await expect(
    page.getByRole("link", { name: "Customer intake (copy)", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "All workflows" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/studio-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({
    path: "docs/screenshots/studio-1366.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({
    path: "docs/screenshots/studio-1920.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("protects unsaved edits during internal navigation", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Customer intake (copy)", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Workflow name" })
    .fill("Navigation protected");
  await page.getByRole("link", { name: "Back to Studio" }).click();
  await expect(
    page.getByRole("dialog", { name: "Save your changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save and leave" }).click();
  await expect(
    page.getByRole("link", { name: "Navigation protected", exact: true }),
  ).toBeVisible();
});

test("recovers from a failed refresh without exposing a stale editable draft", async ({
  page,
}) => {
  await page.goto("/");
  const link = page.getByRole("link", {
      name: "Navigation protected",
      exact: true,
    }),
    href = await link.getAttribute("href");
  await link.click();
  await expect(
    page.getByRole("textbox", { name: "Workflow name" }),
  ).toHaveValue("Navigation protected");
  await page.getByRole("link", { name: "Back to Studio" }).click();
  const id = href!.split("/").at(-2),
    pattern = `**/api/workflows/${id}`;
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Workflow service temporarily unavailable. Retry shortly.",
      }),
    }),
  );
  await link.click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await page.unroute(pattern);
  await page.getByRole("button", { name: "Reload workflow" }).click();
  await expect(
    page.getByRole("textbox", { name: "Workflow name" }),
  ).toHaveValue("Navigation protected");
});

test("administrator registers a model and sees persisted connection errors", async ({
  page,
}) => {
  await page.goto("/models");
  await expect(
    page.getByRole("heading", { name: "Models", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Browser model endpoint");
  await page.getByLabel("Base URL").fill("https://api.openai.com/v1");
  await page.getByLabel("Chat model", { exact: true }).fill("fixture-model");
  await page
    .getByLabel("Credential environment variable (optional)")
    .fill("FLOXI_MODEL_KEY_BROWSER_MISSING");
  await page.getByRole("button", { name: "Add endpoint", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser model endpoint" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser model endpoint" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(
    page.getByText(
      "The configured model credential binding is not available on the server.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Endpoint", { exact: true })
    .selectOption({ label: "Browser model endpoint" });
  await page.getByLabel("Prompt", { exact: true }).fill("Hello");
  await page
    .getByRole("button", { name: "Generate text", exact: true })
    .click();
  await expect(page.locator(".error-note")).toContainText(
    "The configured model credential binding is not available on the server.",
  );
  await page.screenshot({
    path: "docs/screenshots/models.png",
    fullPage: true,
    animations: "disabled",
  });
});
