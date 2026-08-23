import type { Metadata } from "next";
import { InstallGuidePageView } from "@/components/install-guide-page-view";
import { getInstallGuideCopy } from "@/lib/install-guide-copy";
import { getLocaleHomeHref } from "@/lib/ui-locale";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "KKS 安装教学 | KK Archive",
  description: "Koikatsu Sunshine Original、KKS HF Patch、BR12 BetterRepack、资源放置路径与基础排错清单。"
};

export default function KksInstallGuideZhCnPage() {
  return <InstallGuidePageView copy={getInstallGuideCopy("zh-CN", "kks")} homeHref={getLocaleHomeHref("zh-CN")} />;
}
