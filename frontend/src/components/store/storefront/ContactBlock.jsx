import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { MessageCircle, UserPlus, UserCheck, Phone, MapPin, Facebook, Instagram, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactBlock({
  block,
  store,
  currentUser,
  isFollowing,
  isFollowedBy,
  onFollowToggle,
  followPending,
}) {
  const { t } = useTranslation();
  const data = block?.data || {};
  const { title, show_social = true, show_address = true } = data;
  const social = store?.social_links || {};
  const isOwner = currentUser?.username === store?.owner_username;

  return (
    <div className="w-full">
      {title && (
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">{title}</h2>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 flex-wrap">
        {!isOwner && currentUser && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onFollowToggle}
              disabled={followPending}
              className="rounded-xl gap-2 font-semibold"
              style={{ backgroundColor: isFollowing ? undefined : "var(--store-accent, #f97316)" }}
              variant={isFollowing ? "secondary" : "default"}
            >
              {isFollowing ? (
                <><UserCheck className="w-4 h-4" /> {t("profile.following")}</>
              ) : isFollowedBy ? (
                <><UserPlus className="w-4 h-4" /> {t("profile.followBack")}</>
              ) : (
                <><UserPlus className="w-4 h-4" /> {t("storeDetail.followStore")}</>
              )}
            </Button>
            <Link to={createPageUrl("Chat") + `?to=${store.owner_username}`}>
              <Button variant="outline" className="rounded-xl gap-2">
                <MessageCircle className="w-4 h-4" /> {t("storeDetail.chatWithVendor")}
              </Button>
            </Link>
          </div>
        )}

        {show_address && (store?.phone_number || store?.address) && (
          <div className="flex flex-col gap-1.5 text-sm text-slate-600 dark:text-slate-300">
            {store.phone_number && (
              <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {store.phone_number}</span>
            )}
            {store.address && (
              <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {store.address}</span>
            )}
          </div>
        )}

        {show_social && (social.facebook || social.instagram || social.twitter || social.tiktok) && (
          <div className="flex items-center gap-3">
            {social.facebook && (
              <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <Facebook className="w-5 h-5" />
              </a>
            )}
            {social.instagram && (
              <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            {social.twitter && (
              <a href={social.twitter} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <Twitter className="w-5 h-5" />
              </a>
            )}
            {social.tiktok && (
              <a href={social.tiktok} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                TikTok
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
