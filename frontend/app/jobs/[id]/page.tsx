export default function JobDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold">Job Details</h1>
      <p className="text-muted-foreground">Job ID: {params.id}</p>
    </div>
  );
}
