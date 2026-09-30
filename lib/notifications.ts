export function showSuccess(message: string) {
  window.dispatchEvent(new CustomEvent("inkivo:success", { detail: message }));
}
