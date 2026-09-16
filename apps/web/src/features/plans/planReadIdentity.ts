// Only read-scheduling metadata is excluded; every business field remains significant.
export function planReadIdentity<
  T extends { workspace?: { generatedAt?: string; refreshAt?: string | null } },
>(data: T | undefined) {
  if (!data) return '';
  if (!data.workspace) return JSON.stringify(data);
  const workspace = { ...data.workspace };
  delete workspace.generatedAt;
  delete workspace.refreshAt;
  return JSON.stringify({ ...data, workspace });
}
