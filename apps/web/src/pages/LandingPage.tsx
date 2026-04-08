import { Link } from "react-router-dom";
import { routePreloaders } from "@/routes/pageLoaders";

const metrics = [
  { label: "Active sellers", value: "620+" },
  { label: "Template packs", value: "4.8k+" },
  { label: "African cities", value: "26" },
  { label: "Creative tools", value: "10+" }
];

const citySignals = [
  "Lagos Figma startup kits",
  "Nairobi Canva launch packs",
  "Accra brand deck systems",
  "Dakar motion promo scenes",
  "Kigali portrait preset bundles",
  "Cairo poster mockups",
  "Johannesburg creator media kits",
  "Abidjan packaging layouts",
  "Cape Town presentation systems",
  "Kampala wedding album spreads"
];

const spotlightTiles = [
  {
    title: "Startup landing UI kit",
    image: "/assets/landing/spotlight-ui-kit.jpg",
    discipline: "UI kit"
  },
  {
    title: "Launch carousel pack",
    image: "/assets/landing/spotlight-carousel.jpg",
    discipline: "Carousel pack"
  }
];

export function LandingPage() {
  const prefetchMarket = () => {
    void routePreloaders.market();
  };

  const prefetchCreators = () => {
    void routePreloaders.creators();
  };

  const prefetchBlog = () => {
    void routePreloaders.blog();
  };

  const prefetchUpload = () => {
    void routePreloaders.sell();
  };

  return (
    <div className="space-y-6 pb-8 md:space-y-8 lg:space-y-10">
      <section className="landing-canvas landing-hero relative overflow-hidden rounded-[2rem] border border-sand-200 p-5 md:p-8 lg:p-10">
        <div className="pointer-events-none absolute -top-24 right-[-3.5rem] h-72 w-72 rounded-full bg-cobalt-300/40 blur-3xl landing-blob-drift" />
        <div className="pointer-events-none absolute bottom-[-5rem] left-[-2rem] h-64 w-64 rounded-full bg-sunset-300/35 blur-3xl landing-blob-drift-reverse" />
        <div className="pointer-events-none absolute right-10 top-10 hidden h-48 w-48 rounded-full border border-cobalt-200/70 md:block landing-orbit-ring" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.03fr,0.97fr] lg:gap-6">
          <div className="space-y-4 md:space-y-5">
            <p className="chip-spectrum w-fit landing-reveal">Creative marketplace</p>
            <h1 className="headline text-[2.1rem] leading-tight sm:text-[2.4rem] md:text-5xl lg:text-6xl">
              Buy and sell creative templates from local creators.
            </h1>
            <p className="max-w-2xl text-sm text-sand-700 md:text-base">
              Crib starts with one clear product type: editable templates, source files, presets, and digital packs. Buyers discover
              high-fit work from local creators across African cities, then purchase with confidence from profile-rich storefronts.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link to="/market" onMouseEnter={prefetchMarket} onFocus={prefetchMarket} className="btn-gradient rounded-full px-6 py-3">
                Explore Marketplace
              </Link>
              <Link
                to="/creators"
                onMouseEnter={prefetchCreators}
                onFocus={prefetchCreators}
                className="rounded-full border border-sand-300 bg-white px-6 py-3 text-sm font-semibold uppercase tracking-wide text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
              >
                Browse Creators
              </Link>
              <Link
                to="/sell"
                onMouseEnter={prefetchUpload}
                onFocus={prefetchUpload}
                className="rounded-full border border-sand-300 bg-white px-6 py-3 text-sm font-semibold uppercase tracking-wide text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
              >
                Start Selling
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              {metrics.map((item, index) => (
                <MetricCard key={item.label} label={item.label} value={item.value} delay={index * 0.08} />
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <SignalChip label="Figma UI kits" />
              <SignalChip label="Canva launch packs" />
              <SignalChip label="Brand deck systems" />
              <SignalChip label="Social media templates" />
              <SignalChip label="Motion promo scenes" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="surface-card group overflow-hidden sm:col-span-2 landing-float">
              <div className="relative aspect-[16/9] overflow-hidden">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                >
                  <source src="/assets/landing/hero-video.mp4" type="video/mp4" />
                  <img
                    src="https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1400&q=80"
                    alt="Creative studio collage"
                    className="h-full w-full object-cover"
                  />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 rounded-xl border border-white/35 bg-white/12 px-3 py-2 backdrop-blur-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">Blog spotlight</p>
                    <p className="mt-0.5 text-sm font-semibold text-white">Creative workflows, seller playbooks, and market shifts</p>
                  </div>
                  <Link
                    to="/editorial"
                    onMouseEnter={prefetchBlog}
                    onFocus={prefetchBlog}
                    className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/30"
                  >
                    Read blog
                  </Link>
                </div>
              </div>
            </article>

            {spotlightTiles.map((tile) => (
              <PreviewTile key={tile.title} image={tile.image} title={tile.title} discipline={tile.discipline} />
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card overflow-hidden p-0">
        <div className="border-b border-sand-200 px-5 py-4 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Creative signals from across Africa</p>
        </div>
        <div className="py-4">
          <div className="landing-marquee flex min-w-max gap-3 px-5 md:px-6">
            {[...citySignals, ...citySignals].map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-sand-700"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-final-cta relative overflow-hidden rounded-[2rem] border border-cobalt-100 p-6 text-white md:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full border border-white/25 landing-orbit-ring" />
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.2fr,0.8fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Launch your creative storefront</p>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight md:text-4xl">
              Turn your creative workflow into income with a storefront built for templates.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">
              Publish editable files, show polished previews, and grow through focused discovery instead of competing with every digital product at once.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              to="/sell"
              onMouseEnter={prefetchUpload}
              onFocus={prefetchUpload}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-wide text-cobalt-700 transition hover:bg-sand-100"
            >
              Publish first asset
            </Link>
            <Link
              to="/creators"
              onMouseEnter={prefetchCreators}
              onFocus={prefetchCreators}
              className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Meet creators
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div className="rounded-xl border border-sand-200 bg-white/90 p-3 landing-reveal" style={{ animationDelay: `${delay}s` }}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-sand-600">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

function SignalChip({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <span
      className={
        dark
          ? "rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80"
          : "rounded-full border border-sand-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-600"
      }
    >
      {label}
    </span>
  );
}

function PreviewTile({ image, title, discipline }: { image: string; title: string; discipline: string }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-sand-200 bg-white landing-hover-lift">
      <div className="aspect-[4/3] overflow-hidden bg-sand-100">
        <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" decoding="async" />
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.11em] text-sand-500">{discipline}</p>
      </div>
    </article>
  );
}
