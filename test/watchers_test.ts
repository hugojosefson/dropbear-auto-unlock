import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import {
  type SshDestination,
  startUnlockWatchers,
} from "@hugojosefson/dropbear-auto-unlock";
import { fakeConnection } from "./fake-connection.ts";

const prompt = "Unlocking encrypted ZFS filesystems...\n" +
  "Enter the password or press Ctrl-C to exit.\n" +
  "Encrypted ZFS password for rpool/ROOT: (press TAB for no echo) ";

async function until(check: () => boolean): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > 5000) {
      throw new Error("Timed out waiting for the machine to settle.");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

Deno.test("watchers accept groups and a passphrase without CLI input", async () => {
  const left = fakeConnection();
  const right = fakeConnection();
  const connected: SshDestination[] = [];
  const watchers = await startUnlockWatchers({
    destinationGroups: [["primary", "backup:2222"], ["alice@second:2200"]],
    passphrase: "dummy",
    connect(destination) {
      connected.push(destination);
      return connected.length === 1 ? left.connection : right.connection;
    },
  });
  try {
    assertEquals(connected, [
      { user: "root", host: "primary", port: undefined },
      { user: "alice", host: "second", port: 2200 },
    ]);
    await left.emit(prompt);
    await right.emit(prompt);
    await Promise.all([left.written, right.written]);
    assertEquals(left.writes, ["dummy"]);
    assertEquals(right.writes, ["dummy"]);
  } finally {
    assertStrictEquals(watchers.stop(), watchers.done);
    assertStrictEquals(watchers.stop(), watchers.done);
    await watchers.done;
  }
  assertEquals([left.closeCount, right.closeCount], [1, 1]);
});

Deno.test("watchers validate all groups before starting a connection", async () => {
  let connections = 0;
  for (
    const destinationGroups of [[], [[]], [["valid"], []], [["valid"], [
      "bad:0",
    ]]]
  ) {
    await assertRejects(() =>
      startUnlockWatchers({
        destinationGroups,
        passphrase: "dummy",
        connect() {
          connections++;
          throw new Error("No connection should start.");
        },
      })
    );
  }
  assertEquals(connections, 0);
});

Deno.test("watchers wait for cleanup before completing", async () => {
  const gate = Promise.withResolvers<void>();
  const fake = fakeConnection(gate.promise);
  const watchers = await startUnlockWatchers({
    destinationGroups: [[{ user: "root", host: "test" }]],
    passphrase: "dummy",
    connect: () => fake.connection,
  });
  let finished = false;
  void watchers.done.then(() => finished = true);
  const stopped = watchers.stop();
  await fake.cancelled;
  assertEquals(finished, false);
  gate.resolve();
  await stopped;
  assertEquals(finished, true);
});

Deno.test("a fatal cleanup error stops every watcher", async () => {
  const failed = fakeConnection();
  const peer = fakeConnection();
  const failure = new Error("Dummy cleanup failure.");
  const watchers = await startUnlockWatchers({
    destinationGroups: [["failed"], ["peer"]],
    passphrase: "dummy",
    connect: (destination) =>
      destination.host === "peer" ? peer.connection : {
        ...failed.connection,
        close: () => Promise.reject(failure),
      },
  });
  const rejected = assertRejects(() => watchers.done);
  failed.exit();
  assertStrictEquals(await rejected, failure);
  assertEquals(peer.closeCount, 1);
  assertStrictEquals(await assertRejects(() => watchers.stop()), failure);
});

Deno.test("watchers cancel an asynchronous passphrase provider on stop", async () => {
  const fake = fakeConnection();
  const requested = Promise.withResolvers<AbortSignal>();
  const value = Promise.withResolvers<string>();
  const watchers = await startUnlockWatchers({
    destinationGroups: [["test"]],
    passphrase: (signal) => {
      requested.resolve(signal);
      return value.promise;
    },
    connect: () => fake.connection,
  });
  await fake.emit(prompt);
  const signal = await requested.promise;
  await watchers.stop();
  assertEquals(signal.aborted, true);
  value.resolve("dummy");
  await Promise.resolve();
  assertEquals(fake.writes, []);
});

Deno.test("a hold prompt holds the session without a passphrase", async () => {
  const fake = fakeConnection();
  const watchers = await startUnlockWatchers({
    destinationGroups: [["test"]],
    passphrase: () => {
      throw new Error("No passphrase is necessary for a hold prompt.");
    },
    connect: () => fake.connection,
  });
  try {
    await fake.emit("sleeping for you, please hold\n");
    await until(() =>
      watchers.snapshot().every((snap) =>
        snap.matches({ session: "runningSleepInfinity" })
      )
    );
    assertEquals(fake.writes, ["sleep infinity"]);
  } finally {
    await watchers.stop();
    await watchers.done;
  }
});

Deno.test("snapshot reports the state of every server in group order", async () => {
  const left = fakeConnection();
  const right = fakeConnection();
  const watchers = await startUnlockWatchers({
    destinationGroups: [["primary"], ["alice@second:2200"]],
    passphrase: "dummy",
    connect: (destination) =>
      destination.host === "primary" ? left.connection : right.connection,
  });
  try {
    const snapshots = () => watchers.snapshot();
    assertEquals(snapshots().length, 2);
    assertEquals(
      snapshots()[1].context.destinationAlternatives[0].host,
      "second",
    );
    await left.emit(prompt);
    await right.emit(prompt);
    await Promise.all([left.written, right.written]);
    assertEquals(
      snapshots()[0].matches({ session: "enteringPassphrase" }),
      true,
    );
    assertEquals(
      snapshots()[1].matches({ session: "enteringPassphrase" }),
      true,
    );
    await left.emit("root@server:~# ");
    await right.emit("root@server:~# ");
    await until(() =>
      snapshots().every((snap) =>
        snap.matches({ session: "runningSleepInfinity" })
      )
    );
  } finally {
    await watchers.stop();
    await watchers.done;
  }
});

Deno.test("a connection error is logged before the retry", async () => {
  const lines: string[] = [];
  const fake = fakeConnection();
  const closed = Promise.withResolvers<never>();
  const watchers = await startUnlockWatchers({
    destinationGroups: [["test"]],
    passphrase: "dummy",
    connect: () => ({ ...fake.connection, closed: closed.promise }),
    logger: { log: (message) => lines.push(message) },
  });
  try {
    closed.reject(new Error("Dummy connection failure"));
    await until(() =>
      lines.includes(
        "[test] Connection closed: Error: Dummy connection failure.",
      )
    );
    await until(() => lines.includes("[test] Retrying."));
  } finally {
    await watchers.stop();
    await watchers.done;
  }
});

Deno.test("a fatal logger error waits for connection cleanup", async () => {
  const gate = Promise.withResolvers<void>();
  const closing = Promise.withResolvers<void>();
  const fake = fakeConnection(gate.promise);
  const failure = new Error("Dummy logger failure.");
  const watchers = await startUnlockWatchers({
    destinationGroups: [["test"]],
    passphrase: "dummy",
    connect: () => ({
      ...fake.connection,
      close() {
        closing.resolve();
        return fake.connection.close();
      },
    }),
    logger: {
      log(message) {
        if (message.includes("Waiting for the server to restart.")) {
          throw failure;
        }
      },
    },
  });
  let finished = false;
  const rejected = assertRejects(() => watchers.done).then((error) => {
    finished = true;
    return error;
  });
  await fake.emit("root@server:~# ");
  await closing.promise;
  await Promise.resolve();
  assertEquals(finished, false);
  gate.resolve();
  assertStrictEquals(await rejected, failure);
  await fake.cancelled;
  assertEquals(fake.closeCount, 1);
});
