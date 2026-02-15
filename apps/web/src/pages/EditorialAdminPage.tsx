import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { createEditorialPost, getEditorialPostsFromDb, getProfile, isCurrentUserAdmin } from "@/lib/api";
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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Not signed in");
      }

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

      return createEditorialPost(user.id, {
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
            heading: sectionHeading || "Overview",
            paragraphs,
            points: points.length > 0 ? points : undefined
          }
        ]
      });
    },
    onSuccess: async (post) => {
      pushToast(`Published "${post.title}"`, "success");
      setTitle("");
      setExcerpt("");
      setCoverImage("");
      setTags("");
      setSectionHeading("Overview");
      setContent("");
      setKeyPoints("");
      setSpotlight(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["editorial-posts-db"] }),
        queryClient.invalidateQueries({ queryKey: ["editorial-posts"] })
      ]);
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Unable to publish article", "error");
    }
  });

  const postCountLabel = useMemo(() => {
    if (!postsQuery.data) {
      return "0 posts";
    }
    return `${postsQuery.data.length} posts`;
  }, [postsQuery.data]);

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
        <h1 className="mt-1 font-display text-3xl font-bold text-ink md:text-4xl">Write and publish Editorial Spotlight posts</h1>
        <p className="mt-2 text-sm text-sand-700">
          This page is intentionally not linked in the main app navigation. Access it using your editorial subdomain route.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="surface-card p-5 md:p-6">
          <h2 className="font-display text-2xl font-bold text-ink">New post</h2>
          <p className="mt-1 text-sm text-sand-600">Fill the fields below and publish directly to the editorial feed.</p>

          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
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

            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-full bg-cobalt-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? "Publishing..." : "Publish article"}
            </button>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="surface-card p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt-700">Published feed</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">{postCountLabel}</h2>
            <p className="mt-1 text-sm text-sand-600">Most recent editorial posts from the database.</p>

            {postsQuery.isLoading ? <p className="mt-4 text-sm text-sand-600">Loading posts...</p> : null}
            {postsQuery.isError ? <p className="mt-4 text-sm text-rose-700">Failed to load posts.</p> : null}

            <div className="mt-4 space-y-3">
              {postsQuery.data?.slice(0, 8).map((post) => (
                <article key={post.slug} className="rounded-xl border border-sand-200 bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-500">{post.category}</p>
                  <p className="mt-1 font-display text-lg font-semibold leading-tight text-ink">{post.title}</p>
                  <p className="mt-1 text-xs text-sand-600">
                    {new Date(post.published_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "2-digit"
                    })}{" "}
                    - {post.read_time_minutes} min read
                  </p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
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
