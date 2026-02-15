import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getEditorialPostsFromDb } from "@/lib/api";
import { getEditorialPosts as getFallbackEditorialPosts, type EditorialPost } from "@/lib/editorial";

export function EditorialPostPage() {
  const { slug = "" } = useParams();
  const fallbackPosts = useMemo(() => getFallbackEditorialPosts(), []);
  const postsQuery = useQuery({
    queryKey: ["editorial-posts"],
    queryFn: getEditorialPostsFromDb
  });
  const allPosts = useMemo(() => mergeEditorialPosts(fallbackPosts, postsQuery.data ?? []), [fallbackPosts, postsQuery.data]);
  const post = allPosts.find((item) => item.slug === slug);

  if (!post) {
    return (
      <div className="surface-card p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Editorial</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Story not found</h1>
        <p className="mt-2 text-sm text-sand-700">This article is not available. Browse all editorial stories instead.</p>
        <Link
          to="/editorial"
          className="mt-5 inline-flex rounded-full bg-cobalt-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-cobalt-700"
        >
          Back to editorial
        </Link>
      </div>
    );
  }

  const relatedPosts = allPosts
    .filter((item) => item.slug !== post.slug)
    .sort((a, b) => Number(b.category === post.category) - Number(a.category === post.category))
    .slice(0, 3);

  return (
    <div className="space-y-6 md:space-y-7">
      {postsQuery.isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Live editorial feed is unavailable right now. Showing fallback story content.
        </div>
      ) : null}

      <div>
        <Link
          to="/editorial"
          className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-sand-100"
        >
          <span aria-hidden="true">{"<"}</span>
          Back to editorial
        </Link>
      </div>

      <section className="surface-card overflow-hidden p-0">
        <div className="relative aspect-[18/8] min-h-[260px] overflow-hidden bg-sand-100">
          <img src={post.cover_image} alt={post.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/20 to-transparent" />
          <div className="absolute left-4 right-4 top-4 flex flex-wrap gap-2 md:left-6 md:right-6 md:top-6">
            <Badge value={post.category} tone="light" />
            <Badge value={`${post.read_time_minutes} min read`} tone="light" />
          </div>
          <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6">
            <Link to="/editorial" className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80 hover:text-white">
              Editorial Spotlight
            </Link>
            <h1 className="mt-2 max-w-4xl font-display text-2xl font-bold leading-tight text-white md:text-4xl">{post.title}</h1>
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/80">
              {formatEditorialDate(post.published_at)} - By {post.author.name} ({post.author.role})
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr,0.95fr]">
        <article className="surface-card p-5 md:p-6">
          <p className="text-base leading-relaxed text-sand-700">{post.excerpt}</p>

          <div className="mt-5 space-y-6">
            {post.sections.map((section) => (
              <section key={section.heading} className="space-y-3">
                <h2 className="font-display text-2xl font-bold text-ink">{section.heading}</h2>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.heading}-${index}`} className="text-sm leading-relaxed text-sand-700 md:text-base">
                    {paragraph}
                  </p>
                ))}
                {section.points?.length ? (
                  <ul className="space-y-1 pl-4 text-sm text-sand-700 md:text-base">
                    {section.points.map((point) => (
                      <li key={point} className="list-disc">
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-sand-200 pt-4">
            {post.tags.map((tag) => (
              <Badge key={tag} value={`#${tag}`} />
            ))}
          </div>
        </article>

        <aside className="space-y-4">
          <div className="surface-card-vivid p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Editorial context</p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink">Why this story matters</h2>
            <p className="mt-2 text-sm text-sand-700">
              Editorial Spotlight tracks practical shifts in the creative economy so creators can act early with better strategy.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/editorial"
                className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100"
              >
                All stories
              </Link>
              <Link
                to="/creators"
                className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100"
              >
                Browse creators
              </Link>
            </div>
          </div>

          <div className="surface-card p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Related stories</p>
            <div className="mt-3 space-y-3">
              {relatedPosts.map((item) => (
                <article key={item.slug} className="rounded-xl border border-sand-200 bg-white p-3 landing-hover-lift">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-500">{item.category}</p>
                  <Link to={`/editorial/${item.slug}`} className="mt-1 block font-display text-lg font-semibold leading-tight text-ink hover:text-cobalt-700">
                    {item.title}
                  </Link>
                  <p className="mt-2 text-xs text-sand-600">{formatEditorialDate(item.published_at)}</p>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Badge({ value, tone = "default" }: { value: string; tone?: "default" | "light" }) {
  const className =
    tone === "light"
      ? "rounded-full border border-white/40 bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white"
      : "rounded-full border border-sand-200 bg-sand-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-sand-700";

  return <span className={className}>{value}</span>;
}

function formatEditorialDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit"
  });
}

function mergeEditorialPosts(fallbackPosts: EditorialPost[], dbPosts: EditorialPost[]) {
  const bySlug = new Map<string, EditorialPost>();

  for (const post of fallbackPosts) {
    bySlug.set(post.slug, post);
  }

  for (const post of dbPosts) {
    bySlug.set(post.slug, post);
  }

  return Array.from(bySlug.values()).sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
}
