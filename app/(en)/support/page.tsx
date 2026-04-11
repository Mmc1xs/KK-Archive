import { SupportPageView } from "@/components/support-page-view";

const PAYMENT_URL = "https://nowpayments.io/payment/?iid=5997887528";

export default function SupportPage() {
  return (
    <SupportPageView
      titleEyebrow="Support KK Archive"
      title="Keep the archive alive and growing"
      paragraphs={[
        "KK Archive is built to make card sharing cleaner, faster, and easier for everyone. We are now expanding from basic browsing into a long-term community platform with better curation, moderation tooling, and creator support workflows.",
        "Your support helps us cover storage, bandwidth, and development time, so we can keep improving search quality, add new library sections, and keep this project stable for daily use.",
        "If this archive saved your time or helped your workflow, you can support the next stage of development below."
      ]}
      supportLabel="Support via NOWPayments"
      backLabel="Back to Home"
      backHref="/"
      paymentUrl={PAYMENT_URL}
    />
  );
}
