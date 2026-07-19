import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { postsAPI } from "@/api/apiClient";
import { createPageUrl, getPostVideoIndex } from "@/lib/utils";
import { PostThumbSkeleton } from "@/components/shared/LoadingSkeleton";
import { Layers, Heart, Play } from "lucide-react";

function PostThumb({ post }) {
  const postId = post.id || post._id;
  const [imgFailed, setImgFailed] = React.useState(false);
  const videoIndex = getPostVideoIndex(post);
  const isVideo = videoIndex !== -1;
  // Videos can't be dropped straight into an <img> — use the generated poster instead.
  const thumb = isVideo ? post.thumbnail_urls?.[videoIndex] : post.media_urls?.[0];
  const showImage = thumb && !imgFailed;

  return (
    <Link
      to={createPageUrl("PostDetail") + `?id=${postId}`}
      className="group relative block aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-100 dark:border-slate-700"
    >
      {showImage ? (
        <img
          src={thumb}
          alt=""
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-4 text-center">{post.content}</p>
        </div>
      )}
      {isVideo && showImage && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
          <Play className="w-2.5 h-2.5 fill-white text-white" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
        <Heart className="w-3 h-3 fill-white text-white" />
        <span className="text-[10px] text-white">{post.likes_count || 0}</span>
      </div>
    </Link>
  );
}

export default function RelatedPosts({ productId }) {
  const { t } = useTranslation();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["relatedPosts", productId],
    queryFn: async () => {
      const res = await postsAPI.list({ product_id: productId, limit: 12, sort: "-created_at" });
      return res?.data || [];
    },
    enabled: !!productId,
    staleTime: 120000,
  });

  if (!isLoading && posts.length === 0) return null;

  return (
    <div className="mt-12 border-t border-slate-100 dark:border-slate-700 pt-8">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5 text-orange-500" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("product.featuredInPosts")}</h2>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {isLoading
          ? Array(6).fill(0).map((_, i) => <PostThumbSkeleton key={`skeleton-${i}`} />)
          : posts.map(post => <PostThumb key={post.id || post._id} post={post} />)
        }
      </div>
    </div>
  );
}
