import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/lib/services/posts';
import { PostDetail } from '@/components/posts/PostDetail';
import { createClient } from '@/lib/supabase/server';

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SinglePostPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const post = await getPostBySlug(resolvedParams.slug);

  if (!post || post.status === 'DELETED' || post.status === 'HIDDEN') {
    notFound();
  }

  let user = null;
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();

    if (authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email_verified')
        .eq('id', authData.user.id)
        .single();

      user = profile;
    }
  } catch {
    // Ignore fallback
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PostDetail post={post as any} user={user} />
    </div>
  );
}
