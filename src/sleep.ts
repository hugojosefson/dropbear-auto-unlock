export async function sleep(ms: number) {
  let timeoutHandle: number | undefined;
  let resolver: (value: void) => void;
  const promise = new Promise((resolve) => {
    resolver = resolve;
    timeoutHandle = setTimeout(resolver, ms);
  });
  const cancel = () => {
    clearTimeout(timeoutHandle);
    resolver();
  };
  Deno.addSignalListener("SIGINT", cancel);
  await promise;
  Deno.removeSignalListener("SIGINT", cancel);
}
