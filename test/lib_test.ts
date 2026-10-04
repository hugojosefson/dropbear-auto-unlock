import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { createActor, SimulatedClock, waitFor } from "xstate";
import {
  createUnlockActor,
  type SshDestination,
  stopUnlockActor,
  unlockMachine,
  type UnlockOptions,
} from "../src/lib/mod.ts";
import { fakeConnection } from "./fake-connection.ts";

const first: SshDestination = { user: "root", host: "first.example" };
const second: SshDestination = {
  user: "root",
  host: "second.example",
  port: 2222,
};
const prompt = "Unlocking encrypted ZFS filesystems...\n" +
  "Enter the password or press Ctrl-C to exit.\n" +
  "Encrypted ZFS password for rpool/ROOT: (press TAB for no echo) ";

function options(
  fake: ReturnType<typeof fakeConnection>,
  changes: Partial<UnlockOptions> = {},
): UnlockOptions {
  return {
    destinationAlternatives: [first],
    passphrase: () => "test-value",
    connect: () => fake.connection,
    ...changes,
  };
}

Deno.test("the actor connects only after start", async () => {
  const fake = fakeConnection();
  const connected: SshDestination[] = [];
  const actor = createUnlockActor(options(fake, {
    connect(destination) {
      connected.push(destination);
      return fake.connection;
    },
  }));
  assertEquals(connected, []);
  actor.start();
  try {
    assertEquals(connected, [first]);
    assert(actor.getSnapshot().matches({ session: "readingOutput" }));
  } finally {
    await stopUnlockActor(actor);
  }
});

Deno.test("the actor reads a prompt in two chunks and writes one passphrase", async () => {
  const fake = fakeConnection();
  let requests = 0;
  const actor = createUnlockActor(options(fake, {
    passphrase: () => {
      requests++;
      return "test-value";
    },
  }));
  actor.start();
  try {
    await fake.emit(prompt.slice(0, 31));
    assertEquals(requests, 0);
    await fake.emit(prompt.slice(31));
    await fake.written;
    assertEquals(fake.writes, ["test-value"]);
    await fake.emit(prompt);
    await fake.emit("root@server:~# ");
    await waitFor(
      actor,
      (snapshot) => snapshot.matches({ session: "runningSleepInfinity" }),
    );
    await stopUnlockActor(actor);
    assertEquals(requests, 1);
    assertEquals(fake.writes, ["test-value", "sleep infinity"]);
  } finally {
    actor.stop();
  }
});

Deno.test("a shell prompt waits for disconnection before retry", async () => {
  const clock = new SimulatedClock();
  const fake = fakeConnection();
  const next = fakeConnection();
  const connected: SshDestination[] = [];
  const actor = createActor(unlockMachine, {
    clock,
    input: options(fake, {
      destinationAlternatives: [first, second],
      retryDelayMs: 100,
      promptTimeoutMs: 50,
      connect(destination) {
        connected.push(destination);
        return connected.length === 1 ? fake.connection : next.connection;
      },
    }),
  }).start();
  try {
    await fake.emit("root@server:~# ");
    await fake.written;
    assertEquals(fake.writes, ["sleep infinity"]);
    clock.increment(1000);
    assertEquals(connected, [first]);
    fake.exit();
    await waitFor(actor, (snapshot) => snapshot.matches("sleeping"));
    clock.increment(99);
    assertEquals(connected, [first]);
    clock.increment(1);
    assertEquals(connected, [first, second]);
  } finally {
    await stopUnlockActor(actor);
  }
});

Deno.test("a connection timeout selects the next address", async () => {
  const clock = new SimulatedClock();
  const fake = fakeConnection();
  const next = fakeConnection();
  const connected: SshDestination[] = [];
  const actor = createActor(unlockMachine, {
    clock,
    input: options(fake, {
      destinationAlternatives: [first, second],
      promptTimeoutMs: 50,
      retryDelayMs: 100,
      connect(destination) {
        connected.push(destination);
        return connected.length === 1 ? fake.connection : next.connection;
      },
    }),
  }).start();
  try {
    clock.increment(50);
    await waitFor(actor, (snapshot) => snapshot.matches("sleeping"));
    assertEquals(fake.closeCount, 1);
    clock.increment(100);
    assertEquals(connected, [first, second]);
  } finally {
    await stopUnlockActor(actor);
  }
});

Deno.test("a passphrase error closes the connection without a write", async () => {
  const fake = fakeConnection();
  const failure = new Error("Test provider failure.");
  const actor = createUnlockActor(options(fake, {
    passphrase: () => Promise.reject(failure),
  }));
  actor.start();
  try {
    await fake.emit(prompt);
    await waitFor(actor, (snapshot) => snapshot.matches("sleeping"));
    assertEquals(fake.writes, []);
    assertEquals(fake.closeCount, 1);
    assertEquals(actor.getSnapshot().context.lastError, failure);
  } finally {
    await stopUnlockActor(actor);
  }
});

Deno.test("exit waits for the connection to close", async () => {
  const closeGate = Promise.withResolvers<void>();
  const fake = fakeConnection(closeGate.promise);
  const actor = createUnlockActor(options(fake));
  actor.start();
  const stopped = stopUnlockActor(actor);
  await fake.cancelled;
  assertEquals(actor.getSnapshot().status, "active");
  assert(actor.getSnapshot().matches({ session: "stopping" }));
  closeGate.resolve();
  await stopped;
  assertEquals(actor.getSnapshot().status, "done");
  assertEquals(fake.closeCount, 1);
});

Deno.test("actor.stop cancels the provider and closes the connection", async () => {
  const fake = fakeConnection();
  const requested = Promise.withResolvers<AbortSignal>();
  const provider = Promise.withResolvers<string>();
  const actor = createUnlockActor(options(fake, {
    passphrase: (signal) => {
      requested.resolve(signal);
      return provider.promise;
    },
  }));
  actor.start();
  await fake.emit(prompt);
  const signal = await requested.promise;
  actor.stop();
  await fake.cancelled;
  assert(signal.aborted);
  provider.resolve("test-value");
  await Promise.resolve();
  assertEquals(fake.writes, []);
  assertEquals(fake.closeCount, 1);
});

Deno.test("actors have different connections and passphrases", async () => {
  const left = fakeConnection();
  const right = fakeConnection();
  const firstActor = createUnlockActor(
    options(left, { passphrase: "left-value" }),
  );
  firstActor.start();
  const secondActor = createUnlockActor(
    options(right, { passphrase: "right-value" }),
  );
  secondActor.start();
  try {
    await left.emit(prompt);
    await right.emit(prompt);
    await Promise.all([left.written, right.written]);
    assertEquals(left.writes, ["left-value"]);
    assertEquals(right.writes, ["right-value"]);
    await stopUnlockActor(firstActor);
    assertEquals(secondActor.getSnapshot().status, "active");
    assertEquals(right.closeCount, 0);
  } finally {
    firstActor.stop();
    await stopUnlockActor(secondActor);
  }
});

Deno.test("invalid options cause an error before an actor starts", () => {
  const fake = fakeConnection();
  for (
    const changes of [
      { destinationAlternatives: [] },
      { destinationAlternatives: [{ ...first, port: 0 }] },
      { destinationAlternatives: [{ ...first, host: "" }] },
      { retryDelayMs: 0 },
      { retryDelayMs: Infinity },
      { promptTimeoutMs: -1 },
      { promptTimeoutMs: NaN },
    ]
  ) {
    assertThrows(() => createUnlockActor(options(fake, changes)), TypeError);
  }
  assertEquals(fake.closeCount, 0);
});

Deno.test("a connector error permits the next address", async () => {
  const clock = new SimulatedClock();
  const fake = fakeConnection();
  const failure = new Error("Test connector failure.");
  const connected: SshDestination[] = [];
  const actor = createActor(unlockMachine, {
    clock,
    input: options(fake, {
      destinationAlternatives: [first, second],
      retryDelayMs: 100,
      connect(destination) {
        connected.push(destination);
        if (connected.length === 1) {
          throw failure;
        }
        return fake.connection;
      },
    }),
  }).start();
  try {
    await waitFor(actor, (snapshot) => snapshot.matches("sleeping"));
    assertEquals(actor.getSnapshot().context.lastError, failure);
    clock.increment(100);
    assertEquals(connected, [first, second]);
  } finally {
    await stopUnlockActor(actor);
  }
});

Deno.test("the actor reads a prompt with ANSI codes in two chunks", async () => {
  const fake = fakeConnection();
  const actor = createUnlockActor(options(fake));
  actor.start();
  try {
    await fake.emit("\x1b[");
    await fake.emit(`32m${prompt}\x1b[0m`);
    await fake.written;
    assertEquals(fake.writes, ["test-value"]);
  } finally {
    await stopUnlockActor(actor);
  }
});

Deno.test("a locked output stream permits connection cleanup", async () => {
  const closeGate = Promise.withResolvers<void>();
  const fake = fakeConnection(closeGate.promise);
  const reader = fake.connection.output.getReader();
  const actor = createUnlockActor(options(fake));
  actor.start();
  try {
    const stopped = stopUnlockActor(actor);
    assert(actor.getSnapshot().matches({ session: "stopping" }));
    closeGate.resolve();
    await stopped;
    assertEquals(fake.closeCount, 1);
    assertEquals(actor.getSnapshot().status, "done");
    assert(actor.getSnapshot().context.lastError instanceof TypeError);
  } finally {
    actor.stop();
    await reader.cancel();
    reader.releaseLock();
  }
});

Deno.test("a cleanup error rejects shutdown and releases the output lock", async () => {
  const fake = fakeConnection();
  const failure = new Error("Test cleanup failure.");
  const actor = createUnlockActor(options(fake, {
    connect: () => ({
      ...fake.connection,
      close: () => Promise.reject(failure),
    }),
  }));
  actor.start();
  await assertRejects(() => stopUnlockActor(actor), Error, failure.message);
  assertEquals(actor.getSnapshot().context.cleanupError, failure);
  assertEquals(fake.connection.output.locked, false);
});

Deno.test("a synchronous cleanup error rejects shutdown", async () => {
  const fake = fakeConnection();
  const failure = new Error("Test cleanup failure.");
  const actor = createUnlockActor(options(fake, {
    connect: () => ({
      ...fake.connection,
      close: () => {
        throw failure;
      },
    }),
  }));
  actor.start();
  await assertRejects(() => stopUnlockActor(actor), Error, failure.message);
  assertEquals(fake.connection.output.locked, false);
});

Deno.test("stopUnlockActor rejects after actor.stop", async () => {
  const fake = fakeConnection();
  const actor = createUnlockActor(options(fake));
  actor.start();
  actor.stop();
  await assertRejects(
    () => stopUnlockActor(actor),
    Error,
    "Cannot wait for cleanup after actor.stop().",
  );
  await fake.cancelled;
  assertEquals(fake.closeCount, 1);
});

Deno.test("a cleanup error stops retries and rejects shutdown", async () => {
  const clock = new SimulatedClock();
  const fake = fakeConnection();
  const failure = new Error("Test cleanup failure.");
  const connected: SshDestination[] = [];
  const actor = createActor(unlockMachine, {
    clock,
    input: options(fake, {
      destinationAlternatives: [first, second],
      promptTimeoutMs: 50,
      retryDelayMs: 100,
      connect(destination) {
        connected.push(destination);
        return {
          ...fake.connection,
          close: () => Promise.reject(failure),
        };
      },
    }),
  }).start();
  try {
    clock.increment(50);
    await waitFor(actor, (snapshot) => snapshot.status === "done");
    clock.increment(100);
    assertEquals(connected, [first]);
    assertEquals(actor.getSnapshot().context.cleanupError, failure);
    assertEquals(actor.getSnapshot().context.lastError, failure);
    assertEquals(fake.connection.output.locked, false);
    await assertRejects(() => stopUnlockActor(actor), Error, failure.message);
    assertEquals(actor.getSnapshot().context.cleanupError, failure);
  } finally {
    actor.stop();
  }
});
