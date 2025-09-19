export default function ProseExample() {
  return (
    <article className="border border-border rounded-xl bg-card shadow-soft">
      <div className="p-6 prose">
        <h1>Example article</h1>
        <p>This is what a long-form article looks like using the <em>prose</em> styles. Keep the line-length comfortable and contrast solid.</p>
        <blockquote>Quote blocks highlight important thoughts without overwhelming the reading flow.</blockquote>
        <p>Links <a href="#">stand out</a>, images and videos are responsive, and spacing is consistent.</p>
      </div>
    </article>
  );
}
