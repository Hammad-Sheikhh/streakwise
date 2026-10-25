/**
 * Reads a field from a submitted form.
 *
 * Password managers (and some browsers' autofill) put values straight into the DOM without firing
 * an `input` event, so a controlled React field never sees them: its state stays empty, a
 * "disabled until filled" button stays disabled, and the click does nothing. Reading `FormData` at
 * submit time uses whatever the browser actually has, so autofilled details work on the first try.
 */
export function formValue(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === 'string' ? value : '';
}
