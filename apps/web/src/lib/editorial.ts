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

const editorialPosts: EditorialPost[] = [];

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
