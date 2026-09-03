import { type MetadataRoute } from "next";

// Web app manifest, served at /manifest.webmanifest.
//
// Deliberately declares no icons. iOS 16.4+ prefers manifest icons over
// apple-touch-icon, and on iPhone it rejected every set offered here --
// transparent, opaque, freshly-named -- falling through to a generated letter
// tile each time. Safari's share sheet rendered /apple-touch-icon.png
// perfectly throughout, which is the source iOS uses when a manifest declares
// no icons, so omitting the key is what actually puts the app icon on the
// home screen.
//
// The trade-off is Android: without icons of at least 192px, Chrome will not
// build a WebAPK and falls back to its own monogram. The artwork is still in
// public/ (icon-192-v2.png, icon-512-v2.png, icon-512-maskable-v2.png), so
// restoring an `icons` array is the only step needed if Android matters later
// and iOS has since been fixed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // ASCII only. The route is served as application/manifest+json with no
    // charset, so a non-ASCII byte sequence here decodes as Windows-1252 in
    // Safari ("EisenQ a€" Decide & Do").
    name: "EisenQ - Decide & Do",
    short_name: "EisenQ",
    description: "The Prioritization Engine. Decide what truly matters.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // --bg from the light palette, so the splash matches the paper ground.
    background_color: "#f1ecdc",
    theme_color: "#f1ecdc",
  };
}
