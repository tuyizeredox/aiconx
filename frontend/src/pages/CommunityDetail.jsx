import React, { useState } from "react"; 
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { useTranslation } from "react-i18next"; 
 import { Link, useSearchParams } from "react-router-dom"; 
 import { communitiesAPI, postsAPI, authAPI, communityMembersAPI } from "@/api/apiClient"; 
 import PostCard from "@/components/shared/PostCard"; 
 import { PostSkeleton } from "@/components/shared/LoadingSkeleton"; 
 import PinnedPost from "@/components/community/PinnedPost"; 
 import AdminPanel from "@/components/community/AdminPanel"; 
 import { 
   Users, ArrowLeft, UserPlus, UserCheck, MessageSquare, 
   PenSquare, Shield 
 } from "lucide-react"; 
 import { Button } from "@/components/ui/button"; 
 import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"; 
 import { toast } from "sonner"; 
 
const COMMUNITY_CATEGORIES = [ 
   { id: "fashion", emoji: "👗" }, { id: "tech", emoji: "💻" }, { id: "fitness", emoji: "💪" }, 
   { id: "food", emoji: "🍕" }, { id: "art", emoji: "🎨" }, { id: "music", emoji: "🎵" }, 
   { id: "gaming", emoji: "🎮" }, { id: "travel", emoji: "✈️" }, { id: "diy", emoji: "🛠️" }, 
 ]; 

 export default function CommunityDetail() { 
   const { t } = useTranslation();
   const [searchParams] = useSearchParams(); 
   const communityId = searchParams.get("id"); 
   const [activeTab, setActiveTab] = useState("posts"); 
   const queryClient = useQueryClient(); 

   const { data: currentUser } = useQuery({ 
     queryKey: ["currentUser"], 
     queryFn: () => authAPI.me(), 
     retry: false, 
   }); 

   const { data: community } = useQuery({ 
     queryKey: ["community", communityId], 
     queryFn: async () => { 
       const res = await communitiesAPI.get(communityId); 
       return res.data || res;
     }, 
     enabled: !!communityId, 
   }); 

   const { data: postsData, isLoading: postsLoading } = useQuery({ 
     queryKey: ["communityPosts", communityId, currentUser?.username], 
     queryFn: async () => {
       const params = { community_id: communityId, limit: 50 };
       if (currentUser?.username) params.user_username = currentUser.username;
       const res = await postsAPI.list(params);
       return res.data || [];
     },
     enabled: !!communityId, 
   }); 

   const posts = postsData || [];

   const { data: membershipData } = useQuery({ 
     queryKey: ["communityMembership", communityId, currentUser?.email], 
     queryFn: async () => { 
       if (!currentUser?.email) return null;
       const res = await communityMembersAPI.list({ community_id: communityId, member_email: currentUser.email });
       return res.data?.[0] || null;
     }, 
     enabled: !!communityId && !!currentUser?.email, 
   }); 

   const { data: members = [] } = useQuery({ 
     queryKey: ["communityMembers", communityId], 
     queryFn: async () => {
       const res = await communityMembersAPI.list({ community_id: communityId, limit: 100 });
       return res.data || [];
     },
     enabled: !!communityId, 
   }); 

   const isMember = !!membershipData || community?.owner_email === currentUser?.email; 
   const isAdmin = community?.owner_email === currentUser?.email; 

   const joinMutation = useMutation({ 
     mutationFn: async () => { 
       if (isMember && membershipData) { 
         await communityMembersAPI.delete(membershipData.id || membershipData._id); 
       } else { 
         await communitiesAPI.join(communityId); 
       } 
     }, 
     onSuccess: () => { 
       queryClient.invalidateQueries({ queryKey: ["communityMembership", communityId] }); 
       queryClient.invalidateQueries({ queryKey: ["myCommunityMemberships"] }); 
       queryClient.invalidateQueries({ queryKey: ["community", communityId] }); 
       queryClient.invalidateQueries({ queryKey: ["communityMembers", communityId] });
       toast.success(isMember ? t("communities.leftCommunity") : t("communities.joinedCommunity")); 
     }, 
   }); 

   if (!community) return <div className="text-center py-20 text-slate-400">{t("common.loading")}</div>; 

   const catEmoji = COMMUNITY_CATEGORIES.find(c => c.id === community.category)?.emoji || "👥"; 

   const pinnedPostIds = new Set(community.pinned_post_ids || community.featured_products || []); 
   const pinnedPosts = posts.filter(p => pinnedPostIds.has(p._id)); 
   const regularPosts = posts.filter(p => !pinnedPostIds.has(p._id)); 

   return ( 
     <div className="max-w-2xl mx-auto px-4 py-4 lg:py-6"> 
       <Link to="/communities" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"> 
         <ArrowLeft className="w-4 h-4" /> {t("communities.title")}
       </Link> 

       {/* Banner */} 
       <div className="rounded-2xl overflow-hidden mb-6 bg-white border border-slate-100 shadow-sm"> 
         <div className="h-32 lg:h-40 bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400 relative"> 
           {community.cover_image && <img src={community.cover_image} alt="" className="w-full h-full object-cover" />} 
           {isAdmin && ( 
             <div className="absolute top-3 right-3 px-2 py-1 bg-indigo-700/80 backdrop-blur-sm rounded-lg flex items-center gap-1 text-white text-xs font-medium"> 
               <Shield className="w-3 h-3" /> {t("communities.admin")} 
             </div> 
           )} 
         </div> 
         <div className="p-5 -mt-8 relative"> 
           <div className="w-16 h-16 rounded-2xl bg-white shadow-lg border border-slate-100 flex items-center justify-center text-2xl mb-3"> 
             {catEmoji} 
           </div> 
           <div className="flex items-start justify-between gap-3"> 
             <div className="flex-1 min-w-0"> 
               <h1 className="text-2xl font-bold text-slate-900 mb-1">{community.name}</h1> 
               <p className="text-sm text-slate-500 mb-3">{community.description}</p> 
               <div className="flex items-center gap-4 text-sm text-slate-500"> 
                 <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {t("communities.members_other", { count: community.member_count || 0 })}</span> 
                 <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> {posts.length} {t("communities.posts")}</span> 
               </div> 
             </div> 
             <div className="flex items-center gap-2 shrink-0 mt-1"> 
               {isAdmin && <AdminPanel community={community} posts={posts} members={members} />} 
               {currentUser && !isAdmin && ( 
                 <Button 
                   onClick={() => joinMutation.mutate()} 
                   variant={isMember ? "secondary" : "default"} 
                   className={`rounded-xl ${!isMember ? "bg-indigo-600 hover:bg-indigo-700" : ""}`} 
                 > 
                   {isMember ? <><UserCheck className="w-4 h-4 mr-1.5" /> {t("communities.joined")}</> : <><UserPlus className="w-4 h-4 mr-1.5" /> {t("communities.join")}</>} 
                 </Button> 
               )} 
             </div> 
           </div> 
         </div> 
       </div> 

       {/* Create Post CTA */} 
       {isMember && ( 
         <Link to={`/CreatePost?community_id=${communityId}`}> 
           <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3 mb-5 hover:border-indigo-300 transition-colors cursor-pointer shadow-sm"> 
             <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shrink-0"> 
               {currentUser?.display_name?.[0]?.toUpperCase() || "U"} 
             </div> 
             <span className="text-sm text-slate-400 flex-1">{t("communities.shareWithCommunity")}</span> 
             <PenSquare className="w-4 h-4 text-indigo-400" /> 
           </div> 
         </Link> 
       )} 

       {/* Tabs */} 
       <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4"> 
         <TabsList className="bg-white border border-slate-100 w-full rounded-xl"> 
           <TabsTrigger value="posts" className="flex-1 rounded-lg">{t("communities.posts")}</TabsTrigger> 
           <TabsTrigger value="members" className="flex-1 rounded-lg">{t("communities.membersTab")}</TabsTrigger> 
           <TabsTrigger value="about" className="flex-1 rounded-lg">{t("communities.about")}</TabsTrigger> 
         </TabsList> 
       </Tabs> 

       {activeTab === "posts" && ( 
         <div className="space-y-4"> 
           {/* Pinned Posts */} 
           {pinnedPosts.map(p => <PinnedPost key={p._id} post={p} />)} 

           {/* Regular Posts */} 
           <div className="space-y-4"> 
             {postsLoading 
               ? Array(3).fill(0).map((_, i) => <PostSkeleton key={i} />) 
               : regularPosts.length === 0 && pinnedPosts.length === 0 
               ? ( 
                 <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200"> 
                   <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" /> 
                   <p className="text-sm text-slate-400">{t("communities.noPosts")}</p> 
                   {isMember && ( 
                     <Link to={`/CreatePost?community_id=${communityId}`}> 
                       <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl" size="sm">{t("communities.beFirstToPost")}</Button> 
                     </Link> 
                   )} 
                 </div> 
               ) 
               : regularPosts.map(p => <PostCard key={p._id} post={p} currentUser={currentUser} />)} 
           </div> 
         </div> 
       )} 

       {activeTab === "members" && ( 
         <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden shadow-sm"> 
           {members.length === 0 ? ( 
             <div className="text-center py-12 text-slate-400">{t("communities.noMembers")}</div> 
           ) : ( 
             members.map(m => ( 
               <div key={m._id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"> 
                 <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shrink-0"> 
                   {m.member_email?.[0]?.toUpperCase()} 
                 </div> 
                 <div className="flex-1 min-w-0"> 
                   <p className="text-sm font-medium text-slate-800 truncate">@{m.member_email?.split('@')[0]}</p> 
                   <p className="text-xs text-slate-400">{t("communities.joinedOn", { date: new Date(m.created_at).toLocaleDateString() })}</p> 
                 </div> 
                 <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${m.role === "admin" ? "bg-indigo-100 text-indigo-700" : m.role === "moderator" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}> 
                   {m.role} 
                 </span> 
               </div> 
             )) 
           )} 
         </div> 
       )} 

       {activeTab === "about" && ( 
         <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4 shadow-sm"> 
           <div> 
             <h3 className="font-bold text-slate-900 mb-1">{t("communities.aboutThisCommunity")}</h3> 
             <p className="text-sm text-slate-600 leading-relaxed">{community.description || t("communities.noDescription")}</p> 
           </div> 
           {community.rules && ( 
             <div> 
               <h3 className="font-bold text-slate-900 mb-1">{t("communities.communityRules")}</h3> 
               <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{community.rules}</p> 
             </div> 
           )} 
           <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500"> 
             <span><strong className="text-slate-900">{community.member_count || 0}</strong> {t("communities.membersTab")}</span> 
             <span><strong className="text-slate-900">{posts.length}</strong> {t("communities.posts")}</span> 
             <span>{t("communities.created", { date: new Date(community.created_at).toLocaleDateString() })}</span> 
           </div> 
         </div> 
       )} 
     </div> 
   ); 
 }