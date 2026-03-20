import Link from "next/link";

const PAYMENT_URL = "https://nowpayments.io/payment/?iid=5997887528";

export default function SupportPage() {
  return (
    <section className="page-section support-page">
      <div className="panel support-panel">
        <p className="eyebrow">Support KK Archive</p>
        <h1 className="title-lg">Keep the archive alive and growing</h1>
        <p className="muted">
          KK Archive is built to make card sharing cleaner, faster, and easier for everyone. We are now expanding from basic
          browsing into a long-term community platform with better curation, moderation tooling, and creator support workflows.
        </p>
        <p className="muted">
          Your support helps us cover storage, bandwidth, and development time, so we can keep improving search quality, add
          new library sections, and keep this project stable for daily use.
        </p>
        <p className="muted">
          If this archive saved your time or helped your workflow, you can support the next stage of development below.
        </p>
        <div className="inline-actions">
          <a className="button" href={PAYMENT_URL} target="_blank" rel="noreferrer noopener">
            Support via NOWPayments
          </a>
          <Link className="link-pill" href="/">
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}

