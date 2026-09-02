export function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not specified';
  return value
    .trim()
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

export function priorityLabel(value: string) {
  return value === 'URGENT'
    ? 'Urgent — act now'
    : value === 'HIGH'
      ? 'High priority'
      : value === 'NORMAL'
        ? 'Standard priority'
        : value === 'LOW'
          ? 'Low priority'
          : humanizeCode(value);
}
