import { readdir, utimes } from 'node:fs/promises';
import { join } from 'node:path';

export async function normalizeArtifactTimes(path: string, fixedTime: Date): Promise<void> {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name);

    if (entry.isDirectory()) {
      await normalizeArtifactTimes(entryPath, fixedTime);
    }

    await utimes(entryPath, fixedTime, fixedTime);
  }
}
