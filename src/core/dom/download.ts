/**
 * Browser file helpers.
 *
 * The only place in the codebase that touches `document` for its own sake;
 * keeping it isolated means the rest of `core` stays environment-free.
 */

/** Trigger a client-side file download (used for CSV export of the table). */
export function downloadTextFile(filename: string, contents: string, mime = 'text/plain'): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
