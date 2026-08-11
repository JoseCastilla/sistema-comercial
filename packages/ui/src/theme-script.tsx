const themeBootstrap = `(() => {
  const key = "sistema-comercial-theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = "system";
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === "light" || stored === "dark" || stored === "system") {
      preference = stored;
    }
  } catch {}
  const theme = preference === "system" ? (media.matches ? "dark" : "light") : preference;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", theme === "dark" ? "#0f1411" : "#eef1ed");
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />;
}
