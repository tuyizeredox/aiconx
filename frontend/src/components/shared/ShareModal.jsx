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
import { Search, Send, Check, Copy, User, Store, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usersAPI, storesAPI, messagesAPI, postsAPI } from "@/api/apiClient";
import { toast } from "sonner";
import { createPageUrl, formatCurrency } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function ShareModal({ isOpen, onOpenChange, post, product, currentUser }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [copied, setCopied] = useState(false);

  const isProduct = !!product;
  const item = product || post;
  const itemId = item?.id || item?._id;
  const itemUrl = window.location.origin + createPageUrl(isProduct ? "ProductDetail" : "PostDetail") + `?id=${itemId}`;

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["searchUsers", searchQuery],
    queryFn: () => usersAPI.search(searchQuery),
    enabled: searchQuery.length > 2,
  });

  const { data: storesData, isLoading: storesLoading } = useQuery({
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
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isProduct ? t("product.shareProduct") : t("share.sharePost")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {item && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
                <img 
                  src={(isProduct ? product.images?.[0] : post.media_urls?.[0]) || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100"} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{isProduct ? product.title : post.content?.slice(0, 50)}</p>
                {isProduct && <p className="text-xs font-bold text-indigo-600">{formatCurrency(product.price)}</p>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex-1 px-3 text-sm text-slate-500 truncate">
              {itemUrl}
            </div>
            <Button 
              size="sm" 
              onClick={handleCopyLink}
              className="rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 h-9 px-4 shadow-sm transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              <span className="ml-2">{copied ? t("common.copied") : t("common.copy")}</span>
            </Button>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("share.searchUsersOrVendors")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
              />
            </div>

            <ScrollArea className="h-64 pr-4">
              {searchQuery.length > 0 && searchQuery.length <= 2 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {t("share.typeToSearch")}
                </div>
              )}
              
              {searchQuery.length > 2 && recipients.length === 0 && !usersLoading && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {t("share.noResults")}
                </div>
              )}

              <div className="space-y-2">
                {recipients.map((recipient) => (
                  <button
                    key={recipient.id || recipient._id || recipient.email}
                    onClick={() => setSelectedRecipient(recipient)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                      selectedRecipient?.id === recipient.id 
                        ? "bg-indigo-50 ring-1 ring-indigo-200" 
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                      {recipient.avatar_url || recipient.logo_url ? (
                        <img 
                          src={recipient.avatar_url || recipient.logo_url} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : recipient.type === 'vendor' ? (
                        <Store className="w-5 h-5 text-indigo-500" />
                      ) : (
                        <User className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {recipient.display_name || recipient.name || recipient.full_name || t("share.unknownUser")}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {recipient.type === 'vendor' ? (recipient.category || t("share.vendor")) : `@${recipient.username || recipient.display_name?.replace(/\s+/g, '_').toLowerCase()}`}
                      </p>
                    </div>
                    {selectedRecipient?.id === recipient.id && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Button
            disabled={!selectedRecipient || sendMutation.isPending}
            onClick={() => sendMutation.mutate(selectedRecipient)}
            className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
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
