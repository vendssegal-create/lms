/**
 * Stores unknown ZIP entries so they survive parse -> edit -> serialize round-trips.
 * Each entry is keyed by its ZIP path and stores the raw bytes.
 */
export function addPassthroughParts(
  zip: import('jszip'),
  unknownParts: Map<string, Uint8Array>
): void {
  for (const [path, bytes] of unknownParts) {
    zip.file(path, bytes);
  }
}
