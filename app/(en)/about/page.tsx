import { LegalPageView } from "@/components/support-page-view";

export default function AboutPage() {
  return (
    <LegalPageView
      eyebrow="About KK Archive"
      title="How this archive is built"
      sections={[
        {
          title: "Mission",
          body: "KK Archive is a structured browsing site for Koikatsu-related cards and shared files. Our goal is to make discovery cleaner, faster, and easier through stable category and tag organization."
        },
        {
          title: "What We Provide",
          body: "We focus on public browsing, filtering, and index management for published entries. The site is designed as a practical archive interface, not a public upload platform."
        },
        {
          title: "Content Structure",
          body: "Each entry is organized with fixed metadata fields and tag sets so users can browse by known database tags instead of free-text guessing. This keeps search results predictable and maintainable."
        },
        {
          title: "Quality and Review",
          body: "Metadata and links may be reviewed and refined over time. We continue to correct labels, improve consistency, and reduce incomplete records to keep the archive reliable."
        },
        {
          title: "Transparency",
          body: "For policy details and operational rules, please read Privacy, Contact, and Terms in the footer. We keep those pages updated when workflow or moderation rules change."
        }
      ]}
    />
  );
}
