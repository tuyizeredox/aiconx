import React, { createContext, useCallback, useContext, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { postsAPI } from "@/api/apiClient";
import { uploadPostMedia, uploadPostThumbnail } from "@/lib/storage";

const PostUploadContext = createContext(null);

let nextJobId = 1;

// Mounted once at the app root (above the router), so a post started from the
// composer keeps uploading — and its progress stays visible — no matter where
// the user navigates to next. The composer itself just calls startUpload()
// and is free to unmount immediately after.
export function PostUploadProvider({ children }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState([]);

  const updateJob = useCallback((id, patch) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const removeJob = useCallback((id) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const startUpload = useCallback((input) => {
    const {
      content,
      mediaFiles = [],
      mediaPreviewUrls = [],
      mediaThumbnails = [],
      taggedProducts = [],
      selectedAffiliateLinks = [],
      visibility,
      isEditMode = false,
      editPostId = null,
      editPost = null,
      communityId = null,
    } = input;

    const id = `post-upload-${nextJobId++}`;
    const job = {
      id,
      isEditMode,
      editPostId,
      contentPreview: (content || "").slice(0, 60),
      mediaCount: mediaFiles.filter(Boolean).length,
      progress: 0,
      status: "uploading",
    };
    setJobs((prev) => [...prev, job]);

    (async () => {
      try {
        const uploadTasks = mediaFiles
          .map((file, index) => ({ file, index }))
          .filter(({ file }) => file != null);

        const fileProgress = {};
        const uploadPromises = uploadTasks.map(({ file, index }) =>
          uploadPostMedia(file, {
            onProgress: (progress) => {
              fileProgress[index] = progress;
              const total = Object.values(fileProgress).reduce((sum, p) => sum + p, 0);
              const overall = uploadTasks.length > 0 ? Math.round(total / uploadTasks.length) : 0;
              updateJob(id, { progress: overall });
            },
          })
            .then((res) => {
              const file_url = res.url;
              if (!file_url) throw new Error("No URL returned from upload");
              return { url: file_url, index };
            })
            .catch((error) => {
              throw new Error(`Failed to upload ${file.name}: ${error.message}`);
            })
        );

        const uploadResults = await Promise.all(uploadPromises);

        const finalMediaUrls = mediaPreviewUrls.map((preview, index) => {
          const uploaded = uploadResults.find((r) => r.index === index);
          return uploaded ? uploaded.url : preview.url;
        });

        const thumbnailTasks = mediaThumbnails
          .map((thumb, index) => ({ thumb, index }))
          .filter(({ thumb }) => thumb?.file != null);

        const thumbnailUploadResults = await Promise.all(
          thumbnailTasks.map(({ thumb, index }) =>
            uploadPostThumbnail(thumb.file)
              .then((res) => ({ url: res.url, index }))
              .catch(() => ({ url: null, index }))
          )
        );

        const finalThumbnailUrls = mediaPreviewUrls.map((preview, index) => {
          const uploaded = thumbnailUploadResults.find((r) => r.index === index && r.url);
          if (uploaded) return uploaded.url;
          return editPost?.thumbnail_urls?.[index] || "";
        });

        const hasVideo = mediaPreviewUrls.some((m) => m.type?.startsWith("video"));
        const mediaType = mediaPreviewUrls.length === 0 ? "text" : hasVideo ? "video" : "image";

        const postData = {
          content: content?.trim() || "",
          media_urls: finalMediaUrls || [],
          thumbnail_urls: finalThumbnailUrls || [],
          media_type: mediaType || "text",
          tagged_products: (taggedProducts || [])
            .map((p) => {
              const rawId = p.id || p._id || (typeof p === "string" ? p : null);
              if (!rawId || rawId === "undefined" || rawId === "null" || typeof rawId === "object") return null;
              return String(rawId);
            })
            .filter((id) => !!id && id !== "[object Object]"),
          affiliate_links: (selectedAffiliateLinks || [])
            .map((link) => {
              const rawId = link.id || link._id || (typeof link === "string" ? link : null);
              if (!rawId || rawId === "undefined" || rawId === "null" || typeof rawId === "object") return null;
              return String(rawId);
            })
            .filter((id) => !!id && id !== "[object Object]"),
          visibility: visibility || "public",
          ...(communityId && !isEditMode ? { community_id: communityId } : {}),
        };

        let response;
        try {
          response = isEditMode
            ? await postsAPI.update(editPostId, postData)
            : await postsAPI.create(postData);
        } catch (err) {
          if (err.details) {
            const detailMsg = Array.isArray(err.details)
              ? err.details.map((d) => `${d.path.join(".")}: ${d.message}`).join(", ")
              : JSON.stringify(err.details);
            throw new Error(`Validation failed: ${detailMsg}`);
          }
          throw err;
        }

        updateJob(id, { status: "success", progress: 100 });
        toast.success(isEditMode ? (t("create.postUpdated") || "Post updated") : t("create.postCreated"));
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["postDetail", editPostId] });
        queryClient.invalidateQueries({ queryKey: ["userPosts"] });
        if (communityId) queryClient.invalidateQueries({ queryKey: ["communityPosts", communityId] });

        mediaThumbnails.forEach((thumb) => thumb?.previewUrl && URL.revokeObjectURL(thumb.previewUrl));

        removeJob(id);
        return response;
      } catch (error) {
        console.error(`Post ${isEditMode ? "update" : "creation"} failed:`, error);
        updateJob(id, { status: "error", error: error.message });
        toast.error(error.message || (isEditMode ? (t("create.failedToUpdatePost") || "Failed to update post") : t("create.failedToCreatePost")));
        // Leave the failed job visible briefly so the indicator can surface the
        // error before it's dismissed, instead of it silently vanishing.
        setTimeout(() => removeJob(id), 4000);
      }
    })();

    return id;
  }, [queryClient, t, updateJob, removeJob]);

  return (
    <PostUploadContext.Provider value={{ jobs, startUpload }}>
      {children}
    </PostUploadContext.Provider>
  );
}

export function usePostUpload() {
  const ctx = useContext(PostUploadContext);
  if (!ctx) throw new Error("usePostUpload must be used within a PostUploadProvider");
  return ctx;
}
