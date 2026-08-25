import React, { useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, PackageSearch } from "lucide-react";
import { productsAPI } from "@/api/apiClient";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import EmptyState from "@/components/shared/EmptyState";
import FeedProductTile from "./FeedProductTile";
import { rankProducts } from "@/lib/personalization";

const PAGE_SIZE = 24;

/**
 * What the feed becomes when a category chip is tapped.
 *
 * Posts have no category, so filtering the social feed by "Beauty" would
 * mostly return nothing. A shopper who taps a category has switched from
 * browsing to looking, so they get products — ranked against their own
 * history and paged as they scroll.
 */
export default function CategoryProductGrid({ chip, distanceByStore }) {
  const { t } = useTranslation();
  const sentinelRef = useRef(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["feedCategory", chip.id, chip.category, chip.search],
    queryFn: ({ pageParam = 0 }) => productsAPI.list({
      status: "active",
      ...(chip.category ? { category: chip.category } : {}),
      ...(chip.search ? { search: chip.search } : {}),
      sort: "-sales_count",
      limit: PAGE_SIZE,
      skip: pageParam,
    }),
    getNextPageParam: (lastPage) => {
      const next = (lastPage?.skip || 0) + (lastPage?.data?.length || 0);
      return next < (lastPage?.total || 0) ? next : undefined;
    },
    initialPageParam: 0,
    staleTime: 60000,
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const products = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data || []) || [];
    // Only the first screenful is re-ranked; reordering pages the shopper has
    // already scrolled past would make items jump under their thumb.
    const head = rankProducts(flat.slice(0, PAGE_SIZE));
    return [...head, ...flat.slice(PAGE_SIZE)];
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-5">
        {Array(6).fill(0).map((_, i) => <ProductSkeleton key={"cat-sk-" + i} />)}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title={t("home.categoryEmptyTitle", { category: t(chip.tKey) })}
        description={t("home.categoryEmptyDesc")}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-5">
        {products.map((p) => (
          <FeedProductTile
            key={p.id || p._id}
            product={p}
            width="w-full"
            distanceKm={distanceByStore?.get(String(p.store_id)) ?? null}
          />
        ))}
      </div>

      <div ref={sentinelRef} className="py-8 flex justify-center">
        {isFetchingNextPage ? (
          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
        ) : !hasNextPage ? (
          <p className="text-xs text-slate-300 dark:text-ink-600">{t("home.endOfResults")}</p>
        ) : null}
      </div>
    </>
  );
}
