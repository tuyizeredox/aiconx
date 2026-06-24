import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2, Copy, DollarSign, MousePointerClick, ShoppingCart,
  Plus, Loader2, Check, Search, Package, Zap, Trophy,
  ChevronDown, ChevronUp, Instagram, Mail, MessageSquare,
  Twitter, Ruler, Medal, Crown, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { affiliateLinksAPI, productsAPI, vendorSubscriptionsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "react-i18next";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

const RANK_MEDAL = {
  1: { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-700", icon: Crown },
  2: { bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200 dark:border-slate-600", icon: Medal },
  3: { bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-700", icon: Medal },
};

const MARKETING_ASSETS = [
  {
    id: 1,
    title: "Instagram Caption Pack",
    type: "Caption",
    icon: Instagram,
    gradient: "from-pink-500 to-purple-600",
    description: "Ready-to-post captions that convert followers into buyers.",
    content: `✨ Found something AMAZING on Aicon X and I genuinely can't stop shopping 🛍️

Quality products, great prices — and you can grab yours through my link:
👉 {YOUR_LINK}

Trust me, you need to check this out 🔥

#AiconX #ShopSmart #AffiliateLink #MustHave #ShoppingFinds`,
  },
  {
    id: 2,
    title: "TikTok / Reel Script",
    type: "Script",
    icon: Star,
    gradient: "from-slate-800 to-slate-900",
    description: "Short-form video script hooks optimised for engagement.",
    content: `[Hook — 0–3s]
"POV: You discovered the best deals on Aicon X 🤩"

[Hold up product / screen record]
"I've been obsessed with this store lately and honestly?
Every order has been 10/10."

[CTA — last 5s]
"Link in bio → tap to shop. You'll thank me later."

#AiconX #TikTokMadeMeBuyIt #ShopWithMe`,
  },
  {
    id: 3,
    title: "WhatsApp / DM Template",
    type: "Message",
    icon: MessageSquare,
    gradient: "from-green-500 to-emerald-600",
    description: "Personal outreach message — feels natural, not spammy.",
    content: `Hey! 👋

I've been shopping on this platform called Aicon X and honestly the deals are crazy good. Thought you'd love it.

Here's my personal link — it gives me a small commission at no extra cost to you 🙏
👉 {YOUR_LINK}

Let me know what you end up getting! 😄`,
  },
  {
    id: 4,
    title: "Email Newsletter Block",
    type: "Email",
    icon: Mail,
    gradient: "from-orange-500 to-orange-600",
    description: "Drop this block into your email newsletter for instant affiliate revenue.",
    content: `Subject: 🛍️ Something I've been loving lately

Hi [First Name],

I don't do this often, but I had to share this with you.

I've been shopping on a platform called Aicon X — and the product quality + prices are genuinely impressive.

→ Browse what I'm loving here: {YOUR_LINK}

(Using my link supports me at no extra cost to you — thank you! 💛)

Happy shopping,
[Your Name]`,
  },
  {
    id: 5,
    title: "Twitter / X Thread Starter",
    type: "Tweet",
    icon: Twitter,
    gradient: "from-sky-400 to-blue-600",
    description: "Engagement-driving thread opener that seeds your affiliate link naturally.",
    content: `Thread: 5 things I bought on Aicon X that genuinely changed my routine 🧵👇

1/ [Product] — Was sceptical. Now I use it every day.

2/ [Product] — The quality for the price is wild.

3/ [Product] — Sold out twice while I debated buying it.

4/ [Product] — Bought as a gift, kept it for myself.

5/ [Product] — This one speaks for itself.

All via my link if you want to grab any: {YOUR_LINK}`,
  },
  {
    id: 6,
    title: "Platform Size Guide",
    type: "Guide",
    icon: Ruler,
    gradient: "from-amber-400 to-orange-500",
    description: "Optimal image dimensions for every social platform.",
    content: `📐 Social Media Image Size Cheat Sheet

• Instagram Post .............. 1080 × 1080 px
• Instagram Story / Reel ...... 1080 × 1920 px
• Facebook Feed Post .......... 1200 × 630 px
• Twitter / X Post ............ 1600 × 900 px
• TikTok Cover ................ 1080 × 1920 px
• Pinterest Pin ............... 1000 × 1500 px
• YouTube Thumbnail ........... 1280 × 720 px
• LinkedIn Post ............... 1200 × 627 px

💡 Tip: Use Canva (free) to create on-brand visuals in seconds.
      Replace {YOUR_LINK} with your Aicon X affiliate link in every post!`,
  },
];

function LeaderboardItem({ rank, name, avatar_url, total_earned, total_sales, isMe }) {
  const { t } = useTranslation();
  const medal = RANK_MEDAL[rank];
  const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "??";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={`flex items-center gap-4 p-3.5 rounded-2xl border mb-2 transition-all ${
        isMe
          ? "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 shadow-sm shadow-orange-100"
          : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600"
      }`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm border-2 shrink-0 ${
        medal ? `${medal.bg} ${medal.text} ${medal.border}` : "bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600"
      }`}>
        {rank}
      </div>
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm">
        {avatar_url ? (
          <img src={avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
          {name}
          {isMe && <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 rounded-full">{t("affiliate.youBadge")}</span>}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{total_sales} {t(`affiliate.saleSuffix_${total_sales === 1 ? "one" : "other"}`)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-black ${isMe ? "text-orange-700 dark:text-orange-400" : "text-orange-600"}`}>{formatCurrency(total_earned)}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("affiliate.earnedLabel")}</p>
      </div>
    </motion.div>
  );
}

function AssetCard({ asset, affiliateUrl }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const Icon = asset.icon;

  const resolvedContent = affiliateUrl
    ? asset.content.replace(/\{YOUR_LINK\}/g, affiliateUrl)
    : asset.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(resolvedContent);
    setCopied(true);
    toast.success(t("affiliate.assetCopied", { title: asset.title }));
    setTimeout(() => setCopied(false), 2000);
  };

  const renderPreview = () => {
    if (!affiliateUrl) {
      return <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-4 whitespace-pre-wrap font-sans leading-relaxed mb-3 max-h-64 overflow-y-auto">{resolvedContent}</pre>;
    }
    const parts = asset.content.split(/(\{YOUR_LINK\})/g);
    return (
      <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-4 whitespace-pre-wrap font-sans leading-relaxed mb-3 max-h-64 overflow-y-auto">
        {parts.map((part, i) =>
          part === "{YOUR_LINK}" ? (
            <span key={i} className="text-orange-600 dark:text-indigo-400 font-semibold break-all">{affiliateUrl}</span>
          ) : (
            part
          )
        )}
      </pre>
    );
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden transition-all duration-300 ${expanded ? "shadow-lg" : "hover:shadow-md"}`}>
      <div className={`bg-gradient-to-br ${asset.gradient} p-5 flex items-start justify-between`}>
        <div>
          <div className={`w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold mb-2">{asset.type}</Badge>
          <p className="text-white font-black text-sm leading-tight">{asset.title}</p>
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">{asset.description}</p>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {renderPreview()}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded(v => !v)}
            className="flex-1 rounded-xl h-8 text-xs gap-1 border-slate-200 dark:border-slate-600"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? t("affiliate.hide") : t("affiliate.previewBtn")}
          </Button>
          <Button
            size="sm"
            onClick={handleCopy}
            className={`flex-1 rounded-xl h-8 text-xs gap-1 transition-all ${copied ? "bg-green-600 hover:bg-green-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t("affiliate.copiedBtn") : t("affiliate.copyBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}


function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ConversionBar({ clicks, conversions }) {
  const { t } = useTranslation();
  const pct = clicks ? Math.min(100, (conversions / clicks) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
        <span>{t("affiliate.conversionRate")}</span>
        <span className="font-semibold text-orange-600">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Affiliate() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [pendingProductId, setPendingProductId] = useState(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState("month");
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { subscriptionMode } = usePlatformSettings();

  const { data: subscription } = useQuery({
    queryKey: ["vendorSubscription", currentUser?.username],
    queryFn: async () => {
      const res = await vendorSubscriptionsAPI.list({ vendor_username: currentUser?.username });
      const subs = res.subscriptions || res.data || (Array.isArray(res) ? res : []);
      return subs.find(s => s.status === 'active') || null;
    },
    enabled: !!currentUser?.username && subscriptionMode,
  });

  const isEliteVendor = !subscriptionMode || subscription?.plan === "elite";

  const { data: myData, isLoading } = useQuery({
    queryKey: ["affiliateLinks", currentUser?.username],
    queryFn: async () => {
      return await affiliateLinksAPI.listForMe({ sort: "-created_at", limit: 50 });
    },
    enabled: !!currentUser?.username,
  });

  const myLinks = myData?.links || [];
  const stats = myData?.stats || {
    total_clicks: 0,
    total_conversions: 0,
    total_earned: 0,
    total_paid: 0
  };

  const { data: products = [], isPending: productsLoading } = useQuery({
    queryKey: ["affiliateProducts", search, subscriptionMode],
    queryFn: async () => {
      const params = {
        status: "active",
        search: search || undefined,
        sort: "-sales_count",
        limit: 50,
      };
      if (subscriptionMode) {
        params.vendor_plan = "elite";
      }
      const res = await productsAPI.list(params);
      return res.data || [];
    },
    staleTime: 60000,
  });

  const filteredProducts = (search ? products : products.slice(0, 12))
    .filter(p => p.vendor_username !== currentUser?.username);

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["affiliateLeaderboard", leaderboardPeriod],
    queryFn: () => affiliateLinksAPI.getLeaderboard({ period: leaderboardPeriod, limit: 10, username: currentUser?.username }),
    staleTime: 60000,
  });

  const createLinkMutation = useMutation({
    mutationFn: async (product) => {
      const productId = product._id || product.id;
      setPendingProductId(productId);
      return affiliateLinksAPI.create({
        product_id: productId,
        commission_pct: product.affiliate_commission_pct || 10,
        status: "active",
      });
    },
    onSuccess: () => {
      toast.success(t("affiliate.linkCreated"));
      setCreating(false);
      setSelectedProduct(null);
      queryClient.invalidateQueries({ queryKey: ["affiliateLinks"] });
    },
    onError: (error) => {
      const msg = error?.message || t("affiliate.linkCreateFailed") || "Failed to create affiliate link";
      toast.error(msg);
    },
    onSettled: () => {
      setPendingProductId(null);
    }
  });

  const copyLink = (refCode) => {
    const url = `${window.location.origin}/Marketplace?ref=${refCode}`;
    navigator.clipboard.writeText(url);
    toast.success(t("affiliate.linkCopiedToast"));
  };

  // Totals from backend stats
  const totalClicks = stats.total_clicks || 0;
  const totalConversions = stats.total_conversions || 0;
  const totalEarned = stats.total_earned || 0;
  const pendingPayout = (stats.total_earned || 0) - (stats.total_paid || 0);

  const alreadyLinked = (productId) => myLinks.some(l => l.product_id === productId);

  const activeLink = myLinks.find(l => l.status === "active");
  const affiliateUrl = activeLink
    ? `${window.location.origin}/Marketplace?ref=${activeLink.ref_code}`
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-6 lg:p-8 mb-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200')] bg-cover" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-300" />
            <span className="text-sm font-semibold text-white/80">{t("affiliate.programBadge")}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black mb-2">{t("affiliate.heroTitle")}</h1>
          <p className="text-white/80 text-sm max-w-lg">{t("affiliate.heroDesc")}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Link2} label={t("affiliate.activeLinks")} value={myLinks.filter(l => l.status === "active").length} color="bg-indigo-50 text-orange-600" />
        <StatCard icon={MousePointerClick} label={t("affiliate.totalClicks")} value={totalClicks.toLocaleString()} color="bg-blue-50 text-blue-600" />
        <StatCard icon={ShoppingCart} label={t("affiliate.conversions")} value={totalConversions} sub={totalClicks ? `${((totalConversions/totalClicks)*100).toFixed(1)}% ${t("affiliate.rateSuffix")}` : ""} color="bg-green-50 text-green-600" />
        <StatCard icon={DollarSign} label={t("affiliate.pendingPayout")} value={formatCurrency(pendingPayout)} sub={t("affiliate.totalEarnedSub", { amount: formatCurrency(totalEarned) })} color="bg-amber-50 text-amber-600" />
      </div>

      <Tabs defaultValue="links" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6 w-full lg:w-auto overflow-x-auto justify-start lg:justify-center">
          <TabsTrigger value="links" className="rounded-xl px-6 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">{t("affiliate.links")}</TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-xl px-6 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">{t("affiliate.leaderboard")}</TabsTrigger>
          <TabsTrigger value="assets" className="rounded-xl px-6 py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">{t("affiliate.marketingAssets")}</TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="mt-0">
          <div className="grid lg:grid-cols-5 gap-6">
            {/* My Links */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("affiliate.myLinks")}</h2>
                <Button onClick={() => setCreating(v => !v)} size="sm" className={`rounded-xl gap-1.5 ${creating ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                  <Plus className="w-4 h-4" /> {t("affiliate.newLink")}
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : myLinks.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  <Link2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t("affiliate.noLinks")}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("affiliate.pickProduct")}</p>
                </div>
              ) : (
                myLinks.map(link => {
                  const linkId = link._id || link.id;
                  return (
                    <motion.div key={linkId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{link.product_title}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{link.store_name} · {formatCurrency(link.product_price)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-[10px] border-0 capitalize ${link.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                            {link.status}
                          </Badge>
                          <span className="text-xs font-bold text-orange-600">{link.commission_pct}% comm.</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl py-2">
                          <p className="text-lg font-black text-slate-900 dark:text-white">{link.clicks || 0}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("affiliate.clicks")}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl py-2">
                          <p className="text-lg font-black text-slate-900 dark:text-white">{link.conversions || 0}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("affiliate.sales")}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950 rounded-xl py-2">
                          <p className="text-lg font-black text-green-700 dark:text-green-400">{formatCurrency(link.total_commission_earned || 0)}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("affiliate.earned")}</p>
                        </div>
                      </div>

                      <ConversionBar clicks={link.clicks} conversions={link.conversions} />

                      <div className="flex gap-2 mt-3">
                        <div className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                          {window.location.origin}/Marketplace?ref={link.ref_code}
                        </div>
                        <button
                          onClick={() => copyLink(link.ref_code)}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Product Picker */}
            <div className="lg:col-span-2">
              {!isEliteVendor && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 rounded-2xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-400">{t("affiliate.listYourProducts")}</p>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed mb-3">
                    {t("affiliate.eliteOnlyDesc")}
                  </p>
                  <Link to={createPageUrl("MyStore") + "?tab=subscription"}>
                    <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] h-8">
                      {t("affiliate.upgradeToElite")}
                    </Button>
                  </Link>
                </div>
              )}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 sticky top-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-500" /> {t("affiliate.chooseProduct")}
                </h3>
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t("affiliate.searchProducts")}
                    className="pl-8 h-8 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-2 max-h-[520px] overflow-y-auto">
                  {productsLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-400">{t("affiliate.noProductsFound")}</div>
                  ) : (
                    filteredProducts.map(product => {
                      const productId = product._id || product.id;
                      const linked = alreadyLinked(productId);
                      return (
                        <button
                          key={productId}
                          onClick={() => !linked && createLinkMutation.mutate(product)}
                          disabled={linked || createLinkMutation.isPending}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-colors border ${
                            linked ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 cursor-default" : "hover:bg-indigo-50 dark:hover:bg-indigo-950 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800"
                          }`}
                        >
                          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
                            {product.images?.[0] && <img src={product.images[0]} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">{product.title}</p>
                            <p className="text-xs text-orange-600 font-bold">{formatCurrency(product.price)}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("affiliate.commissionLabel", { pct: product.affiliate_commission_pct || 10 })}</p>
                          </div>
                          {pendingProductId === productId ? (
                            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                          ) : linked ? (
                            <Check className="w-4 h-4 text-green-500 shrink-0" />
                          ) : (
                            <Plus className="w-4 h-4 text-indigo-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("affiliate.leaderboardTitle")}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t("affiliate.leaderboardSubtitle")}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl self-start sm:self-auto">
                {[
                  { value: "week", label: t("affiliate.thisWeek") },
                  { value: "month", label: t("affiliate.thisMonth") },
                  { value: "all", label: t("affiliate.allTime") },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLeaderboardPeriod(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      leaderboardPeriod === opt.value
                        ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-w-2xl">
              {leaderboardLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                </div>
              ) : !leaderboardData?.leaderboard?.length ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  <Trophy className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t("affiliate.noDataYet")}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("affiliate.noDataDesc")}</p>
                </div>
              ) : (
                <>
                  {leaderboardData.leaderboard.map(item => (
                    <LeaderboardItem
                      key={item.username}
                      {...item}
                      isMe={item.username === currentUser?.username}
                    />
                  ))}

                  {leaderboardData.my_rank !== null && leaderboardData.my_rank !== undefined && (
                    <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-950 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs shrink-0">
                          {t("affiliate.youBadge")}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">{t("affiliate.yourRank")}</p>
                          <p className="text-xs text-indigo-500 dark:text-indigo-400">{t("affiliate.keepSharing")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">#{leaderboardData.my_rank}</p>
                      </div>
                    </div>
                  )}

                  {leaderboardData.my_rank === null && currentUser && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-black text-xs shrink-0">
                          {t("affiliate.youBadge")}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{t("affiliate.notRanked")}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{t("affiliate.notRankedDesc")}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="assets">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("affiliate.marketingAssets")}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("affiliate.assetsSubtitle")}</p>
              </div>
              <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs font-bold shrink-0 mt-1">
                {t("affiliate.templatesCount", { count: MARKETING_ASSETS.length })}
              </Badge>
            </div>
            {affiliateUrl ? (
              <div className="bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 rounded-2xl px-4 py-3 flex items-start gap-3">
                <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-green-800 dark:text-green-400 font-semibold mb-0.5">Your link is auto-filled in every template</p>
                  <p className="text-[11px] text-green-700 dark:text-green-500 font-mono truncate">{affiliateUrl}</p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                  Create an affiliate link in the <strong>Links</strong> tab first — it will be auto-filled here.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MARKETING_ASSETS.map(asset => (
                <AssetCard key={asset.id} asset={asset} affiliateUrl={affiliateUrl} />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
