import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { Db } from "../../apps/api/src/db";
// This test only runs on an uninitialized identity store. It never resets accounts.
test("first administrator can create a workspace, sign out and sign in", async ({
  page,
}) => {
  const db = new Db(),
    email = `bootstrap-${randomUUID()}@example.test`,
    password = randomBytes(24).toString("hex");
  try {
    test.skip(
      (await db.user.count()) > 0,
      "First-administrator setup is already complete; preserve existing accounts.",
    );
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/onboarding.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create workspace", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Make the next thing happen." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Make the next thing happen." }),
    ).toBeVisible();
  } finally {
    const user = await db.user.findUnique({
      where: { email },
      include: { memberships: true },
    });
    if (user) {
      const workspaces = user.memberships.map((m) => m.workspaceId);
      await db.user.delete({ where: { id: user.id } });
      await db.workspace.deleteMany({ where: { id: { in: workspaces } } });
    }
    await db.$disconnect();
  }
});
