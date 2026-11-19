// Puts `dark` on <html> before the page renders, so a dark page doesn't flash
// white while the app loads. A file, not an inline script: the CSP allows
// scripts from this site only. Reads what src/preferences.ts stores; once
// the app runs, src/theme.ts takes over.
// In a block: a classic script's top-level `let` would be a page global.
{
  let theme = "system";
  try {
    theme = JSON.parse(localStorage.getItem("preferences") ?? "{}").state.theme;
  } catch {
    // Nothing stored, no storage (private mode) or a broken value.
  }
  if (
    theme === "dark" ||
    (theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
}
