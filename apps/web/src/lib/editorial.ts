export type EditorialSection = {
  heading: string;
  paragraphs: string[];
  points?: string[];
};

export type EditorialPost = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  category: "Industry" | "Creator Economy" | "Design" | "Music" | "Film";
  published_at: string;
  read_time_minutes: number;
  cover_image: string;
  spotlight?: boolean;
  tags: string[];
  author: {
    name: string;
    role: string;
  };
  sections: EditorialSection[];
  created_at?: string;
  updated_at?: string;
};

const editorialPosts: EditorialPost[] = [
  {
    slug: "why-creator-identity-is-winning-digital-commerce",
    title: "Why creator identity is winning digital commerce in 2026",
    excerpt:
      "Anonymous storefronts are losing trust. Buyers now choose creators with a clear voice, niche, and visible body of work.",
    category: "Creator Economy",
    published_at: "2026-02-10T08:30:00.000Z",
    read_time_minutes: 6,
    cover_image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=80",
    spotlight: true,
    tags: ["creator profiles", "commerce", "trust", "branding"],
    author: {
      name: "Aisha Nkrumah",
      role: "Editorial Lead"
    },
    sections: [
      {
        heading: "The shift from product-first to creator-first",
        paragraphs: [
          "For years, digital marketplaces optimized for volume: more files, more categories, more listings. That model worked for simple distribution but not for long-term creator growth.",
          "Today, buyers are overwhelmed by generic options. They want context. They want to understand the perspective, process, and craft discipline behind what they purchase."
        ]
      },
      {
        heading: "What identity signals buyers trust",
        paragraphs: [
          "Creator bio, portfolio consistency, niche clarity, and publishing rhythm all act as trust signals. A product card alone is no longer enough to close a purchase.",
          "The strongest creator storefronts combine quality previews with a coherent creative point of view. That combination reduces purchase hesitation and increases repeat buying."
        ],
        points: [
          "Clear niche beats broad but vague positioning",
          "Portfolio depth beats one viral product",
          "Visible creator voice beats anonymous branding"
        ]
      },
      {
        heading: "Editorial implication",
        paragraphs: [
          "Marketplace teams should treat identity as core infrastructure, not a cosmetic layer. The platforms winning in 2026 are those that turn creator profiles into discoverable, trusted destinations."
        ]
      }
    ]
  },
  {
    slug: "african-design-systems-enter-a-new-era",
    title: "African design systems enter a new era of export-ready products",
    excerpt:
      "Design teams across Lagos, Nairobi, and Cape Town are packaging system-level assets that travel globally without losing local voice.",
    category: "Design",
    published_at: "2026-02-05T09:00:00.000Z",
    read_time_minutes: 5,
    cover_image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80",
    tags: ["design systems", "product design", "ui kits"],
    author: {
      name: "Kwame Adjei",
      role: "Design Industry Editor"
    },
    sections: [
      {
        heading: "From freelance files to system products",
        paragraphs: [
          "A major shift is happening in design exports: creators are no longer selling isolated templates. They are shipping complete design systems with reusable rules, component logic, and documentation.",
          "This increases customer lifetime value because one creator can now serve agencies, startups, and in-house teams with the same product family."
        ]
      },
      {
        heading: "Why this matters now",
        paragraphs: [
          "Global buyers are looking for differentiated visual language and faster implementation. System-level products satisfy both needs when they are built with clear intent and strong adaptation notes."
        ]
      }
    ]
  },
  {
    slug: "inside-the-new-african-audio-economy",
    title: "Inside the new African audio economy: packs, stems, and cultural range",
    excerpt:
      "Beat packs are evolving into high-context audio products with session files, vocal chains, and storytelling-ready metadata.",
    category: "Music",
    published_at: "2026-01-29T11:20:00.000Z",
    read_time_minutes: 7,
    cover_image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1600&q=80",
    tags: ["audio", "music production", "beat packs"],
    author: {
      name: "Temi Bako",
      role: "Music Market Analyst"
    },
    sections: [
      {
        heading: "Audio packs are becoming production frameworks",
        paragraphs: [
          "The most successful creators now bundle stems, MIDI ideas, processing chains, and arrangement references. This turns a one-time download into a production workflow.",
          "Buyers do not just want sounds. They want speed, confidence, and a reliable starting point for finished records."
        ]
      },
      {
        heading: "Distribution quality is now a differentiator",
        paragraphs: [
          "Clear tagging, smart naming conventions, and consistent gain staging are moving from optional to expected. Technical discipline now drives conversion as much as musical quality."
        ]
      }
    ]
  },
  {
    slug: "creative-ops-stack-every-solo-creator-needs",
    title: "The creative ops stack every solo creator needs this year",
    excerpt:
      "Top-performing independents are combining profile strategy, release cadence, and audience analytics into one operational loop.",
    category: "Industry",
    published_at: "2026-01-21T13:40:00.000Z",
    read_time_minutes: 6,
    cover_image: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
    tags: ["operations", "creator workflow", "growth"],
    author: {
      name: "Lerato Sibanda",
      role: "Industry Reporter"
    },
    sections: [
      {
        heading: "Creators are running lean media companies",
        paragraphs: [
          "The solo creator role now includes product strategy, marketing, customer support, and analytics. Those who systemize these tasks scale faster and burn out less.",
          "A weekly release schedule tied to clear audience segments can outperform sporadic launches with higher individual production value."
        ]
      },
      {
        heading: "Operational habits that compound",
        paragraphs: [
          "Small process improvements generate significant gains over time when repeated. Creators who review conversion data monthly tend to improve pricing clarity and page performance faster."
        ],
        points: [
          "Use one source of truth for product metadata",
          "Track conversion from profile views to purchases",
          "Review underperforming listings every two weeks"
        ]
      }
    ]
  },
  {
    slug: "short-form-film-editors-are-driving-new-demand",
    title: "Short-form film editors are driving a new LUT and motion template boom",
    excerpt:
      "As social-native documentaries and mini-series grow, editors are buying curated packs that cut post-production time.",
    category: "Film",
    published_at: "2026-01-14T10:00:00.000Z",
    read_time_minutes: 5,
    cover_image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1600&q=80",
    tags: ["film", "luts", "post production", "motion templates"],
    author: {
      name: "Ifeoma Obi",
      role: "Film and Motion Editor"
    },
    sections: [
      {
        heading: "Speed now defines post-production product value",
        paragraphs: [
          "Editors are under tighter deadlines and publishing more formats per project. Reusable assets that reduce repetitive setup work are seeing stronger demand.",
          "LUT packs and title templates perform best when they are built for realistic mixed-light footage, not only studio conditions."
        ]
      },
      {
        heading: "What buyers expect from modern packs",
        paragraphs: [
          "Strong packs include use-case notes, before-and-after references, and compatibility details across editing tools. Presentation quality directly affects conversion."
        ]
      }
    ]
  },
  {
    slug: "whats-next-for-editorial-commerce-in-creative-marketplaces",
    title: "What is next for editorial commerce in creative marketplaces",
    excerpt:
      "Editorial teams are becoming growth engines by connecting trend reporting, creator storytelling, and marketplace discovery.",
    category: "Creator Economy",
    published_at: "2026-01-07T09:45:00.000Z",
    read_time_minutes: 4,
    cover_image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80",
    tags: ["editorial", "marketplace strategy", "discovery"],
    author: {
      name: "Samira El-Masry",
      role: "Commerce Strategy Writer"
    },
    sections: [
      {
        heading: "Editorial is no longer optional content marketing",
        paragraphs: [
          "In modern creator marketplaces, editorial curation shapes discovery. It creates relevance and helps buyers navigate trends with context.",
          "Strong editorial products map stories to creator profiles and listings, turning attention into meaningful commercial outcomes."
        ]
      },
      {
        heading: "The next stage",
        paragraphs: [
          "The next wave will blend human curation with data-driven trend signals. Teams that do this well will surface emerging creators earlier and build stronger platform loyalty."
        ]
      }
    ]
  }
];

function byPublishedDate(a: EditorialPost, b: EditorialPost) {
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
}

export function getEditorialPosts() {
  return [...editorialPosts].sort(byPublishedDate);
}

export function getEditorialPostBySlug(slug: string) {
  return editorialPosts.find((post) => post.slug === slug);
}

export const editorialCategories = Array.from(new Set(editorialPosts.map((post) => post.category)));
