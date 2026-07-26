export const READ_ATTEMPTS = 4;
export const READ_RETRY_DELAY_MS = 2_500;

export class RetryableReadError extends Error {}

export async function readWithBoundedRetry<T>(input: {
  read(): Promise<T>;
  wait(milliseconds: number): Promise<void>;
  terminalMessage: string;
}): Promise<T> {
  let lastError: RetryableReadError | undefined;

  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    try {
      return await input.read();
    } catch (error) {
      if (!(error instanceof RetryableReadError)) {
        throw error;
      }

      lastError = error;

      if (attempt < READ_ATTEMPTS) {
        await input.wait(READ_RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `${lastError?.message ?? 'Read state remained ambiguous.'} ${input.terminalMessage}`,
    { cause: lastError },
  );
}
