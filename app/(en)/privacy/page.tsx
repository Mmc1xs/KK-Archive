import { LegalPageView } from "@/components/support-page-view";

export default function PrivacyPage() {
  return (
    <LegalPageView
      eyebrow="Privacy & Disclaimer"
      title="Community Use and Disclaimer"
      sections={[
        {
          title: "Website Purpose",
          body: "This website is primarily intended for content organization, structured browsing, community sharing, and reference purposes. Materials on this site are provided for browsing, discussion, indexing, and management use only. Nothing on this site should be interpreted as an official statement, endorsement, or guarantee of completeness, accuracy, or continued availability of any third-party material."
        },
        {
          title: "Member Login and Basic Account Data",
          body: "This website uses Google sign-in for member authentication. When you sign in, the site may store necessary account information such as your email address, sign-in time, recent activity time, and basic security records. This data is used only for account identification, access control, risk management, and general site administration."
        },
        {
          title: "Community Nature and Third-Party Content",
          body: "Some content on this site may be organized from public sources, external links, or community discussion. Related works, images, names, tags, and descriptions may still be under review or ongoing cleanup and should not be treated as final, complete, or officially authoritative information."
        },
        {
          title: "Disclaimer",
          body: "Users are responsible for their own judgment when browsing, referencing, or visiting external links. This site does not guarantee and is not liable for third-party website content, external download links, unavailable sources, content changes, ownership disputes, or any direct or indirect loss arising from use of information provided on this site."
        },
        {
          title: "Site Administration and Security",
          body: "To maintain site stability and prevent abuse, the site may record login activity, review unusual behavior, and apply restrictions, suspension, or other necessary management actions to suspicious accounts."
        },
        {
          title: "Policy Updates",
          body: "This statement may be updated from time to time based on operational needs, service changes, or management rules. By continuing to use this website, you acknowledge and agree to the policy version currently published here."
        }
      ]}
    />
  );
}
