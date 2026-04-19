import { redirect } from "next/navigation";

const RAW_TOOL_HREF = "/tool-static/PluginDataReader?v=20260413";

export default function PluginDataReaderToolPage() {
  redirect(RAW_TOOL_HREF);
}
