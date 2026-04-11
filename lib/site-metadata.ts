import type { Metadata } from "next";
import { getSiteOrigin } from "@/lib/site-origin";

const siteOrigin = getSiteOrigin();

export const siteMetadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "KK Archive | Koikatsu Cards, Presets, Scenes and Shared Files",
  description:
    "A searchable archive for Koikatsu-related files, including cards, presets, scenes, textures, overlays, and other shared resources organized with structured tags.",
  openGraph: {
    title: "KK Archive | Koikatsu Cards, Presets, Scenes and Shared Files",
    description:
      "A searchable archive for Koikatsu-related files, including cards, presets, scenes, textures, overlays, and other shared resources organized with structured tags.",
    url: siteOrigin,
    siteName: "KK Archive",
    type: "website"
  }
};
