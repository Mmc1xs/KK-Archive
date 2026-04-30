import { LegalPageView } from "@/components/support-page-view";

export default function DmcaPage() {
  return (
    <LegalPageView
      eyebrow="DMCA Takedown Policy"
      title="Copyright Notice and Takedown Process"
      sections={[
        {
          title: "How to Submit a DMCA Notice",
          body: "Send your notice to mmc1xs@koikatsucards.com with the subject line: DMCA Takedown Request."
        },
        {
          title: "Required Information",
          body: "Include your legal name, contact email, identification of the copyrighted work, exact URLs to remove, good-faith statement, and statement under penalty of perjury that you are authorized to act."
        },
        {
          title: "Review and Removal",
          body: "After receiving a complete notice, we review it and may remove or disable access to the reported content while verification is in progress."
        },
        {
          title: "Counter-Notice",
          body: "If content was removed by mistake, the affected party may submit a valid counter-notice. We may restore content as permitted by applicable law."
        },
        {
          title: "Repeat Infringers",
          body: "Accounts or contributors repeatedly reported for valid copyright infringement may face content restrictions or removal from the service."
        }
      ]}
    />
  );
}

