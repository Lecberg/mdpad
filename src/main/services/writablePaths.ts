/**
 * Keep only the document path a window is currently allowed to write to. A window edits one
 * document, so a path left over from Save As or a rename is a permission no longer needed.
 */
export function pruneWritablePaths(paths: Set<string>, keepKey: string | null): void {
  for (const key of paths) {
    if (key !== keepKey) paths.delete(key)
  }
}
