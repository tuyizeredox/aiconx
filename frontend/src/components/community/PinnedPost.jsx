import React from "react";
import { Pin, MessageCircle, Heart } from "lucide-react";

export default function PinnedPost({ post }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Pin className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pinned</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {post.author_name?.[0]?.toUpperCase() || "U"}
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-800">{post.author_name}</span>
          <span className="text-[10px] text-slate-400 ml-2">{new Date(post.created_at || post.created_date).toLocaleDateString()}</span>
        </div>
      </div>
      <p className="text-sm text-slate-700 line-clamp-3">{post.content}</p>
      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes_count || 0}</span>
        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments_count || 0}</span>
      </div>
    </div>
  );
}