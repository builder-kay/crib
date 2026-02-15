import { Link } from "react-router-dom";

const metrics = [
  { label: "Active creators", value: "2.1k+" },
  { label: "Digital assets", value: "14k+" },
  { label: "African cities", value: "26" },
  { label: "Live categories", value: "18" }
];

const citySignals = [
  "Lagos editorial kits",
  "Nairobi UX systems",
  "Accra logo packs",
  "Dakar motion loops",
  "Kigali photo presets",
  "Cairo script fonts",
  "Johannesburg beat libraries",
  "Abidjan 3D scenes",
  "Cape Town typography packs",
  "Kampala documentary LUTs"
];

const spotlightTiles = [
  {
    title: "Afrofuturist UI system",
    discipline: "Product design - Nairobi",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "Amapiano producer vault",
    discipline: "Audio craft - Johannesburg",
    image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "Textile pattern loops",
    discipline: "Motion graphics - Dakar",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "Documentary color LUTs",
    discipline: "Film post - Lagos",
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80"
  }
];

const creatorPulse = [
  { name: "Adjoa Mensah", city: "Accra", niche: "Brand systems" },
  { name: "Banele Khumalo", city: "Cape Town", niche: "3D motion" },
  { name: "Lilian Wekesa", city: "Nairobi", niche: "UX templates" },
  { name: "Kazeem Bello", city: "Lagos", niche: "Beat packs" },
  { name: "Sihle Ndaba", city: "Johannesburg", niche: "Sound design" }
];

const valueCards = [
  {
    title: "Niche-led discovery",
    body: "Find work by creative lane, not only by file extension. Explore UI systems, music production, motion loops, and film post assets.",
    accent: "bg-cobalt-600"
  },
  {
    title: "Curated editor desk",
    body: "Weekly editor picks keep high-quality work visible and help buyers discover creators beyond the default trending list.",
    accent: "bg-lagoon-600"
  },
  {
    title: "Identity-first commerce",
    body: "Each listing connects to a public creator profile with voice, niche, and portfolio so every purchase feels personal.",
    accent: "bg-sunset-600"
  }
];

const categoryCards = [
  {
    title: "Brand and Identity",
    detail: "Logo systems, social kits, and visual languages for modern African brands.",
    meta: "1.6k assets",
    tone: "from-cobalt-100 via-white to-cobalt-50"
  },
  {
    title: "Music and Audio",
    detail: "Beat packs, stems, vocal chains, and sample textures from local scenes.",
    meta: "2.2k assets",
    tone: "from-sunset-100 via-white to-ember-50"
  },
  {
    title: "Motion and 3D",
    detail: "Loop packs, title animations, transitions, and 3D environment templates.",
    meta: "1.1k assets",
    tone: "from-lagoon-100 via-white to-lagoon-50"
  },
  {
    title: "Photo and Film",
    detail: "Color LUTs, light leaks, overlays, and grading packs built for storytelling.",
    meta: "950 assets",
    tone: "from-sand-100 via-white to-sand-50"
  },
  {
    title: "Web and Product",
    detail: "Wireframes, UI kits, and no-code templates ready for production work.",
    meta: "1.9k assets",
    tone: "from-forest-100 via-white to-forest-50"
  },
  {
    title: "Type and Graphics",
    detail: "Display fonts, pattern libraries, and print-ready creative components.",
    meta: "1.3k assets",
    tone: "from-ember-100 via-white to-ember-50"
  }
];

const journeySteps = [
  {
    step: "01",
    title: "Craft a profile with personality",
    body: "Add your bio, niche, portfolio, and creative story so buyers know the human behind the work."
  },
  {
    step: "02",
    title: "Upload and publish assets",
    body: "Package files, set clear pricing, and publish with preview media that communicates quality."
  },
  {
    step: "03",
    title: "Grow with discovery loops",
    body: "Get surfaced through category feeds, trending signals, and editor picks as your profile gains traction."
  }
];

const editorPicks = [
  {
    title: "Neo-Nubia UI Frame",
    tag: "Interface design",
    body: "A cinematic dashboard kit with expressive typography and modular product screens.",
    city: "Lagos"
  },
  {
    title: "Sahara Texture Archive",
    tag: "Visual assets",
    body: "High-resolution pattern library inspired by textile geometry and natural surfaces.",
    city: "Dakar"
  },
  {
    title: "Kigali Story Grade",
    tag: "Film color",
    body: "Balanced LUT pack designed for documentaries, editorial projects, and social cuts.",
    city: "Kigali"
  }
];

const creatorQuotes = [
  {
    quote: "Crib feels like a creative neighborhood, not a generic storefront. Buyers now message me because they connect with my profile story.",
    name: "Mira Ndlovu",
    role: "Motion designer, Johannesburg"
  },
  {
    quote: "The platform highlights my niche instead of burying it. I get better-fit customers and less random traffic.",
    name: "Tosin Adebayo",
    role: "Sound designer, Lagos"
  },
  {
    quote: "My first week on Crib brought repeat buyers because they could see my full portfolio, not just one file.",
    name: "Nana Asare",
    role: "Brand creative, Accra"
  }
];

export function LandingPage() {
  return (
    <div className="space-y-6 pb-8 md:space-y-8 lg:space-y-10">
      <section className="landing-canvas landing-hero relative overflow-hidden rounded-[2rem] border border-sand-200 p-5 md:p-8 lg:p-10">
        <div className="pointer-events-none absolute -top-24 right-[-3.5rem] h-72 w-72 rounded-full bg-cobalt-300/40 blur-3xl landing-blob-drift" />
        <div className="pointer-events-none absolute bottom-[-5rem] left-[-2rem] h-64 w-64 rounded-full bg-sunset-300/35 blur-3xl landing-blob-drift-reverse" />
        <div className="pointer-events-none absolute right-10 top-10 hidden h-48 w-48 rounded-full border border-cobalt-200/70 md:block landing-orbit-ring" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.03fr,0.97fr] lg:gap-6">
          <div className="space-y-4 md:space-y-5">
            <p className="chip-spectrum w-fit landing-reveal">Africa&apos;s creative commerce layer</p>
            <h1 className="headline text-[2.1rem] leading-tight sm:text-[2.4rem] md:text-5xl lg:text-6xl">
              A full creative marketplace where identity, culture, and motion drive discovery.
            </h1>
            <p className="max-w-2xl text-sm text-sand-700 md:text-base">
              Crib makes digital products feel alive. Buyers discover creators by niche, style, and creative point of view across African
              cities, then purchase with confidence from profile-rich storefronts.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link to="/market" className="btn-gradient rounded-full px-6 py-3">
                Explore Marketplace
              </Link>
              <Link
                to="/creators"
                className="rounded-full border border-sand-300 bg-white px-6 py-3 text-sm font-semibold uppercase tracking-wide text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
              >
                Browse Creators
              </Link>
              <Link
                to="/dashboard/upload"
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
              <SignalChip label="Afrofuturist UI" />
              <SignalChip label="Amapiano packs" />
              <SignalChip label="Kente-inspired graphics" />
              <SignalChip label="Documentary LUTs" />
              <SignalChip label="Type design from Cairo" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="surface-card group overflow-hidden sm:col-span-2 landing-float">
              <div className="relative aspect-[16/9] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1400&q=80"
                  alt="Creative studio collage"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 rounded-xl border border-white/35 bg-white/12 px-3 py-2 backdrop-blur-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">Editorial spotlight</p>
                    <p className="mt-0.5 text-sm font-semibold text-white">Creative industry news, trends, and market shifts</p>
                  </div>
                  <Link
                    to="/editorial"
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

      <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <article className="surface-card-vivid landing-reveal overflow-hidden p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Built for creative identity</p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-ink md:text-3xl">Not a file dump. A discovery engine for people and craft.</h2>
          <p className="mt-3 max-w-2xl text-sm text-sand-700 md:text-base">
            Crib turns each creator into a destination with profile context, niche metadata, and portfolio depth. That means buyers discover
            better work and creators build durable audiences.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {valueCards.map((card, index) => (
              <FeatureCard key={card.title} title={card.title} body={card.body} accent={card.accent} delay={index * 0.09} />
            ))}
          </div>
        </article>

        <article className="surface-card landing-float-delayed p-5 md:p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Fresh creator pulse</p>
            <span className="rounded-full bg-forest-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-700">
              Live now
            </span>
          </div>
          <div className="mt-3 space-y-2.5">
            {creatorPulse.map((creator) => (
              <CreatorRow key={creator.name} name={creator.name} city={creator.city} niche={creator.niche} />
            ))}
          </div>
        </article>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Discovery lanes</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink md:text-3xl">Browse by creative category</h2>
          </div>
          <Link
            to="/market"
            className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
          >
            Open market feed
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categoryCards.map((card, index) => (
            <CategoryCard key={card.title} title={card.title} detail={card.detail} meta={card.meta} tone={card.tone} delay={index * 0.05} />
          ))}
        </div>
      </section>

      <section className="surface-card overflow-hidden p-0">
        <div className="border-b border-sand-200 px-5 py-4 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Creator journey</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink md:text-2xl">How Crib works</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
          {journeySteps.map((step, index) => (
            <JourneyCard key={step.step} step={step.step} title={step.title} body={step.body} delay={index * 0.07} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
        <article className="surface-card landing-reveal p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Editor&apos;s desk</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink md:text-2xl">What curators are highlighting this week</h2>
          <div className="mt-4 space-y-3">
            {editorPicks.map((pick, index) => (
              <EditorPickCard key={pick.title} title={pick.title} tag={pick.tag} body={pick.body} city={pick.city} delay={index * 0.06} />
            ))}
          </div>
        </article>

        <article className="surface-card-vivid landing-reveal p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-700">Creator voices</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink md:text-2xl">Why creators stay on Crib</h2>
          <div className="mt-4 space-y-3">
            {creatorQuotes.map((quote, index) => (
              <QuoteCard key={quote.name} quote={quote.quote} name={quote.name} role={quote.role} delay={index * 0.06} />
            ))}
          </div>
        </article>
      </section>

      <section className="landing-final-cta relative overflow-hidden rounded-[2rem] border border-cobalt-100 p-6 text-white md:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full border border-white/25 landing-orbit-ring" />
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.2fr,0.8fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Launch your creative storefront</p>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight md:text-4xl">
              Turn your portfolio into income with a landing page that feels alive.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">
              Build identity, publish assets, and grow through category discovery, trending signals, and editor visibility.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              to="/dashboard/upload"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-wide text-cobalt-700 transition hover:bg-sand-100"
            >
              Publish first asset
            </Link>
            <Link
              to="/creators"
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

function SignalChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-600">
      {label}
    </span>
  );
}

function PreviewTile({ image, title, discipline }: { image: string; title: string; discipline: string }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-sand-200 bg-white landing-hover-lift">
      <div className="aspect-[4/3] overflow-hidden bg-sand-100">
        <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.11em] text-sand-500">{discipline}</p>
      </div>
    </article>
  );
}

function CreatorRow({ name, city, niche }: { name: string; city: string; niche: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-cobalt-100 bg-white/90 px-3 py-2 landing-hover-lift">
      <div>
        <p className="text-sm font-semibold text-ink">{name}</p>
        <p className="text-[10px] uppercase tracking-[0.12em] text-sand-500">{city}</p>
      </div>
      <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-600">
        {niche}
      </span>
    </div>
  );
}

function FeatureCard({ title, body, accent, delay }: { title: string; body: string; accent: string; delay: number }) {
  return (
    <article className="overflow-hidden rounded-xl border border-sand-200 bg-white p-0 landing-reveal" style={{ animationDelay: `${delay}s` }}>
      <div className={`h-1.5 w-full ${accent}`} />
      <div className="p-4">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-sand-600">{body}</p>
      </div>
    </article>
  );
}

function CategoryCard({
  title,
  detail,
  meta,
  tone,
  delay
}: {
  title: string;
  detail: string;
  meta: string;
  tone: string;
  delay: number;
}) {
  return (
    <article className={`landing-hover-lift rounded-2xl border border-sand-200 bg-gradient-to-br p-5 landing-reveal ${tone}`} style={{ animationDelay: `${delay}s` }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cobalt-700">{meta}</p>
      <h3 className="mt-2 font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-sand-700">{detail}</p>
    </article>
  );
}

function JourneyCard({ step, title, body, delay }: { step: string; title: string; body: string; delay: number }) {
  return (
    <article className="landing-reveal rounded-2xl border border-sand-200 bg-white p-4" style={{ animationDelay: `${delay}s` }}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cobalt-700">{step}</p>
      <h3 className="mt-2 font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-sand-600">{body}</p>
    </article>
  );
}

function EditorPickCard({
  title,
  tag,
  body,
  city,
  delay
}: {
  title: string;
  tag: string;
  body: string;
  city: string;
  delay: number;
}) {
  return (
    <article className="landing-reveal rounded-2xl border border-sand-200 bg-white p-4 landing-hover-lift" style={{ animationDelay: `${delay}s` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-700">
          {tag}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cobalt-700">{city}</span>
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-sand-600">{body}</p>
    </article>
  );
}

function QuoteCard({
  quote,
  name,
  role,
  delay
}: {
  quote: string;
  name: string;
  role: string;
  delay: number;
}) {
  return (
    <article className="landing-reveal rounded-2xl border border-cobalt-100 bg-white/90 p-4 landing-hover-lift" style={{ animationDelay: `${delay}s` }}>
      <p className="text-sm text-sand-700">{quote}</p>
      <p className="mt-3 text-sm font-semibold text-ink">{name}</p>
      <p className="text-[11px] uppercase tracking-[0.12em] text-sand-500">{role}</p>
    </article>
  );
}
