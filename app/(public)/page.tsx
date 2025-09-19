import PostList from "@/components/posts/PostList";
export const revalidate = 60;
export default async function Home() {
    return (
        <main className="max-w-screen mx-auto px-6 my-7 grid gap-7 md:grid-cols-[280px_1fr]">
            <div className="order-1 md:order-2">
                <PostList pageSize={10} />
            </div>
        </main>
    );
}