import { readFileSync } from 'node:fs';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class PilotStateSaveError extends Error {}

export function createPilotStateStore<T>(options: {
  file?: string;
  initial: T;
  parse: (value: unknown) => T;
  forDisk: (state: T) => T;
}) {
  let state = options.initial;
  if (options.file) {
    try {
      const saved = JSON.parse(readFileSync(options.file, 'utf8'));
      if (saved?.version !== 1) throw new Error('Unsupported state version');
      state = options.parse(saved.state);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error('Cannot load saved pilot state. Preserve the file and check its contents before restarting.', { cause: error });
      }
    }
  }

  let pending = Promise.resolve();
  return {
    read: () => state,
    update(change: (previous: T) => T): Promise<T> {
      const operation = pending.then(async () => {
        const next = change(state);
        if (options.file) {
          const temporary = `${options.file}.${randomUUID()}.tmp`;
          try {
            await mkdir(dirname(options.file), { recursive: true, mode: 0o700 });
            await writeFile(temporary, JSON.stringify({ version: 1, state: options.forDisk(next) }), { flag: 'wx', mode: 0o600 });
            await rename(temporary, options.file);
          } catch (error) {
            throw new PilotStateSaveError('pilot-state-save-failed', { cause: error });
          } finally {
            await unlink(temporary).catch(() => undefined);
          }
        }
        state = next;
        return state;
      });
      pending = operation.then(() => undefined, () => undefined);
      return operation;
    },
  };
}
