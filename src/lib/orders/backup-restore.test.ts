import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const backupScript = path.join(projectRoot, 'scripts/db-backup.sh');
const restoreScript = path.join(projectRoot, 'scripts/db-restore.sh');
const temporaryDirectories: string[] = [];

function setupSandbox() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ecommerce-backup-test-'));
  temporaryDirectories.push(root);
  const bin = path.join(root, 'bin');
  const backups = path.join(root, 'backup files');
  mkdirSync(bin, { recursive: true });
  mkdirSync(backups, { recursive: true });

  const pgDump = path.join(bin, 'pg_dump');
  writeFileSync(
    pgDump,
    `#!/usr/bin/env bash
set -Eeuo pipefail
for arg in "$@"; do
  case "$arg" in --file=*) output="\${arg#--file=}";; esac
done
test -n "\${output:-}"
test -n "\${PGHOST:-}"
test -n "\${PGDATABASE:-}"
test -f "$PGPASSFILE"
test "$(stat -c %a "$PGPASSFILE")" = 600
printf 'fake-postgres-archive' > "$output"
`,
  );
  writeFileSync(
    path.join(bin, 'pg_restore'),
    `#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "\${1:-}" == "--list" ]]; then
  test -s "$2"
  exit 0
fi
target=''
for arg in "$@"; do
  case "$arg" in --dbname=*) target="\${arg#--dbname=}";; esac
done
test -n "$target"
printf '%s\n' "$target" >> "\${FAKE_RESTORE_LOG:?}"
`,
  );
  execFileSync('chmod', ['+x', pgDump, path.join(bin, 'pg_restore')]);

  writeFileSync(path.join(root, 'restore.log'), '');
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ''}`,
    DATABASE_URL: 'postgresql://test:secret%3Awith%3Acolon@localhost:5432/testdb?sslmode=disable',
    RESTORE_DATABASE_URL:
      'postgresql://test:secret%3Awith%3Acolon@localhost:5432/testdb?sslmode=disable',
    RESTORE_CONFIRM_DATABASE: 'testdb',
    BACKUP_DIR: backups,
    BACKUP_RETENTION_DAYS: '0',
    FAKE_RESTORE_LOG: path.join(root, 'restore.log'),
  };

  return { root, backups, env };
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return execFileSync(command, args, {
    cwd: projectRoot,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runExpectFailure(command: string, args: string[], env: NodeJS.ProcessEnv) {
  try {
    run(command, args, env);
    throw new Error('Expected command to fail, but it succeeded.');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Expected command to fail')) throw error;
    return error as Error & { status?: number; stderr?: Buffer | string };
  }
}

function createBackup(sandbox: ReturnType<typeof setupSandbox>) {
  run('bash', [backupScript], sandbox.env);
  const archives = readdirSync(sandbox.backups).filter((name) => name.endsWith('.dump'));
  expect(archives).toHaveLength(1);
  const archive = path.join(sandbox.backups, archives[0]!);
  expect(readFileSync(archive, 'utf8')).toBe('fake-postgres-archive');
  expect(readFileSync(`${archive}.sha256`, 'utf8')).toContain(archives[0]!);
  return archive;
}

describe('database backup and recovery scripts', () => {
  let sandbox: ReturnType<typeof setupSandbox>;

  beforeEach(() => {
    sandbox = setupSandbox();
  });

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('creates a validated PostgreSQL archive and matching checksum without printing credentials', () => {
    const output = run('bash', [backupScript], sandbox.env);

    expect(output).toContain('Backup created and verified:');
    expect(output).not.toContain('secret');
    const files = readdirSync(sandbox.backups);
    expect(files.filter((name) => name.endsWith('.dump'))).toHaveLength(1);
    expect(files.filter((name) => name.endsWith('.dump.sha256'))).toHaveLength(1);
  });

  it('restores only after checksum and explicit target-database confirmation pass', () => {
    const archive = createBackup(sandbox);
    const output = run('bash', [restoreScript, archive, '--confirm'], sandbox.env);

    expect(output).toContain('Restore completed.');
    expect(readFileSync(sandbox.env.FAKE_RESTORE_LOG!, 'utf8')).toBe('testdb\n');
  });

  it('refuses a target-database mismatch before invoking pg_restore', () => {
    const archive = createBackup(sandbox);
    const env = { ...sandbox.env, RESTORE_CONFIRM_DATABASE: 'production' };
    runExpectFailure('bash', [restoreScript, archive, '--confirm'], env);

    expect(readFileSync(sandbox.env.FAKE_RESTORE_LOG!, 'utf8')).toBe('');
  });

  it('refuses a checksum mismatch before invoking pg_restore', () => {
    const archive = createBackup(sandbox);
    writeFileSync(archive, 'modified archive');
    runExpectFailure('bash', [restoreScript, archive, '--confirm'], sandbox.env);

    expect(readFileSync(sandbox.env.FAKE_RESTORE_LOG!, 'utf8')).toBe('');
  });
});
