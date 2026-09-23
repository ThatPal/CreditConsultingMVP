import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const cases = [
  ['missing', '', 'test', false],
  ['shared', 'postgresql://localhost/credit_strategy', 'test', false],
  ['demo', 'postgresql://localhost/credit_strategy_astra', 'test', false],
  ['remote', 'postgresql://example.test/credit_strategy_entry_f1_test', 'test', false],
  ['production', 'postgresql://localhost/credit_strategy_entry_f1_test', 'production', false],
  ['wrong protocol', 'https://localhost/credit_strategy_entry_f1_test', 'test', false],
  [
    'explicit disposable loopback',
    'postgresql://127.0.0.1/credit_strategy_entry_f1_test',
    'test',
    true,
  ],
];
for (const [name, DATABASE_URL, NODE_ENV, allowed] of cases)
  test(name, () => {
    const child = spawnSync(process.execPath, ['scripts/entry-f1-guard.mjs'], {
      env: { ...process.env, DATABASE_URL, NODE_ENV },
      encoding: 'utf8',
    });
    assert.equal(child.status === 0, allowed);
  });
