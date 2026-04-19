import { LegalPageView } from "@/components/support-page-view";

export default function TermsPage() {
  return (
    <LegalPageView
      eyebrow="Terms of Service"
      title="Rules for using KK Archive"
      sections={[
        {
          title: "Acceptance",
          body: "By using this website, you agree to these terms and the currently published Privacy page. If you do not agree, please stop using the site."
        },
        {
          title: "Use Scope",
          body: "The site is provided for browsing, indexing, and reference of published entries. Automated abuse, scraping for malicious use, and behavior that harms service stability are prohibited."
        },
        {
          title: "Accounts and Access",
          body: "Some features may require member login. You are responsible for account access activity under your session and must not abuse protected routes."
        },
        {
          title: "Content and External Links",
          body: "Entries may include third-party references or download links. Availability, ownership status, and external-site behavior may change without notice."
        },
        {
          title: "Service Changes",
          body: "We may modify, suspend, or remove features to maintain reliability, security, and policy compliance. We may also update these terms when needed."
        },
        {
          title: "Liability Limitation",
          body: "The site is provided as-is. To the maximum extent permitted by law, we are not liable for direct or indirect loss caused by use of the site or third-party resources."
        }
      ]}
    />
  );
}
