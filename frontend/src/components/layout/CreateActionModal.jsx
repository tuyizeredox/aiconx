import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, PenSquare, Image, Radio, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import CreateStoryModal from "@/components/stories/CreateStoryModal";
import { useTranslation } from "react-i18next";

export default function CreateActionModal({ open, onClose, currentUser }) {
  const { t } = useTranslation();
  const [showStoryCreate, setShowStoryCreate] = useState(false);

  const actions = [
    {
      id: "post",
      label: t("create.createPost"),
      description: t("create.createPostDesc"),
      icon: PenSquare,
      color: "bg-orange-50 text-orange-600",
      to: createPageUrl("CreatePost"),
    },
    {
      id: "story",
      label: t("create.addStory"),
      description: t("create.addStoryDesc"),
      icon: Image,
      color: "bg-pink-50 text-pink-600",
      onClick: () => setShowStoryCreate(true),
    },
    {
      id: "live",
      label: t("create.goLive"),
      description: t("create.goLiveDesc"),
      icon: Radio,
      color: "bg-rose-50 text-rose-600",
      to: createPageUrl("Live"),
    },
    {
      id: "product",
      label: t("create.addProduct"),
      description: t("create.addProductDesc"),
      icon: ShoppingBag,
      color: "bg-emerald-50 text-green-600",
      to: createPageUrl("MyStore"),
    },
  ];

  if (!open && !showStoryCreate) return null;

  return (
    <>
      <AnimatePresence>
        {open && !showStoryCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{t("create.title")}</h2>
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-3">
                {actions.map((action) => {
                  const Content = (
                    <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-50 hover:border-slate-100 hover:bg-slate-50 transition-all text-left w-full group">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${action.color} group-hover:scale-110 transition-transform`}>
                        <action.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">{action.label}</h3>
                        <p className="text-xs text-slate-400 truncate">{action.description}</p>
                      </div>
                    </div>
                  );

                  if (action.to) {
                    return (
                      <Link key={action.id} to={action.to} onClick={onClose}>
                        {Content}
                      </Link>
                    );
                  }

                  return (
                    <button key={action.id} onClick={action.onClick} className="w-full">
                      {Content}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStoryCreate && (
          <CreateStoryModal
            currentUser={currentUser}
            onClose={() => {
              setShowStoryCreate(false);
              onClose();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
