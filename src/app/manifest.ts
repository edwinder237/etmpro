import { type MetadataRoute } from "next";

// Web app manifest, served at /manifest.webmanifest.
//
// Without this, adding EisenQ to a phone's home screen produces a launcher
// monogram ("E" on a plain tile) instead of the app icon: Android needs a
// manifest with icons of at least 192px before it will build a WebAPK, and
// falls back to a generated letter tile otherwise.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EisenQ — Decide & Do",
    short_name: "EisenQ",
    description: "The Prioritization Engine. Decide what truly matters.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // --bg from the light palette, so the splash matches the paper ground.
    background_color: "#f1ecdc",
    theme_color: "#f1ecdc",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed variant: launcher masks crop into solid colour rather than
      // the transparent corners of the rounded-square art.
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
