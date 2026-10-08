import { toast } from 'sonner';

/** Copies text and confirms with a toast; a blocked clipboard shows an error instead. */
export async function copyText(text: string, success: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success);
    return true;
  } catch {
    toast.error('Couldn’t copy. Your browser blocked the clipboard.');
    return false;
  }
}
