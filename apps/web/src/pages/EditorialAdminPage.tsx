import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import {
  createEditorialPost,
  deleteEditorialPost,
  getEditorialPostsFromDb,
  getProfile,
  isCurrentUserAdmin,
  updateEditorialPost
} from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { EditorialPost } from "@/lib/editorial";

const CATEGORY_OPTIONS: EditorialPost["category"][] = ["Industry", "Creator Economy", "Design", "Music", "Film"];

export function EditorialAdminPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState<EditorialPost["category"]>("Industry");
  const [coverImage, setCoverImage] = useState("");
  const [readTimeMinutes, setReadTimeMinutes] = useState("5");
  const [tags, setTags] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("Editorial Writer");
  const [sectionHeading, setSectionHeading] = useState("Overview");
  const [content, setContent] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [spotlight, setSpotlight] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostSlug, setEditingPostSlug] = useState("");
  const [preservedSections, setPreservedSections] = useState<EditorialPost["sections"]>([]);

  const adminQuery = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => isCurrentUserAdmin(user!.id),
    enabled: Boolean(user?.id)
  });

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user?.id)
  });

  const postsQuery = useQuery({
    queryKey: ["editorial-posts-db"],
    queryFn: getEditorialPostsFromDb,
    enabled: adminQuery.data === true
  });

  useEffect(() => {
    if (authorName.trim()) {
      return;
    }
    if (profileQuery.data?.display_name) {
      setAuthorName(profileQuery.data.display_name);
    }
  }, [authorName, profileQuery.data?.display_name]);

  function resetForm() {
    setEditingPostId(null);
    setEditingPostSlug("");
    setPreservedSections([]);
    setTitle("");
    setExcerpt("");
    setCategory("Industry");
    setCoverImage("");
    setReadTimeMinutes("5");
    setTags("");
    setAuthorName(profileQuery.data?.display_name ?? "");
    setAuthorRole("Editorial Writer");
    setSectionHeading("Overview");
    setContent("");
    setKeyPoints("");
    setSpotlight(false);
  }

  function buildPostInput() {
    const minutes = Number(readTimeMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new Error("Read time must be a positive number");
    }

    const paragraphs = content
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) {
      throw new Error("Post content is required");
    }

    const points = keyPoints
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      title,
      excerpt,
      category,
      coverImage,
      readTimeMinutes: Math.round(minutes),
      spotlight,
      tags: tags.split(",").map((item) => item.trim()),
      authorName,
      authorRole,
      sections: [
        {
          heading: sectionHeading.trim() || "Overview",
          paragraphs,
          points: points.length > 0 ? points : undefined
        },
        ...preservedSections
      ]
    };
  }

  function handleStartEdit(post: EditorialPost) {
    if (!post.id) {
      pushToast("This post cannot be edited because it has no database ID.", "error");
      return;
    }

    const primarySection = post.sections[0];
    setEditingPostId(post.id);
    setEditingPostSlug(post.slug);
    setPreservedSections(post.sections.slice(1));
    setTitle(post.title);
    setExcerpt(post.excerpt);
    setCategory(post.category);
    setCoverImage(post.cover_image);
    setReadTimeMinutes(String(post.read_time_minutes));
    setTags(post.tags.join(", "));
    setAuthorName(post.author.name);
    setAuthorRole(post.author.role);
    setSectionHeading(primarySection?.heading ?? "Overview");
    setContent((primarySection?.paragraphs ?? []).join("\n\n"));
    setKeyPoints((primarySection?.points ?? []).join("\n"));
    setSpotlight(Boolean(post.spotlight));

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Not signed in");
      }
      return createEditorialPost(user.id, buildPostInput());
    },
    onSuccess: async (post) => {
      pushToast(`Published "${post.title}"`, "success");
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["editorial-posts-db"] }),
        queryClient.invalidateQueries({ queryKey: ["editorial-posts"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Unable to publish article", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingPostId) {
        throw new Error("No post selected for editing");
      }
      return updateEditorialPost(editingPostId, buildPostInput());
    },
    onSuccess: async (post) => {
      pushToast(`Updated "${post.title}"`, "success");
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["editorial-posts-db"] }),
        queryClient.invalidateQueries({ queryKey: ["editorial-posts"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Unable to update article", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (post: EditorialPost) => {
      if (!post.id) {
        throw new Error("This post cannot be deleted because it has no database ID.");
      }
      await deleteEditorialPost(post.id);
      return post;
    },
    onSuccess: async (post) => {
      pushToast(`Deleted "${post.title}"`, "success");
      if (editingPostId && post.id === editingPostId) {
        resetForm();
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["editorial-posts-db"] }),
        queryClient.invalidateQueries({ queryKey: ["editorial-posts"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Unable to delete article", "error");
    }
  });

  const posts = postsQuery.data ?? [];
  const postCountLabel = `${posts.length} post${posts.length === 1 ? "" : "s"}`;
  const spotlightCount = useMemo(() => posts.filter((post) => post.spotlight).length, [posts]);
  const latestUpdateLabel = useMemo(() => {
    let latest = 0;

    for (const post of posts) {
      const candidate = Date.parse(post.updated_at ?? post.published_at);
      if (!Number.isNaN(candidate) && candidate > latest) {
        latest = candidate;
      }
    }

    if (latest === 0) {
      return "N/A";
    }

    return formatDateTime(new Date(latest).toISOString());
  }, [posts]);

  const isEditing = Boolean(editingPostId);
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const activeDeletePostId = deleteMutation.variables?.id ?? null;

  if (adminQuery.isLoading) {
    return <div className="surface-card p-5 text-sm text-sand-600">Checking editorial admin permissions...</div>;
  }

  if (adminQuery.data !== true) {
    return <EmptyState title="Admin writers only" body="Your account is not currently assigned to editorial admin access." />;
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <header className="surface-card-vivid p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Editorial Admin</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink md:text-4xl">Write, track, and manage Editorial Spotlight posts</h1>
        <p className="mt-2 text-sm text-sand-700">
          This page is intentionally not linked in the main app navigation. Access it directly via <code>/editorial-admin</code>.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="surface-card p-5 md:p-6">
          <h2 className="font-display text-2xl font-bold text-ink">{isEditing ? "Edit post" : "New post"}</h2>
          <p className="mt-1 text-sm text-sand-600">
            {isEditing
              ? `Editing "${editingPostSlug}". Update content, then save changes.`
              : "Fill the fields below and publish directly to the editorial feed."}
          </p>

          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (isEditing) {
                updateMutation.mutate();
                return;
              }
              createMutation.mutate();
            }}
          >
            <Field label="Title">
              <input value={title} onChange={(event) => setTitle(event.target.value)} required className={inputClass} />
            </Field>

            <Field label="Excerpt">
              <textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} required rows={3} className={inputClass} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category">
                <select value={category} onChange={(event) => setCategory(event.target.value as EditorialPost["category"])} className={inputClass}>
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Read time (minutes)">
                <input
                  value={readTimeMinutes}
                  onChange={(event) => setReadTimeMinutes(event.target.value)}
                  type="number"
                  min={1}
                  required
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Cover image URL">
              <input value={coverImage} onChange={(event) => setCoverImage(event.target.value)} type="url" required className={inputClass} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Author name">
                <input value={authorName} onChange={(event) => setAuthorName(event.target.value)} required className={inputClass} />
              </Field>
              <Field label="Author role">
                <input value={authorRole} onChange={(event) => setAuthorRole(event.target.value)} required className={inputClass} />
              </Field>
            </div>

            <Field label="Tags (comma separated)">
              <input value={tags} onChange={(event) => setTags(event.target.value)} className={inputClass} placeholder="creator economy, design systems, trends" />
            </Field>

            <Field label="Section heading">
              <input value={sectionHeading} onChange={(event) => setSectionHeading(event.target.value)} required className={inputClass} />
            </Field>

            <Field label="Body (separate paragraphs with a blank line)">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                required
                rows={8}
                className={inputClass}
                placeholder="Write your article body here..."
              />
            </Field>

            <Field label="Key points (optional, one per line)">
              <textarea
                value={keyPoints}
                onChange={(event) => setKeyPoints(event.target.value)}
                rows={4}
                className={inputClass}
                placeholder={"Bullet point 1\nBullet point 2"}
              />
            </Field>

            <label className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700">
              <input type="checkbox" checked={spotlight} onChange={(event) => setSpotlight(event.target.checked)} />
              Mark as featured spotlight
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-cobalt-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (isEditing ? "Saving..." : "Publishing...") : isEditing ? "Save changes" : "Publish article"}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-sand-300 bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100"
                >
                  Cancel editing
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="surface-card p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt-700">Track posts</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">{postCountLabel}</h2>
            <p className="mt-1 text-sm text-sand-600">Monitor publishing activity and manage existing posts.</p>

            <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <StatChip label="Total posts" value={postCountLabel} />
              <StatChip label="Spotlight posts" value={String(spotlightCount)} />
              <StatChip label="Latest update" value={latestUpdateLabel} />
            </div>

            {postsQuery.isLoading ? <p className="mt-4 text-sm text-sand-600">Loading posts...</p> : null}
            {postsQuery.isError ? <p className="mt-4 text-sm text-rose-700">Failed to load posts.</p> : null}

            <div className="mt-4 space-y-3">
              {posts.map((post) => (
                <article
                  key={post.id ?? post.slug}
                  className={`rounded-xl border p-3 ${editingPostId && post.id === editingPostId ? "border-cobalt-300 bg-cobalt-50/60" : "border-sand-200 bg-white"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-500">{post.category}</p>
                    <div className="flex flex-wrap gap-1">
                      {post.spotlight ? <span className="rounded-full bg-cobalt-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-cobalt-700">Spotlight</span> : null}
                      <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-sand-700">
                        {post.read_time_minutes} min
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 font-display text-lg font-semibold leading-tight text-ink">{post.title}</p>
                  <p className="mt-1 text-xs text-sand-600">
                    Published {formatDate(post.published_at)} | Updated {formatDateTime(post.updated_at ?? post.published_at)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(post)}
                      className="rounded-full border border-sand-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(`Delete "${post.title}"? This action cannot be undone.`);
                        if (!confirmed) {
                          return;
                        }
                        deleteMutation.mutate(post);
                      }}
                      disabled={deleteMutation.isPending}
                      className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleteMutation.isPending && activeDeletePostId === post.id ? "Deleting..." : "Delete"}
                    </button>
                    <Link
                      to={`/editorial/${post.slug}`}
                      className="rounded-full border border-sand-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100"
                    >
                      View live
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </article>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-sand-800">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-sand-300 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100";
