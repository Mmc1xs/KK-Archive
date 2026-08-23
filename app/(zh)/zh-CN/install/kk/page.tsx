import type { Metadata } from "next";
import { InstallGuidePageView } from "@/components/install-guide-page-view";
import { getInstallGuideCopy } from "@/lib/install-guide-copy";
import { getLocaleHomeHref } from "@/lib/ui-locale";

export const revalidate = 300;
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: "KK 安装教学 | KK Archive",
  description: "Koikatsu Party 的干净来源、插件安装顺序、资源放置路径与基础排错清单。"
};

export default function KkInstallGuideZhCnPage() {
  return <InstallGuidePageView copy={getInstallGuideCopy("zh-CN", "kk")} homeHref={getLocaleHomeHref("zh-CN")} />;
}
