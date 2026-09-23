export function assertEntryDatabase(environment = process.env) {
  if (environment.NODE_ENV === 'production' || !environment.DATABASE_URL)
    throw new Error('ENTRY-F1 requires an explicit disposable test database');
  const url = new URL(environment.DATABASE_URL);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    decodeURIComponent(url.pathname) !== '/credit_strategy_entry_f1_test' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname)
  )
    throw new Error('ENTRY-F1 refuses any database except local credit_strategy_entry_f1_test');
  return environment.DATABASE_URL;
}
assertEntryDatabase();
