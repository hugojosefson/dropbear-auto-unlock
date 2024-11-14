/**
 * A signal to send to a process, along with a timeout in milliseconds for how long to wait for the process to exit after sending that signal.
 */
export type SignalWithTimeoutMs = [Deno.Signal, number];

/**
 * Kills a process with a signal, and waits for a timeout before killing it with the next signal. If the process exits before the timeout, the next signal is not sent.
 *
 * @param prc The process to kill.
 * @param signals The signals to send to the process, along with a timeout in milliseconds for how long to wait for the process to exit, before sending the next signal.
 * @param finallyKill9 Whether to kill the process with SIGKILL after the last signal is sent.
 * @returns The status of the process.
 */
export async function kill(
  prc: Deno.ChildProcess,
  signals: SignalWithTimeoutMs[],
  finallyKill9 = true,
): Promise<Deno.CommandStatus> {
  const aborter = new AbortController();
  prc.status.finally(() => aborter.abort());

  const killed = killWithSignals(aborter.signal, signals, prc, finallyKill9);
  await Promise.race([prc.status, killed]);

  return prc.status;
}

/**
 * Kills a process with a signal, and waits for a timeout before killing it with the next signal. If the process exits before the timeout, the next signal is not sent.
 *
 * @param aborter An {@linkcode AbortSignal} to abort the process killing.
 * @param prc The process to kill.
 * @param signals The signals to send to the process, along with a timeout in milliseconds for how long to wait for the process to exit, before sending the next signal.
 * @param finallyKill9 Whether to kill the process with SIGKILL after the last signal is sent.
 */
async function killWithSignals(
  aborter: AbortSignal,
  signals: SignalWithTimeoutMs[],
  prc: Deno.ChildProcess,
  finallyKill9: boolean,
): Promise<void> {
  while (!aborter.aborted && signals.length > 0) {
    const [signal, timeoutMs] = signals.shift()!;
    prc.kill(signal);
    await new Promise((resolve: (value: PromiseLike<void> | void) => void) => {
      const handle = setTimeout(resolve, timeoutMs);
      aborter.addEventListener("abort", () => {
        clearTimeout(handle);
        resolve();
      });
    });
  }
  if (!aborter.aborted && finallyKill9) {
    prc.kill("SIGKILL");
  }
}
