import type { Metadata } from "next";
import { InstallGuidePageView } from "@/components/install-guide-page-view";
import { getInstallGuideCopy } from "@/lib/install-guide-copy";
import { getLocaleHomeHref } from "@/lib/ui-locale";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "KKS Install Guide | KK Archive",
  description: "Koikatsu Sunshine Original, KKS HF Patch, BR12 BetterRepack, resource folders, and basic setup checks."
};

export default function KksInstallGuideEnPage() {
  return <InstallGuidePageView copy={getInstallGuideCopy("en", "kks")} homeHref={getLocaleHomeHref("en")} />;
}
