import { UserRole } from "@prisma/client";
import { createContentAction, updateContentAction } from "@/app/actions";
import { MultiUrlInput } from "@/components/multi-url-input";
import { TagAutocomplete } from "@/components/tag-autocomplete";

type TagOption = {
  id: number;
  name: string;
  slug: string;
};

type ContentFormProps = {
  mode: "create" | "edit";
  role?: UserRole;
  error?: string;
  tagOptions: {
    authors: TagOption[];
    styles: TagOption[];
    usages: TagOption[];
    types: TagOption[];
  };
  content?: {
    id: number;
    title: string;
    slug: string;
    description: string;
    coverImageUrl: string;
    reviewStatus: "UNVERIFIED" | "EDITED" | "PASSED";
    publishStatus: "DRAFT" | "SUMMIT" | "PUBLISHED";
    images: Array<{ imageUrl: string }>;
    downloadLinks: Array<{ url: string }>;
    contentTags: Array<{ tag: { id: number; type: string } }>;
  };
};

function getReviewStatusMeta(reviewStatus: "UNVERIFIED" | "EDITED" | "PASSED") {
  switch (reviewStatus) {
    case "EDITED":
      return {
        label: "Edited",
        detail: "Reviewed by audit staff and waiting for final admin approval.",
        className: "status status-edited"
      };
    case "PASSED":
      return {
        label: "Passed",
        detail: "Approved by admin as the final reviewed version.",
        className: "status status-passed"
      };
    default:
      return {
        label: "Unverified",
        detail: "This content still needs audit review before final approval.",
        className: "status status-unverified"
      };
  }
}

export function ContentForm({ mode, role = "ADMIN", error, tagOptions, content }: ContentFormProps) {
  const action =
    mode === "create"
      ? createContentAction
      : updateContentAction.bind(null, content!.id);
  const reviewStatusMeta = content ? getReviewStatusMeta(content.reviewStatus) : null;

  const authorIds = new Set(content?.contentTags.filter((item) => item.tag.type === "AUTHOR").map((item) => item.tag.id) ?? []);
  const styleIds = new Set(content?.contentTags.filter((item) => item.tag.type === "STYLE").map((item) => item.tag.id) ?? []);
  const usageIds = new Set(content?.contentTags.filter((item) => item.tag.type === "USAGE").map((item) => item.tag.id) ?? []);
  const typeIds = new Set(content?.contentTags.filter((item) => item.tag.type === "TYPE").map((item) => item.tag.id) ?? []);
  const downloadLinks = content?.downloadLinks.map((item) => item.url) ?? [];
  const imageUrls = content?.images.length ? content.images.map((image) => image.imageUrl) : ["", "", ""];
  while (imageUrls.length < 3) {
    imageUrls.push("");
  }

  return (
    <section className="panel">
      <div className="eyebrow">Admin Content Editor</div>
      <h1 className="title-lg">{mode === "create" ? "Create Content" : "Edit Content"}</h1>
      {error ? <div className="notice">{error}</div> : null}
      <form action={action} className="grid">
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" defaultValue={content?.title ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor="slug">Slug</label>
          <input id="slug" name="slug" defaultValue={content?.slug ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" defaultValue={content?.description ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor="coverImageUrl">Cover Image URL</label>
          <input id="coverImageUrl" name="coverImageUrl" defaultValue={content?.coverImageUrl ?? ""} required />
        </div>
        {content ? (
          <div className="review-status-panel">
            <div className="split">
              <div>
                <strong>Review Status</strong>
                <small>{reviewStatusMeta?.detail}</small>
              </div>
              <div className={reviewStatusMeta?.className}>{reviewStatusMeta?.label}</div>
            </div>
            {role === "AUDIT" ? (
              <small>Saving audit edits will move this content into the Edited state automatically.</small>
            ) : (
              <small>Update Content moves this post to Edited. Use the admin pass button to approve it directly.</small>
            )}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="publishStatus">Publish Status</label>
          <select id="publishStatus" name="publishStatus" defaultValue={content?.publishStatus ?? "DRAFT"}>
            <option value="DRAFT">Draft</option>
            <option value="SUMMIT">Summit</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
        <TagAutocomplete
          label="Author"
          idName="authorTagIds"
          newName="authorTagNames"
          options={tagOptions.authors}
          initialSelectedIds={[...authorIds]}
          required
          placeholder="Search or create authors"
        />
        <TagAutocomplete
          label="Style"
          idName="styleTagIds"
          newName="styleTagNames"
          options={tagOptions.styles}
          initialSelectedIds={[...styleIds]}
          placeholder="Search or create styles"
        />
        <TagAutocomplete
          label="Usage"
          idName="usageTagIds"
          newName="usageTagNames"
          options={tagOptions.usages}
          initialSelectedIds={[...usageIds]}
          placeholder="Search or create usages"
        />
        <div className="field">
          <span>Type</span>
          <div className="type-option-grid">
            {tagOptions.types.map((tag) => (
              <label key={tag.id} className="type-option-card">
                <input
                  type="radio"
                  name="typeTagIds"
                  value={tag.id}
                  defaultChecked={typeIds.has(tag.id)}
                  required={typeIds.size === 0}
                />
                <span className="type-option-text">
                  <span className="type-option-title">{tag.name}</span>
                  <span className="type-option-help">Choose exactly one type</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Image URLs</span>
          <div className="grid">
            {imageUrls.map((imageUrl, index) => (
              <input
                key={`${imageUrl}-${index}`}
                name="imageUrls"
                defaultValue={imageUrl}
                placeholder={`Image URL ${index + 1}`}
                required={index === 0}
              />
            ))}
          </div>
        </div>
        <MultiUrlInput
          label="Download Links"
          name="downloadLinks"
          placeholder="Paste a download link and press Enter"
          initialUrls={downloadLinks}
        />
        {mode === "create" ? (
          <button type="submit">Create Content</button>
        ) : (
          <div className="inline-actions">
            <button type="submit" name="reviewAction" value="edited">
              Update Content
            </button>
            {role === "ADMIN" ? (
              <button type="submit" name="reviewAction" value="passed" className="button secondary">
                Update and Pass
              </button>
            ) : null}
          </div>
        )}
      </form>
    </section>
  );
}
