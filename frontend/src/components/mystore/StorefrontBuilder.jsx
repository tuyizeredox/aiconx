import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Pencil, Eye, EyeOff, Loader2, ExternalLink, X, CloudUpload, Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { storeUrl } from "@/lib/utils";
import { toast } from "sonner";
import { storesAPI } from "@/api/apiClient";
import ThemeEditor from "./storefront-builder/ThemeEditor";
import BlockEditor from "./storefront-builder/BlockEditor";
import StorefrontAIGenerator from "./storefront-builder/StorefrontAIGenerator";
import { BLOCK_TYPE_META, BLOCK_TYPES, newBlock } from "./storefront-builder/blockTypes";
import StorefrontRenderer from "@/components/store/storefront/StorefrontRenderer";

// How long the vendor has to stop editing before the draft is written.
const DRAFT_AUTOSAVE_DELAY_MS = 1200;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// The colour fields are free-text, so a vendor mid-way through typing "#ea5"
// holds a value the server rejects. Skip those autosave cycles instead of
// showing an error for normal typing — the next keystroke that completes the
// hex saves everything.
function isSavableDraft(payload) {
  return Object.values(payload.theme || {}).every((color) => !color || HEX_COLOR.test(color));
}

function relativeTime(date) {
  if (!date) return "";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return date.toLocaleDateString();
}

export default function StorefrontBuilder({ store, products = [], vendorUsername }) {
  const queryClient = useQueryClient();
  const storeId = store?.id || store?._id;
  const published = store?.storefront_config;

  // The builder always edits the draft when there is one, so an AI generation
  // or a half-finished edit survives navigating away. Only Publish moves it
  // into storefront_config, which is what visitors actually see.
  const [config, setConfig] = useState(() => ({
    enabled: published?.enabled || false,
    theme: store?.storefront_draft?.theme || published?.theme || {},
    blocks: store?.storefront_draft?.blocks || published?.blocks || [],
  }));
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasDraft, setHasDraft] = useState(!!store?.storefront_draft);
  const [draftSavedAt, setDraftSavedAt] = useState(
    store?.storefront_draft?.updated_at ? new Date(store.storefront_draft.updated_at) : null
  );

  // Only theme + blocks live in the draft; `enabled` is a publish decision.
  const draftPayload = useMemo(() => ({ theme: config.theme, blocks: config.blocks }), [config.theme, config.blocks]);
  // What the server currently holds, so we never re-save an unchanged draft.
  const savedSnapshotRef = useRef(JSON.stringify(draftPayload));
  const pendingRef = useRef(draftPayload);
  pendingRef.current = draftPayload;

  const saveDraftMutation = useMutation({
    mutationFn: (payload) => storesAPI.update(storeId, { storefront_draft: payload }),
    onSuccess: (_data, payload) => {
      setHasDraft(true);
      setDraftSavedAt(new Date());
      // Patch the cache rather than refetch: leaving this tab and coming back
      // remounts the builder, which reads its initial state from here.
      queryClient.setQueryData(["myStore", vendorUsername], (prev) =>
        prev ? { ...prev, storefront_draft: { ...payload, updated_at: new Date().toISOString() } } : prev
      );
    },
  });

  // The snapshot is marked saved before the request resolves, so an unmount
  // mid-flight doesn't fire a second identical write. A failure puts it back to
  // dirty, leaving the next edit (or tab switch) free to retry.
  const saveDraft = (payload) => {
    const snapshot = JSON.stringify({ theme: payload.theme, blocks: payload.blocks });
    savedSnapshotRef.current = snapshot;
    saveDraftMutation.mutate(payload, {
      onError: (err) => {
        if (savedSnapshotRef.current === snapshot) savedSnapshotRef.current = null;
        toast.error(err.message || "Couldn't save your draft — your changes are still on screen");
      },
    });
  };
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  // Debounced autosave. Edits land in the draft, never on the live storefront.
  useEffect(() => {
    if (!storeId) return;
    if (JSON.stringify(draftPayload) === savedSnapshotRef.current) return;
    if (!isSavableDraft(draftPayload)) return;
    const timer = setTimeout(() => saveDraftRef.current(draftPayload), DRAFT_AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draftPayload, storeId]);

  // Switching tabs unmounts the builder mid-debounce — flush so the last edit
  // isn't the one that gets lost.
  useEffect(() => {
    return () => {
      if (JSON.stringify(pendingRef.current) !== savedSnapshotRef.current && isSavableDraft(pendingRef.current)) {
        saveDraftRef.current(pendingRef.current);
      }
    };
  }, []);

  const publishMutation = useMutation({
    // Publishing promotes the draft and clears it in the same write, so the
    // builder and the live page can't drift apart.
    mutationFn: () => storesAPI.update(storeId, { storefront_config: config, storefront_draft: null }),
    onSuccess: () => {
      savedSnapshotRef.current = JSON.stringify(pendingRef.current);
      setHasDraft(false);
      setDraftSavedAt(null);
      toast.success(config.enabled ? "Storefront published" : "Storefront saved — turn on Publish to make it live");
      queryClient.invalidateQueries({ queryKey: ["myStore", vendorUsername] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save storefront");
    },
  });

  const discardDraftMutation = useMutation({
    mutationFn: () => storesAPI.update(storeId, { storefront_draft: null }),
    onSuccess: () => {
      const restored = {
        enabled: published?.enabled || false,
        theme: published?.theme || {},
        blocks: published?.blocks || [],
      };
      savedSnapshotRef.current = JSON.stringify({ theme: restored.theme, blocks: restored.blocks });
      setConfig(restored);
      setHasDraft(false);
      setDraftSavedAt(null);
      toast.success("Draft discarded — back to your published layout");
      queryClient.invalidateQueries({ queryKey: ["myStore", vendorUsername] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to discard the draft");
    },
  });

  const addBlock = (type) => {
    setConfig((c) => ({ ...c, blocks: [...c.blocks, newBlock(type)] }));
  };
  const removeBlock = (id) => setConfig((c) => ({ ...c, blocks: c.blocks.filter((b) => b.id !== id) }));
  const toggleVisible = (id) =>
    setConfig((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)) }));
  const updateBlock = (updated) =>
    setConfig((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === updated.id ? updated : b)) }));

  const onDragEnd = (result) => {
    if (!result.destination) return;
    setConfig((c) => {
      const blocks = Array.from(c.blocks);
      const [moved] = blocks.splice(result.source.index, 1);
      blocks.splice(result.destination.index, 0, moved);
      return { ...c, blocks };
    });
  };

  const editingBlock = config.blocks.find((b) => b.id === editingBlockId);

  // Saved straight away rather than waiting for the autosave debounce: a fresh
  // generation is the thing a vendor is most likely to navigate away from
  // before touching anything else.
  const applyAiResult = (result) => {
    const next = {
      ...config,
      theme: { ...config.theme, ...(result.theme || {}) },
      blocks: Array.isArray(result.blocks) ? result.blocks : config.blocks,
    };
    setConfig(next);
    saveDraft({ theme: next.theme, blocks: next.blocks, generated_by_ai: true });
  };

  return (
    <div className="space-y-4">
      {/* Publish + save */}
      <div className="bg-white dark:bg-ink-800 rounded-2xl border border-slate-100 dark:border-ink-700 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={config.enabled} onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))} />
            <div>
              <Label className="text-sm font-semibold">Publish custom storefront</Label>
              <p className="text-xs text-slate-400 dark:text-ink-500">
                {config.enabled ? "Visitors see your custom layout" : "Visitors see the default layout"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => setShowPreview(true)}
              disabled={config.blocks.length === 0}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </Button>
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending} className="bg-orange-600 hover:bg-orange-700 rounded-xl">
              {publishMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {hasDraft ? "Publish changes" : "Save"}
            </Button>
          </div>
        </div>

        {/* Draft state — work is kept server-side, so leaving and coming back
            lands you back on the same unpublished layout. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs border-t border-slate-100 dark:border-ink-700 pt-2.5">
          {saveDraftMutation.isPending ? (
            <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-ink-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving draft…
            </span>
          ) : hasDraft ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
              <CloudUpload className="w-3.5 h-3.5" />
              Draft saved{draftSavedAt ? ` ${relativeTime(draftSavedAt)}` : ""} — not published yet
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-ink-500">
              <Check className="w-3.5 h-3.5" /> No unpublished changes
            </span>
          )}

          {hasDraft && (
            <>
              <span className="text-slate-500 dark:text-ink-400">
                Your edits are kept automatically — you can leave and come back.
              </span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Discard this draft and go back to your published layout?")) {
                    discardDraftMutation.mutate();
                  }
                }}
                disabled={discardDraftMutation.isPending}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-red-500 disabled:opacity-50"
              >
                <Undo2 className="w-3.5 h-3.5" /> Discard draft
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI generator */}
      <StorefrontAIGenerator store={store} onApply={applyAiResult} hasExistingBlocks={config.blocks.length > 0} />

      {/* Theme */}
      <div className="bg-white dark:bg-ink-800 rounded-2xl border border-slate-100 dark:border-ink-700 p-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-ink-200 mb-3">Brand colors</h3>
        <ThemeEditor theme={config.theme} onChange={(theme) => setConfig((c) => ({ ...c, theme }))} />
      </div>

      {/* Sections */}
      <div className="bg-white dark:bg-ink-800 rounded-2xl border border-slate-100 dark:border-ink-700 p-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-ink-200 mb-3">Sections</h3>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {BLOCK_TYPES.map((type) => {
            const meta = BLOCK_TYPE_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-ink-700 text-xs font-medium text-slate-600 dark:text-ink-300 hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" /> {meta.label}
              </button>
            );
          })}
        </div>

        {config.blocks.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-ink-500 text-center py-8">
            No sections yet. Tap a section above to add it.
          </p>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="storefront-blocks">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {config.blocks.map((block, index) => {
                    const meta = BLOCK_TYPE_META[block.type] || {};
                    const Icon = meta.icon;
                    return (
                      <Draggable key={block.id} draggableId={block.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`flex items-center gap-3 p-3 rounded-xl border bg-slate-50/50 dark:bg-ink-900/40 ${
                              snapshot.isDragging ? "border-orange-300 shadow-lg" : "border-slate-100 dark:border-ink-700"
                            }`}
                          >
                            <span {...dragProvided.dragHandleProps} className="cursor-grab text-slate-300 hover:text-slate-500 shrink-0">
                              <GripVertical className="w-4 h-4" />
                            </span>
                            {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
                            <span className="text-sm font-medium text-slate-700 dark:text-ink-200 flex-1 truncate">
                              {meta.label || block.type}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleVisible(block.id)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-ink-200 shrink-0"
                              title={block.visible === false ? "Hidden" : "Visible"}
                            >
                              {block.visible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBlockId(block.id)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-ink-200 shrink-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBlock(block.id)}
                              className="text-slate-400 hover:text-red-500 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      <Dialog open={!!editingBlock} onOpenChange={(open) => !open && setEditingBlockId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBlock ? BLOCK_TYPE_META[editingBlock.type]?.label || "Section" : ""}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            {editingBlock && <BlockEditor block={editingBlock} storeProducts={products} onUpdate={updateBlock} />}
          </div>
        </DialogContent>
      </Dialog>

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-ink-900 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-ink-900 text-white text-xs font-semibold px-4 py-2.5 flex items-center justify-between gap-3">
            <span>Previewing your draft — this is exactly how visitors will see it, not yet published</span>
            <div className="flex items-center gap-3 shrink-0">
              {storeId && (
                <Link
                  to={storeUrl(store)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1 text-slate-300 hover:text-white"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open published page
                </Link>
              )}
              <button type="button" onClick={() => setShowPreview(false)} className="inline-flex items-center gap-1 hover:text-orange-300">
                <X className="w-4 h-4" /> Close preview
              </button>
            </div>
          </div>
          <StorefrontRenderer
            store={{ ...store, storefront_config: config }}
            products={products}
            currentUser={{ username: vendorUsername }}
            isFollowing={false}
            isFollowedBy={false}
            onFollowToggle={() => {}}
            followPending={false}
            onShare={() => {}}
          />
        </div>
      )}
    </div>
  );
}
