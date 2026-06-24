/**
 * Escape special regex metacharacters so user input can be safely
 * used inside a MongoDB `$regex` query without ReDoS or injection risk.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
