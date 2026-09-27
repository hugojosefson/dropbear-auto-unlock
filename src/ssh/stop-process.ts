export async function stopProcess(process: Deno.ChildProcess): Promise<void> {
  try {
    process.kill("SIGTERM");
  } catch (error) {
    if (
      !(error instanceof Deno.errors.NotFound) &&
      !(error instanceof TypeError &&
        error.message === "Child process has already terminated")
    ) {
      throw error;
    }
  }
  const exited = await new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => resolve(false), 250);
    process.status.then(() => {
      clearTimeout(timer);
      resolve(true);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  if (!exited) {
    try {
      process.kill("SIGKILL");
    } catch (error) {
      if (
        !(error instanceof Deno.errors.NotFound) &&
        !(error instanceof TypeError &&
          error.message === "Child process has already terminated")
      ) {
        throw error;
      }
    }
  }
  await process.status;
}
