import { createTagAction } from "@/app/actions";

export function TagForm({ error }: { error?: string }) {
  return (
    <section className="panel">
      <div className="eyebrow">Admin Tag Manager</div>
      <h2 className="title-lg">Create Tag</h2>
      {error ? <div className="notice">{error}</div> : null}
      <form action={createTagAction} className="grid">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" required />
        </div>
        <div className="field">
          <label htmlFor="slug">Slug</label>
          <input id="slug" name="slug" required />
        </div>
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue="AUTHOR">
            <option value="AUTHOR">Author</option>
            <option value="STYLE">Style</option>
            <option value="USAGE">Usage</option>
          </select>
        </div>
        <button type="submit">Create Tag</button>
      </form>
    </section>
  );
}
