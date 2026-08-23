import React, { useState } from "react"; 
 import { useTranslation } from "react-i18next";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; 
 import { Link } from "react-router-dom"; 
 import { communitiesAPI, communityMembersAPI } from "@/api/apiClient"; 
 import { Users, Plus, Search, TrendingUp, Loader2 } from "lucide-react"; 
 import { Input } from "@/components/ui/input"; 
 import { Button } from "@/components/ui/button"; 
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; 
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; 
 import { Textarea } from "@/components/ui/textarea"; 
 import { toast } from "sonner"; 
 import { motion } from "framer-motion"; 
 import { useAuth } from "@/lib/AuthContext"; 
 
 const COMMUNITY_CATEGORIES = [ 
   { id: "fashion", label: "Fashion", emoji: "👗" }, 
   { id: "tech", label: "Tech", emoji: "💻" }, 
   { id: "fitness", label: "Fitness", emoji: "💪" }, 
   { id: "food", label: "Food", emoji: "🍕" }, 
   { id: "art", label: "Art", emoji: "🎨" }, 
   { id: "music", label: "Music", emoji: "🎵" }, 
   { id: "gaming", label: "Gaming", emoji: "🎮" }, 
   { id: "travel", label: "Travel", emoji: "✈️" }, 
   { id: "diy", label: "DIY", emoji: "🛠️" }, 
 ]; 
 
 export default function Communities() { 
   const { t } = useTranslation();
   const [search, setSearch] = useState(""); 
   const [createOpen, setCreateOpen] = useState(false); 
   const [newCommunity, setNewCommunity] = useState({ name: "", description: "", category: "tech" }); 
   const queryClient = useQueryClient(); 
   const { user: currentUser } = useAuth(); 

   const { data: myMemberships = [] } = useQuery({
     queryKey: ["myCommunityMemberships", currentUser?.email],
     queryFn: async () => {
       if (!currentUser?.email) return [];
       const res = await communityMembersAPI.list({ member_username: currentUser.username, limit: 100 });
       return res.members || [];
     },
     enabled: !!currentUser?.email,
   });
 
  const { data: communitiesData, isLoading } = useQuery({ 
    queryKey: ["communities"], 
    queryFn: async () => {
      const res = await communitiesAPI.list({ limit: 50 });
      // The API returns { communities: [...], pagination: {...} }
      return res.communities || res.data || res || [];
    },
  }); 

  const communities = Array.isArray(communitiesData) ? communitiesData : (communitiesData?.communities || []);
 
   const joinedIds = new Set(myMemberships.map(m => m.community_id)); 
 
   const createMutation = useMutation({ 
     mutationFn: async () => { 
       await communitiesAPI.create({ 
         ...newCommunity, 
         }); 
     }, 
     onSuccess: () => { 
       toast.success(t("communities.communityCreated")); 
       setCreateOpen(false); 
       setNewCommunity({ name: "", description: "", category: "tech" }); 
       queryClient.invalidateQueries({ queryKey: ["communities"] }); 
     }, 
   }); 
 
   const filtered = search 
     ? communities.filter(c => c.name?.toLowerCase().includes(search.toLowerCase())) 
     : communities; 
 
   const myCommunities = communities.filter(c => joinedIds.has(c._id || c.id) || c.owner_username === currentUser?.username); 
   const discoverCommunities = filtered.filter(c => !joinedIds.has(c._id || c.id) && c.owner_username !== currentUser?.username); 
 
   return ( 
     <div className="max-w-4xl mx-auto px-4 py-6"> 
       <div className="flex items-center justify-between mb-6"> 
         <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("communities.title")}</h1> 
         <Dialog open={createOpen} onOpenChange={setCreateOpen}> 
           <DialogTrigger asChild> 
             <Button className="bg-orange-600 hover:bg-orange-700 rounded-xl"> 
               <Plus className="w-4 h-4 mr-1.5" /> {t("communities.create")}
             </Button> 
           </DialogTrigger> 
           <DialogContent className="rounded-2xl"> 
             <DialogHeader> 
               <DialogTitle>{t("communities.createCommunity")}</DialogTitle> 
             </DialogHeader> 
             <div className="space-y-4 pt-4"> 
               <div className="space-y-2">
                 <label className="text-sm font-medium">{t("common.required")}</label>
                 <Input 
                   placeholder={t("communities.namePlaceholder")} 
                   value={newCommunity.name} 
                   onChange={(e) => setNewCommunity(p => ({ ...p, name: e.target.value }))} 
                   className="rounded-xl"
                 /> 
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium">{t("product.description")}</label>
                 <Textarea 
                   placeholder={t("communities.descriptionPlaceholder")} 
                   value={newCommunity.description} 
                   onChange={(e) => setNewCommunity(p => ({ ...p, description: e.target.value }))} 
                   className="rounded-xl min-h-[100px]"
                 /> 
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium">{t("communities.category")}</label>
                 <Select value={newCommunity.category} onValueChange={(v) => setNewCommunity(p => ({ ...p, category: v }))}> 
                   <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("communities.category")} /></SelectTrigger> 
                   <SelectContent className="rounded-xl"> 
                     {COMMUNITY_CATEGORIES.map(c => ( 
                       <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem> 
                     ))} 
                   </SelectContent> 
                 </Select> 
               </div>
               <Button 
                 onClick={() => createMutation.mutate()} 
                 disabled={!newCommunity.name.trim() || createMutation.isPending} 
                 className="w-full bg-orange-600 hover:bg-orange-700 rounded-xl py-6 text-base font-bold shadow-lg shadow-orange-100" 
               > 
                 {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} 
                 {t("communities.createCommunity")}
               </Button> 
             </div> 
           </DialogContent> 
         </Dialog> 
       </div> 
 
       <div className="relative mb-8"> 
         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /> 
         <Input 
           placeholder={t("communities.searchCommunities")} 
           value={search} 
           onChange={(e) => setSearch(e.target.value)} 
           className="pl-9 h-12 rounded-xl shadow-sm border-slate-200 dark:border-slate-700" 
         /> 
       </div> 
 
       {/* My Communities */} 
       {myCommunities.length > 0 && ( 
         <div className="mb-10"> 
           <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
             <Users className="w-5 h-5 text-orange-500" /> {t("communities.myCommunities")}
           </h2> 
           <div className="grid sm:grid-cols-2 gap-4"> 
             {myCommunities.map((c) => ( 
               <CommunityCard key={c._id || c.id} community={c} joined /> 
             ))} 
           </div> 
         </div> 
       )} 
 
       {/* Discover */} 
       <div> 
         <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"> 
           <TrendingUp className="w-5 h-5 text-green-500" /> {t("communities.discover")}
         </h2> 
         {isLoading ? (
           <div className="grid sm:grid-cols-2 gap-4">
             {[1, 2, 3, 4].map(i => (
               <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl"></div>
             ))}
           </div>
         ) : discoverCommunities.length === 0 ? ( 
           <div className="text-center py-16 bg-white dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700"> 
             <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
             <p className="text-slate-500 dark:text-slate-400 font-medium">{t("communities.noDiscover")}</p> 
           </div> 
         ) : ( 
           <div className="grid sm:grid-cols-2 gap-4"> 
             {discoverCommunities.map((c) => ( 
               <CommunityCard key={c._id || c.id} community={c} /> 
             ))} 
           </div> 
         )} 
       </div> 
     </div> 
   ); 
 } 
 
 function CommunityCard({ community, joined = false }) { 
   const { t } = useTranslation();
   const catEmoji = COMMUNITY_CATEGORIES.find(c => c.id === community.category)?.emoji || "👥"; 
 
   return ( 
     <Link to={`/CommunityDetail?id=${community._id}`}> 
       <motion.div 
         whileHover={{ y: -4 }} 
         className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all h-full shadow-sm" 
       > 
         <div className="h-28 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 relative"> 
           {community.cover_image && <img src={community.cover_image} alt="" className="w-full h-full object-cover" />} 
           {joined && ( 
             <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-wider text-orange-600 shadow-sm"> 
               {t("communities.joined")}
             </div> 
           )} 
         </div> 
         <div className="p-5 -mt-6 relative"> 
           <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 shadow-md border border-slate-100 dark:border-slate-600 flex items-center justify-center text-xl mb-3"> 
             {catEmoji} 
           </div> 
           <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{community.name}</h3> 
           <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">{community.description}</p> 
           <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50 dark:border-slate-700 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight"> 
             <span className="flex items-center gap-1">
               <Users className="w-3.5 h-3.5" /> 
               {t("communities.members_other", { count: community.member_count || 0 })}
             </span>
           </div> 
         </div> 
       </motion.div> 
     </Link> 
   ); 
 } 
