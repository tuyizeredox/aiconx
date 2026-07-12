import React, { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw, Maximize2,
} from "lucide-react";

const MAX_ZOOM = 4;
const MIN_ZOOM = 1;
const HOVER_ZOOM = 2.2;

const supportsHover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distanceBetweenTouches(touches) {
  const [a, b] = touches;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function Lightbox({ images, index, setIndex, title, onClose }) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef(null);
  const pinchState = useRef(null);
  const imageWrapRef = useRef(null);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback((next) => {
    resetZoom();
    setIndex(next);
  }, [resetZoom, setIndex]);

  const clampPan = useCallback((nextPan, z) => {
    const el = imageWrapRef.current;
    if (!el) return nextPan;
    const rect = el.getBoundingClientRect();
    const maxX = (rect.width * (z - 1)) / 2;
    const maxY = (rect.height * (z - 1)) / 2;
    return {
      x: clamp(nextPan.x, -maxX, maxX),
      y: clamp(nextPan.y, -maxY, maxY),
    };
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) => {
      const next = clamp(z - e.deltaY * 0.0025, MIN_ZOOM, MAX_ZOOM);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleDoubleClick = useCallback((e) => {
    setZoom((z) => {
      if (z > 1) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return HOVER_ZOOM;
    });
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (zoom <= 1) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }, [zoom, pan]);

  const handlePointerMove = useCallback((e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPan(clampPan({ x: dragState.current.panX + dx, y: dragState.current.panY + dy }, zoom));
  }, [zoom, clampPan]);

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      pinchState.current = { startDist: distanceBetweenTouches(e.touches), startZoom: zoom };
    } else if (e.touches.length === 1 && zoom > 1) {
      dragState.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    }
  }, [zoom, pan]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const dist = distanceBetweenTouches(e.touches);
      const ratio = dist / pinchState.current.startDist;
      const next = clamp(pinchState.current.startZoom * ratio, MIN_ZOOM, MAX_ZOOM);
      setZoom(next);
      if (next === 1) setPan({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && dragState.current) {
      const dx = e.touches[0].clientX - dragState.current.startX;
      const dy = e.touches[0].clientY - dragState.current.startY;
      setPan(clampPan({ x: dragState.current.panX + dx, y: dragState.current.panY + dy }, zoom));
    }
  }, [zoom, clampPan]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) pinchState.current = null;
    if (e.touches.length === 0) dragState.current = null;
  }, []);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) goTo(index - 1);
      if (e.key === "ArrowRight" && index < images.length - 1) goTo(index + 1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, images.length, goTo, onClose]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 text-white/90">
        <span className="text-sm font-medium">{index + 1} / {images.length}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => { const n = clamp(z - 0.6, MIN_ZOOM, MAX_ZOOM); if (n === 1) setPan({ x: 0, y: 0 }); return n; })}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label={t("product.zoomOut")}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => clamp(z + 0.6, MIN_ZOOM, MAX_ZOOM))}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label={t("product.zoomIn")}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label={t("product.resetZoom")}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image stage */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center touch-none"
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {images.length > 1 && index > 0 && (
          <button
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {images.length > 1 && index < images.length - 1 && (
          <button
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <div ref={imageWrapRef} className="w-full h-full flex items-center justify-center">
          <img
            src={images[index]}
            alt={title}
            draggable={false}
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: dragState.current ? "none" : "transform 0.15s ease-out",
              cursor: zoom > 1 ? "grab" : "zoom-in",
            }}
          />
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 py-3 shrink-0">
          {images.map((img, i) => (
            <button
              key={`lightbox-thumb-${i}`}
              onClick={() => goTo(i)}
              className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                i === index ? "border-orange-500" : "border-transparent opacity-50 hover:opacity-100"
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-white/40 text-xs pb-3 shrink-0">{t("product.zoomHint")}</p>
    </motion.div>,
    document.body
  );
}

export default function ImageZoomGallery({ images, title, badge, onSelectedImageChange }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hoverPos, setHoverPos] = useState({ x: 50, y: 50 });
  const [hovering, setHovering] = useState(false);
  const containerRef = useRef(null);

  const list = images.length > 0 ? images : [];

  React.useEffect(() => {
    onSelectedImageChange?.(list[selected], selected);
     
  }, [selected, list[selected]]);

  const handleMouseMove = useCallback((e) => {
    if (!supportsHover || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    setHoverPos({ x, y });
  }, []);

  return (
    <div>
      <div
        ref={containerRef}
        className="relative aspect-square rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-3 group"
        onMouseEnter={() => supportsHover && setHovering(true)}
        onMouseLeave={() => supportsHover && setHovering(false)}
        onMouseMove={handleMouseMove}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={selected}
            src={list[selected]}
            alt={title}
            className="w-full h-full object-cover cursor-zoom-in"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(true)}
          />
        </AnimatePresence>

        {/* Hover magnifier (desktop only) */}
        {supportsHover && hovering && (
          <div
            className="absolute inset-0 pointer-events-none bg-no-repeat"
            style={{
              backgroundImage: `url(${list[selected]})`,
              backgroundSize: `${HOVER_ZOOM * 100}%`,
              backgroundPosition: `${hoverPos.x}% ${hoverPos.y}%`,
            }}
          />
        )}

        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute bottom-3 right-3 w-9 h-9 bg-white/90 dark:bg-slate-900/90 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={t("product.viewFullscreen")}
        >
          <Maximize2 className="w-4 h-4 text-slate-700 dark:text-slate-200" />
        </button>

        {list.length > 1 && (
          <>
            <button
              onClick={() => setSelected((i) => Math.max(0, i - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSelected((i) => Math.min(list.length - 1, i + 1))}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {badge}
      </div>

      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {list.map((img, i) => (
            <button
              key={`thumb-${i}-${img}`}
              onClick={() => setSelected(i)}
              className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                selected === i ? "border-orange-500 ring-2 ring-orange-100" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {lightboxOpen && (
          <Lightbox
            images={list}
            index={selected}
            setIndex={setSelected}
            title={title}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
