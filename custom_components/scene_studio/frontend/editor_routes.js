/** Public panel paths, with legacy hashes accepted at the boundary. */
const ROOT = "/scene_studio";
const LIBRARY = { variable: "color-presets", palette: "scene-presets", theme: "circadian-presets" };

export function editorPath(route) {
  if (!route) return `${ROOT}/scenes`;
  if (route === "variables") return `${ROOT}/library`;
  if (route === "new") return `${ROOT}/scenes/new`;
  const [kind, ...parts] = route.split("/");
  const id = encodeURIComponent(parts.join("/"));
  if (kind === "edit" && id) return `${ROOT}/scenes/${id}`;
  if (LIBRARY[kind] && id) return `${ROOT}/library/${LIBRARY[kind]}/${id}`;
  throw new Error(`Unknown editor route: ${route}`);
}

export function editorRoute({ pathname, hash = "" }) {
  if (pathname !== ROOT && !pathname.startsWith(`${ROOT}/`)) return null;
  const legacy = hash.replace(/^#/, "");
  if (legacy && /^(?:(edit|variable|palette|theme)\/.+|variables|new)$/.test(legacy)) return legacy;
  const path = pathname.replace(/\/+$/, "");
  if (path === ROOT || path === `${ROOT}/scenes`) return "";
  if (path === `${ROOT}/library`) return "variables";
  const scene = path.match(/^\/scene_studio\/scenes\/([^/]+)$/);
  if (scene) return scene[1] === "new" ? "new" : `edit/${decodeURIComponent(scene[1])}`;
  for (const [kind, segment] of Object.entries(LIBRARY)) {
    const prefix = `${ROOT}/library/${segment}/`;
    if (path.startsWith(prefix) && !path.slice(prefix.length).includes("/")) return `${kind}/${decodeURIComponent(path.slice(prefix.length))}`;
  }
  throw new Error(`Unknown Scene Studio path: ${path}`);
}

export function libraryItemRoute(kind, currentKind, currentId, id) {
  return kind === currentKind && currentId === id ? "variables" : `${kind}/${id}`;
}
