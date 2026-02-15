import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getEditorialPostsFromDb } from "@/lib/api";
import { getEditorialPosts as getFallbackEditorialPosts, type EditorialPost } from "@/lib/editorial";

type CategoryFilter = "All" | EditorialPost["category"];

export function EditorialPage() {
  const fallbackPosts = useMemo(() => getFallbackEditorialPosts(), []);
  const postsQuery = useQuery({
    queryKey: ["editorial-posts"],
    queryFn: getEditorialPostsFromDb
  });

  const posts = useMemo(() => mergeEditorialPosts(fallbackPosts, postsQuery.data ?? []), [fallbackPosts, postsQuery.data]);
  const categories = useMemo(() => Array.from(new Set(posts.map((post) => post.category))), [posts]);
  const [category, setCategory] = useState<CategoryFilter>("All");

  const featuredPost = useMemo(() => {
    const scoped = category === "All" ? posts : posts.filter((post) => post.category === category);
    if (scoped.length === 0) {
      return undefined;
    }
    return scoped.find((post) => post.spotlight) ?? scoped[0];
  }, [category, posts]);

  const listPosts = useMemo(() => {
    const scoped = category === "All" ? posts : posts.filter((post) => post.category === category);
    return scoped.filter((post) => post.slug !== featuredPost?.slug);
  }, [category, featuredPost?.slug, posts]);

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="surface-card-vivid relative overflow-hidden p-5 md:p-7">
        <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-cobalt-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-20 h-44 w-44 rounded-full bg-lagoon-100/70 blur-3xl" />
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cobalt-600">Editorial Spotlight</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-5xl">The Crib blog for creative industry signals</h1>
          <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
            We publish trend breakdowns, creator economy analysis, and practical insights across design, music, and film.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <FilterPill active={category === "All"} label="All" onClick={() => setCategory("All")} />
            {categories.map((item) => (
              <FilterPill key={item} active={category === item} label={item} onClick={() => setCategory(item)} />
            ))}
          </div>
        </div>
      </header>

      {postsQuery.isError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Live editorial feed is unavailable right now. Showing fallback stories.
        </div>
      ) : null}

      {featuredPost ? (
        <section className="surface-card overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[1fr,1fr]">
            <div className="relative h-56 overflow-hidden bg-sand-100 md:h-64 lg:h-[300px] xl:h-[320px]">
              <img src={featuredPost.cover_image} alt={featuredPost.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/15 to-transparent" />
            </div>

            <div className="p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Featured story</p>
              <Link to={`/editorial/${featuredPost.slug}`} className="mt-2 block font-display text-2xl font-bold leading-tight text-ink hover:text-cobalt-700 md:text-3xl">
                {featuredPost.title}
              </Link>
              <p className="mt-3 text-sm text-sand-700">{featuredPost.excerpt}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <MetaBadge value={featuredPost.category} />
                <MetaBadge value={formatEditorialDate(featuredPost.published_at)} />
                <MetaBadge value={`${featuredPost.read_time_minutes} min read`} />
              </div>

              <p className="mt-4 text-sm text-sand-600">
                By <span className="font-semibold text-ink">{featuredPost.author.name}</span> ({featuredPost.author.role})
              </p>

              <Link
                to={`/editorial/${featuredPost.slug}`}
                className="mt-5 inline-flex rounded-full bg-cobalt-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-cobalt-700"
              >
                Read article
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Latest posts</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink md:text-3xl">{category === "All" ? "All stories" : `${category} stories`}</h2>
          </div>
          <p className="text-sm text-sand-600">{listPosts.length} articles</p>
        </div>

        {listPosts.length === 0 ? (
          <div className="surface-card p-6">
            <p className="text-sm text-sand-700">No articles in this category yet. Check back shortly.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listPosts.map((post) => (
              <EditorialCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </section>

      <section className="surface-card-vivid p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Editorial mission</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink md:text-3xl">We track the creative industry so creators can move earlier.</h2>
        <p className="mt-2 max-w-3xl text-sm text-sand-700 md:text-base">
          Editorial Spotlight exists to connect market shifts with actionable context for creators, buyers, and teams building in the African creative economy.
        </p>
      </section>
    </div>
  );
}

function EditorialCard({ post }: { post: EditorialPost }) {
  return (
    <article className="surface-card overflow-hidden p-0 landing-hover-lift">
      <div className="aspect-[16/10] overflow-hidden bg-sand-100">
        <img src={post.cover_image} alt={post.title} className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <MetaBadge value={post.category} />
          <MetaBadge value={`${post.read_time_minutes} min read`} />
        </div>
        <Link to={`/editorial/${post.slug}`} className="block font-display text-xl font-bold leading-tight text-ink hover:text-cobalt-700">
          {post.title}
        </Link>
        <p className="text-sm text-sand-700">{post.excerpt}</p>
        <p className="text-xs uppercase tracking-[0.12em] text-sand-500">{formatEditorialDate(post.published_at)}</p>
        <Link
          to={`/editorial/${post.slug}`}
          className="inline-flex rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:border-cobalt-300 hover:bg-cobalt-50 hover:text-cobalt-700"
        >
          Read article
        </Link>
      </div>
    </article>
  );
}

function FilterPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.11em] transition ${
        active ? "border-cobalt-600 bg-cobalt-600 text-white" : "border-sand-200 bg-white text-sand-700 hover:bg-sand-100"
      }`}
    >
      {label}
    </button>
  );
}

function MetaBadge({ value }: { value: string }) {
  return <span className="rounded-full border border-sand-200 bg-sand-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-sand-700">{value}</span>;
}

function formatEditorialDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
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
