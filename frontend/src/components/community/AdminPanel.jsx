import React, { useState } from "react";
import { communitiesAPI, communityMembersAPI, postsAPI } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2, Pin, PinOff, Users, UserX, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AdminPanel({ community, posts, members }) {
  const [rulesText, setRulesText] = useState(community?.rules || "");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const updateCommunityMutation = useMutation({
    mutationFn: (data) => communitiesAPI.update(community.id || community._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community"] });
      toast.success("Community updated");
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId) => postsAPI.delete(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityPosts"] });
      toast.success("Post removed");
    },
  });

  const pinPostMutation = useMutation({
    mutationFn: async ({ post, pin }) => {
      const postId = post._id || post.id;
      const communityId = community._id || community.id;
      // Store pinned_post_ids on community
      const currentPinned = community.pinned_post_ids || [];
      await communitiesAPI.update(communityId, {
        pinned_post_ids: pin ? [postId, ...currentPinned.filter(id => id !== postId)] : currentPinned.filter(id => id !== postId)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community"] });
      toast.success("Post pinning updated!");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId) => communityMembersAPI.delete(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityMembers"] });
      toast.success("Member removed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Shield className="w-4 h-4 text-indigo-500" /> Moderate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" /> Admin Panel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Community Rules */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> Community Rules
            </h4>
            <Textarea
              value={rulesText}
              onChange={e => setRulesText(e.target.value)}
              placeholder="Set rules for your community..."
              className="h-24 text-sm"
            />
            <Button
              size="sm"
              onClick={() => updateCommunityMutation.mutate({ rules: rulesText })}
              className="mt-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Save Rules
            </Button>
          </div>

          {/* Pin Posts */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Pin className="w-4 h-4" /> Pin / Remove Posts
            </h4>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {posts.slice(0, 10).map(post => {
                const postId = post._id || post.id;
                const isPinned = (community?.pinned_post_ids || []).includes(postId);
                return (
                  <div key={postId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                    <p className="flex-1 text-xs text-slate-700 line-clamp-1">{post.content}</p>
                    <button
                      onClick={() => pinPostMutation.mutate({ post, pin: !isPinned })}
                      className={`shrink-0 p-1.5 rounded-lg text-xs font-medium transition-colors ${isPinned ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                      title={isPinned ? "Unpin" : "Pin"}
                    >
                      {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => deletePostMutation.mutate(postId)}
                      className="shrink-0 p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                      title="Delete post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {posts.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No posts yet</p>}
            </div>
          </div>

          {/* Members */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Members ({members.length})
            </h4>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {members.map(m => {
                const memberId = m._id || m.id;
                return (
                  <div key={memberId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {m.member_email?.[0]?.toUpperCase()}
                    </div>
                    <p className="flex-1 text-xs text-slate-700 truncate">{m.member_email}</p>
                    <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0 capitalize">{m.role}</Badge>
                    <button
                      onClick={() => removeMemberMutation.mutate(memberId)}
                      className="shrink-0 p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                      title="Remove member"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {members.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No members yet</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}