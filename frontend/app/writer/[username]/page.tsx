import { Metadata } from "next";
async function getWriter(username: string) {
  const res = await fetch(`${process.env.API_URL || "http://go-api:3001"}/api/v1/users/${username}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()).data;
}
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const writer = await getWriter(username);
  return { title: writer?.display_name || username };
}
export default async function WriterPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const writer = await getWriter(username);
  if (!writer) return <div className="max-w-3xl mx-auto p-8"><h1 className="text-2xl">Writer not found</h1></div>;
  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">{(writer.display_name || writer.username)[0]}</div>
        <div>
          <h1 className="text-2xl font-bold">{writer.display_name}</h1>
          <p className="text-muted-foreground">@{writer.username}</p>
          <p className="text-sm">{writer.follower_count} followers · {writer.following_count} following</p>
        </div>
      </div>
      <p className="text-muted-foreground">{writer.bio || "No bio yet."}</p>
    </div>
  );
}
