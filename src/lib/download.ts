/** Saves text as a file through a temporary link (works on phones and desktops). */
export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked later, because some browsers start the download only after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
