export function motionAllowed() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    && !document.documentElement.classList.contains("reduce-motion");
}
