import type { Metadata } from "next";
import { InstallGuidePageView } from "@/components/install-guide-page-view";
import { getInstallGuideCopy } from "@/lib/install-guide-copy";
import { getLocaleHomeHref } from "@/lib/ui-locale";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "導入ガイド | KK Archive",
  description: "KK と KKS のクリーンソース、プラグイン導入順、配置フォルダ、基本チェック項目。"
};

export default function InstallGuideJaPage() {
  return <InstallGuidePageView copy={getInstallGuideCopy("ja")} homeHref={getLocaleHomeHref("ja")} />;
}
