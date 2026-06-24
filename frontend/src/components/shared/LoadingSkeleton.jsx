import React from "react";

export function PostSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-slate-200" />
        <div className="space-y-1.5">
          <div className="h-3 w-24 bg-slate-200 rounded" />
          <div className="h-2.5 w-16 bg-slate-100 rounded" />
        </div>
      </div>
      <div className="h-3 w-3/4 bg-slate-100 rounded mb-2" />
      <div className="h-3 w-1/2 bg-slate-100 rounded mb-3" />
      <div className="aspect-video rounded-xl bg-slate-200" />
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
      <div className="aspect-square bg-slate-200" />
      <div className="p-3 space-y-2">
        <div className="h-2.5 w-16 bg-slate-100 rounded" />
        <div className="h-3 w-3/4 bg-slate-200 rounded" />
        <div className="h-4 w-20 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex gap-3 mb-4 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
      <div className="max-w-[80%] space-y-2 flex flex-col items-start">
        <div className="rounded-2xl px-4 py-3 bg-slate-100 h-10 w-48" />
        <div className="rounded-2xl px-4 py-3 bg-slate-100 h-8 w-32" />
      </div>
    </div>
  );
}

export function StoreSkeleton() {
  return (
    <div className="w-40 shrink-0 bg-white rounded-2xl border border-slate-100 p-4 text-center animate-pulse">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-2" />
      <div className="h-3 w-3/4 bg-slate-100 rounded mx-auto mb-2" />
      <div className="h-2.5 w-1/2 bg-slate-100 rounded mx-auto" />
    </div>
  );
}