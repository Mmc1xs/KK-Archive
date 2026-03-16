type AuthFormProps = {
  title: string;
  description: string;
  submitLabel: string;
  action: (formData: FormData) => Promise<void>;
  error?: string;
};

export function AuthForm({ title, description, submitLabel, action, error }: AuthFormProps) {
  return (
    <section className="page-section panel" style={{ maxWidth: 520, marginInline: "auto" }}>
      <div className="eyebrow">Member Access</div>
      <h1 className="title-lg">{title}</h1>
      <p className="muted">{description}</p>
      {error ? <div className="notice">{error}</div> : null}
      <form action={action} className="grid">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={8} />
        </div>
        <button type="submit">{submitLabel}</button>
      </form>
    </section>
  );
}
