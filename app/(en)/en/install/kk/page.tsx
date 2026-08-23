import type { Metadata } from "next";
import { InstallGuidePageView } from "@/components/install-guide-page-view";
import { getInstallGuideCopy } from "@/lib/install-guide-copy";
import { getLocaleHomeHref } from "@/lib/ui-locale";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "KK Install Guide | KK Archive",
  description: "Koikatsu Party clean source, plugin order, resource folders, and basic setup checks."
};

export default function KkInstallGuideEnPage() {
  return <InstallGuidePageView copy={getInstallGuideCopy("en", "kk")} homeHref={getLocaleHomeHref("en")} />;
}
