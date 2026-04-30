import Link from "next/link";
import { UserRole } from "@prisma/client";
import { createContentAction, transitionContentReviewStatusAction, updateContentAction } from "@/app/actions";
import { DownloadLinksEditor } from "@/components/admin/download-links-editor";
import { ContentImageUrlsEditor } from "@/components/admin/content-image-urls-editor";
import { DescriptionFieldToggle } from "@/components/description-field-toggle";
import { HostedFileUploader } from "@/components/admin/hosted-file-uploader";
import { TagAutocomplete } from "@/components/tag-autocomplete";
import { WorkCharacterFields } from "@/components/work-character-fields";
import { buildContentHref } from "@/lib/content-href";
import { buildContentFileDownloadPath, buildLegacyContentFileDownloadPath } from "@/lib/downloads/content-file-token";
import { buildR2PublicUrl } from "@/lib/storage/r2";
import { resolveContentStorageFolderValue } from "@/lib/uploads";

type TagOption = {
  id: number;
  name: string;
  slug: string;
};

type ContentFormProps = {
  mode: "create" | "edit";
  role?: UserRole;
  error?: string;
  success?: string;
  tagOptions: {
    types: TagOption[];
  };
  content?: {
    id: number;
    title: string;
    slug: string;
    description: string;
    coverImageUrl: string;
    storageFolder?: string | null;
    sourceLink: string | null;
    reviewStatus: "UNVERIFIED" | "EDITED" | "PASSED";
    publishStatus: "DRAFT" | "SUMMIT" | "PUBLISHED" | "COMPLIANCE_REJECTED" | "INVISIBLE";
    images: Array<{ id: number; imageUrl: string; sortOrder?: number }>;
    downloadLinks: Array<{ url: string }>;
    hostedFiles: Array<{
      id: number;
      fileName: string;
      objectKey: string;
      mimeType: string;
      byteSize: number;
      createdAt: Date;
      uploadedBy: {
        id: number;
        username: string | null;
        email: string;
        role: UserRole;
      };
    }>;
    contentTags: Array<{ tag: { id: number; name: string; slug: string; type: string } }>;
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

function isTelegramUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "t.me" || parsed.hostname === "telegram.me" || parsed.hostname.endsWith(".t.me");
  } catch {
    return false;
  }
}

export function ContentForm({ mode, role = "ADMIN", error, success, tagOptions, content }: ContentFormProps) {
  const action =
    mode === "create"
      ? createContentAction
      : updateContentAction.bind(null, content!.id);
  const reviewStatusMeta = content ? getReviewStatusMeta(content.reviewStatus) : null;
  const canViewOriginalPost =
    content?.publishStatus === "PUBLISHED" || content?.publishStatus === "SUMMIT";

  const typeIds = new Set(content?.contentTags.filter((item) => item.tag.type === "TYPE").map((item) => item.tag.id) ?? []);
  const hostedLegacyIdDownloadLinks = new Set(content?.hostedFiles.map((item) => buildLegacyContentFileDownloadPath(item.id)) ?? []);
  const hostedLegacyDownloadLinks = new Set(
    content?.hostedFiles.map((item) => buildR2PublicUrl(item.objectKey)) ?? []
  );
  const hostedDownloadLinks = content?.hostedFiles.map((item) => buildContentFileDownloadPath(item.id)) ?? [];
  const hostedDownloadLinkSet = new Set(hostedDownloadLinks);
  const manualDownloadLinks =
    content?.downloadLinks
      .map((item) => item.url)
      .filter(
        (url) => !hostedLegacyDownloadLinks.has(url) && !hostedLegacyIdDownloadLinks.has(url) && !hostedDownloadLinkSet.has(url)
      ) ?? [];
  const telegramDownloadLink = manualDownloadLinks.find(isTelegramUrl) ?? manualDownloadLinks[0] ?? "";
  const imageUrls = content?.images.length ? content.images.map((image) => image.imageUrl) : ["", "", ""];
  const storageFolder = content ? resolveContentStorageFolderValue(content) : "";

  return (
    <section className="panel">
      <div className="eyebrow">Admin Content Editor</div>
      <div className="split">
        <h1 className="title-lg">{mode === "create" ? "Create Content" : "Edit Content"}</h1>
        {mode === "edit" && content && canViewOriginalPost ? (
          <Link href={buildContentHref(content.slug)} className="link-pill">
            Back to Post
          </Link>
        ) : null}
      </div>
      {success ? <div className="notice success">{success}</div> : null}
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
        <DescriptionFieldToggle initialValue={content?.description ?? ""} />
        <div className="field">
          <label htmlFor="coverImageUrl">Cover Image URL</label>
          <input id="coverImageUrl" name="coverImageUrl" defaultValue={content?.coverImageUrl ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor="sourceLink">Original Source Link</label>
          <input
            id="sourceLink"
            name="sourceLink"
            type="url"
            defaultValue={content?.sourceLink ?? ""}
            placeholder="https://www.pixiv.net/artworks/..."
          />
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
              <small>Save Content preserves the current review status. Update Content will move this content into Edited automatically.</small>
            ) : (
              <small>Save Content preserves the current review status. Update Content moves this post to Edited. Use the admin pass button to approve it directly.</small>
            )}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="publishStatus">Publish Status</label>
          <select id="publishStatus" name="publishStatus" defaultValue={content?.publishStatus ?? "DRAFT"}>
            <option value="DRAFT">Draft</option>
            <option value="SUMMIT">Summit</option>
            <option value="PUBLISHED">Published</option>
            <option value="COMPLIANCE_REJECTED">Compliance Rejected</option>
            <option value="INVISIBLE">Invisible (Hidden)</option>
          </select>
        </div>
        <TagAutocomplete
          label="Author"
          idName="authorTagIds"
          newName="authorTagNames"
          tagType="AUTHOR"
          initialSelectedTags={content?.contentTags.filter((item) => item.tag.type === "AUTHOR").map((item) => item.tag) ?? []}
          multiple={false}
          required
          placeholder="Search or create authors"
        />
        <WorkCharacterFields
          initialWorkTags={content?.contentTags.filter((item) => item.tag.type === "WORK").map((item) => item.tag) ?? []}
          initialCharacterTags={content?.contentTags.filter((item) => item.tag.type === "CHARACTER").map((item) => item.tag) ?? []}
        />
        <TagAutocomplete
          label="Style"
          idName="styleTagIds"
          newName="styleTagNames"
          tagType="STYLE"
          initialSelectedTags={content?.contentTags.filter((item) => item.tag.type === "STYLE").map((item) => item.tag) ?? []}
          placeholder="Search or create styles"
        />
        <TagAutocomplete
          label="Usage"
          idName="usageTagIds"
          newName="usageTagNames"
          tagType="USAGE"
          initialSelectedTags={content?.contentTags.filter((item) => item.tag.type === "USAGE").map((item) => item.tag) ?? []}
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
        <ContentImageUrlsEditor
          contentId={content?.id}
          role={role}
          storageFolder={storageFolder}
          coverImageUrl={content?.coverImageUrl}
          initialImages={content?.images}
          initialImageUrls={imageUrls}
        />
        <DownloadLinksEditor
          initialTelegramLink={telegramDownloadLink}
          initialHostedLinks={hostedDownloadLinks}
        />
        {mode === "edit" && content ? (
          <div className="field hosted-files-panel">
            <div className="split hosted-files-header">
              <div>
                <span>Hosted Files</span>
                <small>
                  Staff-managed shared files will live under <code>{`uploadfiles/${storageFolder}/`}</code> in R2.
                </small>
              </div>
            </div>
            <HostedFileUploader
              contentId={content.id}
              role={role}
              storageFolder={storageFolder}
              initialFiles={content.hostedFiles}
            />
          </div>
        ) : null}
        {mode === "create" ? (
          <button type="submit">Create Content</button>
        ) : (
          <div className="content-form-actions">
            <div className="inline-actions">
              <button type="submit" name="reviewAction" value="saved" className="button secondary">
                Save Content
              </button>
              <button type="submit" name="reviewAction" value="edited">
                Update Content
              </button>
              {role === "ADMIN" && content?.reviewStatus !== "PASSED" ? (
                <button type="submit" name="reviewAction" value="passed" className="button secondary">
                  Update and Pass
                </button>
              ) : role === "ADMIN" ? (
                <button type="button" className="button secondary" disabled title="This content is already passed. Use Save Content to keep the current review status.">
                  Already Passed
                </button>
              ) : null}
            </div>
            {role === "ADMIN" && content && content.reviewStatus !== "UNVERIFIED" ? (
              <>
                <input type="hidden" name="contentId" value={content.id} />
                <input type="hidden" name="nextStatus" value="UNVERIFIED" />
                <input type="hidden" name="redirectTo" value={`/admin/contents/${content.id}/edit`} />
                <button
                  type="submit"
                  formAction={transitionContentReviewStatusAction}
                  formNoValidate
                  className="link-pill"
                >
                  Reset to Unverified
                </button>
              </>
            ) : null}
          </div>
        )}
      </form>
    </section>
  );
}
