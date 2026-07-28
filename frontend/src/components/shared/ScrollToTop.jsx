import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { recordNavigation } from "@/lib/navHistory";

// Many routes here reuse the same pathname across items (e.g. `/productdetail?id=`,
// `/PostDetail?id=`), so pathname alone won't change when navigating between two
// items of the same page — key off pathname + search instead.
//
// This sits under the Router on every route, so it doubles as the place that
// records each navigation for useBackLink (see lib/navHistory).
export default function ScrollToTop() {
  const location = useLocation();
  const { pathname, search } = location;

  useLayoutEffect(() => {
    recordNavigation(location);
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  return null;
}
