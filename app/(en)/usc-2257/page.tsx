import { LegalPageView } from "@/components/support-page-view";

export default function Usc2257Page() {
  return (
    <LegalPageView
      eyebrow="18 USC 2257 Compliance Statement"
      title="18 USC 2257 Record-Keeping Compliance"
      sections={[
        {
          title: "Secondary Distributor Notice",
          body: "KK Archive is an indexing and browsing platform and acts as a secondary distributor of third-party visual content where applicable."
        },
        {
          title: "No Production of Depicted Conduct",
          body: "KK Archive does not create, produce, or commission the visual content published by third-party creators. Any records required under 18 U.S.C. 2257 for such content are maintained by the original producers."
        },
        {
          title: "Age Requirement",
          body: "All persons depicted in visual depictions of actual sexually explicit conduct must be at least 18 years old at the time of production, as represented by the original producer."
        },
        {
          title: "Record Custodian Requests",
          body: "For compliance inquiries, DMCA notices, or rights-related requests, contact: mmc1xs@koikatsucards.com."
        }
      ]}
    />
  );
}

