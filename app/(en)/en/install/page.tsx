import type { Metadata } from "next";
import { InstallGuidePageView } from "@/components/install-guide-page-view";
import { getInstallGuideCopy } from "@/lib/install-guide-copy";
import { getLocaleHomeHref } from "@/lib/ui-locale";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "Install Guide | KK Archive",
  description: "Clean KK and KKS sources, plugin order, resource folders, and basic setup checks."
};

export default function InstallGuideEnPage() {
  return <InstallGuidePageView copy={getInstallGuideCopy("en")} homeHref={getLocaleHomeHref("en")} />;
}
