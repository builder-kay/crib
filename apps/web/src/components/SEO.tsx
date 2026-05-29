import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { env } from "@/lib/env";

const SITE_NAME = "Crib";
const DEFAULT_TITLE = "Crib - African Digital Marketplace for Creatives";
const DEFAULT_DESCRIPTION =
  "Discover and sell African-first digital assets, beats, templates, design resources, and creative services on Crib.";
const DEFAULT_IMAGE = "/crib-logo.png";

export type SEOProps = {
  title?: string;
  description?: string;
  path?: string;
  image?: string | null;
  type?: "website" | "article" | "product" | "profile";
  noIndex?: boolean;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  priority?: number;
};

const routeMeta: Record<string, SEOProps> = {
  "/": {
    title: "Crib - African Digital Marketplace for Creatives",
    description: "Buy, sell, and hire African creative talent across digital assets, beats, templates, design, music, and film."
  },
  "/market": {
    title: "Digital Assets Marketplace - Crib",
    description: "Browse ready-to-use beats, templates, designs, files, and creator-made digital assets from African creatives."
  },
  "/hire": {
    title: "Hire African Creators - Crib",
    description: "Find and hire vetted creatives for design, music, video, strategy, and digital production work."
  },
  "/editorial": {
    title: "Creative Economy Blog - Crib",
    description: "Read Crib stories, trends, and practical insights for the African creative economy."
  },
  "/community": {
    title: "Creative Community - Crib",
    description: "Learn how Crib supports creators, buyers, collaboration, and trusted marketplace participation."
  },
  "/help": {
    title: "Help and Support - Crib",
    description: "Get help with Crib accounts, purchases, downloads, creator profiles, payouts, and marketplace support."
  },
  "/terms-of-use": {
    title: "Terms of Use - Crib",
    description: "Read the terms that govern buying, selling, hiring, and using the Crib marketplace."
  },
  "/privacy": {
    title: "Privacy Policy - Crib",
    description: "Learn how Crib handles account data, marketplace activity, payments, cookies, and privacy rights."
  },
  "/cookie-preferences": {
    title: "Cookie Preferences - Crib",
    description: "Manage cookie preferences and learn how Crib uses cookies across the marketplace."
  },
  "/do-not-sell-or-share": {
    title: "Privacy Choices - Crib",
    description: "Review privacy choices for data sharing, targeted advertising, and marketplace privacy controls."
  },
  "/auth": {
    title: "Sign In - Crib",
    description: "Sign in or create a Crib account to buy, sell, save, and manage creative marketplace activity.",
    noIndex: true
  },
  "/editorial-login": {
    title: "Editorial Login - Crib",
    description: "Sign in to Crib editorial tools.",
    noIndex: true
  }
};

function normalizeSiteUrl() {
  return env.VITE_SITE_URL.replace(/\/+$/, "");
}

function absoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) {
    return `${normalizeSiteUrl()}${DEFAULT_IMAGE}`;
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${normalizeSiteUrl()}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function getOrCreateMeta(selector: string, create: () => HTMLMetaElement) {
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) {
    return existing;
  }

  const element = create();
  document.head.appendChild(element);
  return element;
}

function setNamedMeta(name: string, content: string) {
  const element = getOrCreateMeta(`meta[name="${name}"]`, () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", name);
    return meta;
  });
  element.setAttribute("content", content);
}

function setPropertyMeta(property: string, content: string) {
  const element = getOrCreateMeta(`meta[property="${property}"]`, () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", property);
    return meta;
  });
  element.setAttribute("content", content);
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

function setJsonLd(data: SEOProps["jsonLd"]) {
  document.head.querySelectorAll('script[data-crib-seo="json-ld"]').forEach((element) => element.remove());

  if (!data) {
    return;
  }

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.cribSeo = "json-ld";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path,
  image,
  type = "website",
  noIndex = false,
  jsonLd,
  priority = 0
}: SEOProps) {
  const location = useLocation();
  const canonicalPath = path ?? location.pathname;
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl(image ?? DEFAULT_IMAGE);

  useEffect(() => {
    const activePriority = Number(document.head.dataset.cribSeoPriority ?? "-1");
    const activePath = document.head.dataset.cribSeoPath ?? "";
    if (activePath === canonicalUrl && activePriority > priority) {
      return;
    }

    document.head.dataset.cribSeoPriority = String(priority);
    document.head.dataset.cribSeoPath = canonicalUrl;
    document.title = title;
    setNamedMeta("description", description);
    setNamedMeta("robots", noIndex ? "noindex,nofollow" : "index,follow");
    setNamedMeta("twitter:card", "summary_large_image");
    setNamedMeta("twitter:title", title);
    setNamedMeta("twitter:description", description);
    setNamedMeta("twitter:image", imageUrl);
    setPropertyMeta("og:site_name", SITE_NAME);
    setPropertyMeta("og:title", title);
    setPropertyMeta("og:description", description);
    setPropertyMeta("og:type", type === "article" || type === "product" || type === "profile" ? type : "website");
    setPropertyMeta("og:url", canonicalUrl);
    setPropertyMeta("og:image", imageUrl);
    setCanonical(canonicalUrl);
    setJsonLd(jsonLd);
  }, [canonicalUrl, description, imageUrl, jsonLd, noIndex, priority, title, type]);

  return null;
}

export function RouteSEO() {
  const location = useLocation();
  const meta = routeMeta[location.pathname] ?? getPatternMeta(location.pathname);
  const siteUrl = normalizeSiteUrl();

  return (
    <SEO
      {...meta}
      jsonLd={
        meta.noIndex
          ? undefined
          : [
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: SITE_NAME,
                url: siteUrl,
                logo: absoluteUrl(DEFAULT_IMAGE)
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: SITE_NAME,
                url: siteUrl,
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${siteUrl}/market?q={search_term_string}`,
                  "query-input": "required name=search_term_string"
                }
              }
            ]
      }
    />
  );
}

function getPatternMeta(pathname: string): SEOProps {
  if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard") || pathname.startsWith("/receipts")) {
    return {
      title: "Crib Account Workspace",
      description: "Private Crib workspace.",
      noIndex: true
    };
  }

  if (pathname.startsWith("/asset/")) {
    return {
      title: "Digital Asset Listing - Crib",
      description: "View this creator-made digital asset on Crib.",
      type: "product"
    };
  }

  if (pathname.startsWith("/profile/")) {
    return {
      title: "Creator Profile - Crib",
      description: "Explore this creator profile, portfolio, reviews, and hire options on Crib.",
      type: "profile"
    };
  }

  if (pathname.startsWith("/editorial/")) {
    return {
      title: "Crib Blog Story",
      description: "Read this Crib story about creative work, trends, and the African creative economy.",
      type: "article"
    };
  }

  return {
    title: "Page Not Found - Crib",
    description: "This Crib page could not be found.",
    noIndex: true
  };
}
