import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Check, Copy, User, Store, Loader2, Link2, Mail } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usersAPI, storesAPI, messagesAPI, postsAPI } from "@/api/apiClient";
import { toast } from "sonner";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const ExternalPlatforms = ({ url, title }) => {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title || "");

  const platforms = [
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      bg: "bg-[#25D366]",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
    },
    {
      name: "Telegram",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      bg: "bg-[#26A5E4]",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
    },
    {
      name: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      bg: "bg-black",
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.258 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
        </svg>
      ),
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      bg: "bg-[#1877F2]",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
    },
    {
      name: "Email",
      href: `mailto:?subject=${encodedTitle}&body=${encodedTitle}%0A${encodedUrl}`,
      bg: "bg-slate-600",
      icon: <Mail className="w-4 h-4 text-white" />,
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {platforms.map((p) => (
        <a
          key={p.name}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer"
          title={p.name}
          className={`${p.bg} flex flex-col items-center gap-1.5 p-2.5 rounded-2xl hover:opacity-85 active:scale-95 transition-all duration-150 group`}
        >
          {p.icon}
          <span className="text-[10px] font-semibold text-white/90 leading-none hidden sm:block">
            {p.name.split(" ")[0]}
          </span>
        </a>
      ))}
    </div>
  );
};

export default function ShareModal({ isOpen, onOpenChange, post, product, currentUser, contentClassName = "" }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [copied, setCopied] = useState(false);

  const isProduct = !!product;
  const item = product || post;
  const itemId = item?.id || item?._id;
  const itemTitle = isProduct ? product?.title : (post?.content?.slice(0, 80) || "Check this out");
  const itemUrl = window.location.origin + createPageUrl(isProduct ? "ProductDetail" : "PostDetail") + `?id=${itemId}`;
  const itemImage = isProduct ? product?.images?.[0] : post?.media_urls?.[0];

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["searchUsers", searchQuery],
    queryFn: () => usersAPI.search(searchQuery),
    enabled: searchQuery.length > 2,
  });

  const { data: storesData } = useQuery({
    queryKey: ["searchStores", searchQuery],
    queryFn: () => storesAPI.list({ search: searchQuery }),
    enabled: searchQuery.length > 2,
  });

  const sendMutation = useMutation({
    mutationFn: async (recipient) => {
      const recipientUsername = recipient.username || recipient.owner_username || recipient.display_name?.replace(/\s+/g, '_').toLowerCase();
      if (!recipientUsername) throw new Error("Recipient username not found");

      if (!isProduct) {
        await postsAPI.share(itemId).catch(console.error);
      }

      return messagesAPI.send({
        recipient_username: recipientUsername,
        content: `Check out this ${isProduct ? "product" : "post"}: ${itemUrl}`,
        message_type: isProduct ? "product_share" : "text",
        product_id: isProduct ? itemId : undefined,
        product_data: isProduct ? {
          title: product.title,
          price: product.price,
          image: product.images?.[0]
        } : undefined
      });
    },
    onSuccess: () => {
      toast.success(isProduct ? t("share.productSharedSuccess") : t("share.postSharedSuccess"));
      onOpenChange(false);
      setSelectedRecipient(null);
      setSearchQuery("");
    },
    onError: (error) => {
      toast.error(error.message || t("share.failedToShare"));
    },
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(itemUrl);
      setCopied(true);
      toast.success(t("product.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
      
      if (!isProduct) {
        postsAPI.share(itemId).catch(console.error);
      }
    } catch (err) {
      toast.error(t("product.failedToCopyLink"));
    }
  };

  const recipients = [
    ...(usersData?.data || usersData || []).filter(u => !currentUser?.username || u.username !== currentUser?.username).map(u => ({ ...u, type: 'user' })),
    ...(storesData?.data || storesData || []).map(s => ({ ...s, type: 'vendor' }))
  ].slice(0, 10);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[calc(100vw-2rem)] max-w-md sm:max-w-lg rounded-2xl sm:rounded-3xl p-0 gap-0 overflow-hidden border-0 shadow-2xl ${contentClassName}`}>
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {isProduct ? t("product.shareProduct") : t("share.sharePost")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 pt-4 space-y-4 overflow-y-auto max-h-[85vh]">
          {/* Item Preview */}
          {item && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 shadow-sm">
                {itemImage ? (
                  <img src={itemImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                  {itemTitle}
                </p>
                {isProduct && (
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                    {formatCurrency(product.price)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Copy Link */}
          <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            <div className="flex-1 px-2.5 py-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate font-mono">
              {itemUrl}
            </div>
            <Button 
              size="sm" 
              onClick={handleCopyLink}
              className={`rounded-xl shrink-0 h-9 px-3 sm:px-4 text-xs sm:text-sm font-semibold shadow-sm transition-all ${
                copied
                  ? "bg-green-500 hover:bg-green-600 text-white border-0"
                  : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-orange-600"
              }`}
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5 mr-1.5" />{t("common.copied")}</>
              ) : (
                <><Copy className="w-3.5 h-3.5 mr-1.5" />{t("common.copy")}</>
              )}
            </Button>
          </div>

          {/* External Share Platforms */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-0.5">
              Share via
            </p>
            <ExternalPlatforms url={itemUrl} title={itemTitle} />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700/60" />
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">or send in-app</span>
            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700/60" />
          </div>

          {/* Internal Search */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder={t("share.searchUsersOrVendors")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm"
              />
            </div>

            {(searchQuery.length > 0 || recipients.length > 0) && (
              <ScrollArea className="max-h-44 pr-1">
                {searchQuery.length > 0 && searchQuery.length <= 2 && (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    {t("share.typeToSearch")}
                  </div>
                )}
                {searchQuery.length > 2 && recipients.length === 0 && !usersLoading && (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    {t("share.noResults")}
                  </div>
                )}
                {usersLoading && searchQuery.length > 2 && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                )}
                <div className="space-y-1.5">
                  {recipients.map((recipient) => (
                    <button
                      key={recipient.id || recipient._id || recipient.email}
                      onClick={() => setSelectedRecipient(prev => prev?.id === recipient.id ? null : recipient)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                        selectedRecipient?.id === recipient.id
                          ? "bg-orange-50 dark:bg-orange-900/30 ring-1 ring-orange-200 dark:ring-orange-700"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {recipient.avatar_url || recipient.logo_url ? (
                          <img src={recipient.avatar_url || recipient.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : recipient.type === 'vendor' ? (
                          <Store className="w-4 h-4 text-orange-500" />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {recipient.display_name || recipient.name || recipient.full_name || t("share.unknownUser")}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {recipient.type === 'vendor'
                            ? (recipient.category || t("share.vendor"))
                            : `@${recipient.username || recipient.display_name?.replace(/\s+/g, '_').toLowerCase()}`}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        selectedRecipient?.id === recipient.id
                          ? "bg-orange-600 border-orange-600"
                          : "border-slate-200 dark:border-slate-600"
                      }`}>
                        {selectedRecipient?.id === recipient.id && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Send Button */}
          <Button
            disabled={!selectedRecipient || sendMutation.isPending}
            onClick={() => sendMutation.mutate(selectedRecipient)}
            className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-lg shadow-orange-100 dark:shadow-orange-950 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98] text-sm"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {t("share.shareAsMessage")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
