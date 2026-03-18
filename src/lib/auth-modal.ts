/** Abre o modal de login/cadastro (AuthControls escuta este evento). */
export function openAuthModal(mode: "login" | "register" = "login") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("auth:open", { detail: { mode } }));
}
