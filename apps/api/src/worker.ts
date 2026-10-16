import { Db } from "./db.js";
import { tick } from "./execution/engine.js";
const db = new Db();
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
console.log("Floxi database-backed worker started");
while (!stopping) {
  try {
    const worked = await tick(db);
    await new Promise((r) => setTimeout(r, worked ? 50 : 500));
  } catch (error) {
    console.error(
      "Worker transaction failed",
      error instanceof Error ? error.name : "Unknown",
    );
    await new Promise((r) => setTimeout(r, 1000));
  }
}
await db.$disconnect();
