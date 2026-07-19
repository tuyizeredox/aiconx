import React from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { usePostUpload } from "@/lib/PostUploadContext";

// Small persistent pill shown on every page while a post created via the
// composer is still uploading in the background — the composer itself hands
// off to PostUploadProvider and unmounts right away, so without this the
// user would have no sign anything was still happening once they navigated on.
export default function PostUploadIndicator() {
  const { jobs } = usePostUpload();
  const uploadingJobs = jobs.filter((j) => j.status === "uploading");

  if (uploadingJobs.length === 0) return null;

  const label = uploadingJobs.length === 1
    ? (uploadingJobs[0].isEditMode ? "Updating post…" : "Posting…")
    : `Posting ${uploadingJobs.length} updates…`;
  const progress = Math.round(
    uploadingJobs.reduce((sum, j) => sum + (j.progress || 0), 0) / uploadingJobs.length
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="fixed left-1/2 -translate-x-1/2 z-40 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:bottom-6 pointer-events-none"
      >
        <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full bg-slate-900/95 dark:bg-slate-800/95 text-white shadow-lg backdrop-blur-sm">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
          <span className="text-xs text-white/60 tabular-nums">{progress}%</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
