import { Metadata } from "next";

async function getArticle(slug: string) {
  const res = await fetch(`${process.env.API_URL || "http://go-api:3001"}/api/v1/posts/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = await getArticle(params.slug);
  return { title: article?.title || "Article", description: article?.excerpt || "" };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article) return <div className="max-w-3xl mx-auto p-8"><h1 className="text-2xl font-bold">Article not found</h1></div>;
  return (
    <article className="max-w-3xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-4">{article.title}</h1>
      <div className="flex items-center gap-3 mb-8 text-muted-foreground">
        <span>By {article.author_name || "Unknown"}</span>
        <span>·</span>
        <span>{article.reading_time_minutes} min read</span>
        <span>·</span>
        <span>{article.view_count} views</span>
      </div>
      <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: article.content || article.excerpt }} />
    </article>
  );
}
