import Pagination from "@/components/Pagination";
import ThreadCard from "@/components/ThreadCard";
import { fetchPosts } from "@/lib/actions/thread.action";



export default async function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const result = await fetchPosts(
    searchParams.page ? +searchParams.page : 1,
    30
  );

  return (
    <>
      <h1 className='head-text text-left'>Home</h1>

      <section className='mt-9 flex flex-col gap-10'>
        {result.posts.length === 0 ? (
          <p className='no-result'>No threads found</p>
        ) : (
          <>
            {result.posts.map((post) => (
              <div key={post.id}>
                <ThreadCard
                  //@ts-ignore
                  id={post._id}
                  currentUser={""}
                  currUserId2={""}
                  parentId={post.parentId}
                  content={post.text}
                  author={post.author}
                  community={post.community}
                  createdAt={post.createdAt}
                  comments={post.children}
                  istags={post.tags.length > 0}
                  tags={post.tags}
                  likes={post.likes}
                />
         
              </div>
               ))}
          </>
        )}
      </section>

      <Pagination
        path='/'
        pageNumber={searchParams?.page ? +searchParams.page : 1}
        isNext={result.isNext}
      />
    </>

  );
}
