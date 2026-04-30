import { LegalPageView } from "@/components/support-page-view";

export default function ContactPage() {
  return (
    <LegalPageView
      eyebrow="Contact"
      title="Reach the KK Archive team"
      sections={[
        {
          title: "Business Inquiries",
          body: "For business or partnership inquiries, contact: mmc1xs@koikatsucards.com"
        },
        {
          title: "Copyright and Takedown",
          body: "If you need removal of specific content, include affected page URLs, proof of rights, and the exact request details so we can process it correctly. You can also follow the dedicated DMCA Policy page in the footer."
        },
        {
          title: "Account and Security Reports",
          body: "For account-access issues, suspicious activity, or abuse reports, send a clear description, relevant timestamps, and screenshots if available."
        },
        {
          title: "Response Window",
          body: "We usually reply within 3 to 7 business days. Complex copyright or ownership disputes may require additional verification time."
        }
      ]}
    />
  );
}
