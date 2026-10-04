import { assertEquals, assertRejects } from "@std/assert";
import { waitFor } from "xstate";
import { fakeConnection } from "../../test/fake-connection.ts";
import { createUnlockActor } from "../lib/mod.ts";
import { runActors } from "./run-actors.ts";

const destinationAlternatives = [{ user: "root", host: "test", port: 22 }];

Deno.test("actor group rejects a connection cleanup error", async () => {
  const fake = fakeConnection();
  const failure = new Error("Test cleanup error.");
  const actor = createUnlockActor({
    destinationAlternatives,
    passphrase: "dummy",
    connect: () => ({
      ...fake.connection,
      close: () => Promise.reject(failure),
    }),
  });
  const running = runActors([actor]);
  actor.send({ type: "exit" });
  const error = await assertRejects(() => running);
  assertEquals(error, failure);
  assertEquals(fake.connection.output.locked, false);
});

Deno.test("actor group keeps the execution error when cleanup also rejects", async () => {
  const fake = fakeConnection();
  const failure = new Error("Test execution error.");
  const cleanupFailure = new Error("Test cleanup error.");
  const actor = createUnlockActor({
    destinationAlternatives,
    passphrase: "dummy",
    connect: () => ({
      ...fake.connection,
      close: () => Promise.reject(cleanupFailure),
    }),
  });
  const brokenActor = createUnlockActor({
    destinationAlternatives,
    passphrase: "dummy",
    logger: {
      log() {
        throw failure;
      },
    },
  });
  const error = await assertRejects(() => runActors([actor, brokenActor]));
  assertEquals(error, failure);
  assertEquals(actor.getSnapshot().context.cleanupError, cleanupFailure);
});

Deno.test("actor group stops other actors after a cleanup error", async () => {
  const failed = fakeConnection();
  const active = fakeConnection();
  const failure = new Error("Test cleanup error.");
  const failingActor = createUnlockActor({
    destinationAlternatives,
    passphrase: "dummy",
    connect: () => ({
      ...failed.connection,
      close: () => Promise.reject(failure),
    }),
  });
  const activeActor = createUnlockActor({
    destinationAlternatives,
    passphrase: "dummy",
    connect: () => active.connection,
  });
  const running = runActors([failingActor, activeActor]);
  const rejected = assertRejects(() => running);
  try {
    await active.emit("root@server:~# ");
    await active.written;
    failed.exit();
    await waitFor(activeActor, (snapshot) => snapshot.status === "done", {
      timeout: 1000,
    });
    assertEquals(await rejected, failure);
    assertEquals(active.closeCount, 1);
    assertEquals(active.connection.output.locked, false);
  } finally {
    failingActor.send({ type: "exit" });
    activeActor.send({ type: "exit" });
    await rejected;
  }
});
