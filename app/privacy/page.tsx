export default function PrivacyPage() {
  return (
    <section className="page-section panel legal-page">
      <div className="eyebrow">Privacy & Disclaimer</div>
      <h1 className="title-lg">Community Use and Disclaimer</h1>

      <div className="grid">
        <section className="tag-section">
          <strong>Website Purpose</strong>
          <p className="muted">
            This website is primarily intended for content organization, structured browsing, community sharing, and
            reference purposes. Materials on this site are provided for browsing, discussion, indexing, and management
            use only. Nothing on this site should be interpreted as an official statement, endorsement, or guarantee
            of completeness, accuracy, or continued availability of any third-party material.
          </p>
        </section>

        <section className="tag-section">
          <strong>Member Login and Basic Account Data</strong>
          <p className="muted">
            This website uses Google sign-in for member authentication. When you sign in, the site may store
            necessary account information such as your email address, sign-in time, recent activity time, and basic
            security records. This data is used only for account identification, access control, risk management, and
            general site administration.
          </p>
        </section>

        <section className="tag-section">
          <strong>Community Nature and Third-Party Content</strong>
          <p className="muted">
            Some content on this site may be organized from public sources, external links, or community discussion.
            Related works, images, names, tags, and descriptions may still be under review or ongoing cleanup and
            should not be treated as final, complete, or officially authoritative information.
          </p>
        </section>

        <section className="tag-section">
          <strong>Disclaimer</strong>
          <p className="muted">
            Users are responsible for their own judgment when browsing, referencing, or visiting external links. This
            site does not guarantee and is not liable for third-party website content, external download links,
            unavailable sources, content changes, ownership disputes, or any direct or indirect loss arising from use
            of information provided on this site.
          </p>
        </section>

        <section className="tag-section">
          <strong>Site Administration and Security</strong>
          <p className="muted">
            To maintain site stability and prevent abuse, the site may record login activity, review unusual behavior,
            and apply restrictions, suspension, or other necessary management actions to suspicious accounts.
          </p>
        </section>

        <section className="tag-section">
          <strong>Policy Updates</strong>
          <p className="muted">
            This statement may be updated from time to time based on operational needs, service changes, or management
            rules. By continuing to use this website, you acknowledge and agree to the policy version currently
            published here.
          </p>
        </section>
      </div>
    </section>
  );
}
