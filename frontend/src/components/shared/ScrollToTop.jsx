import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// Many routes here reuse the same pathname across items (e.g. `/productdetail?id=`,
// `/PostDetail?id=`), so pathname alone won't change when navigating between two
// items of the same page — key off pathname + search instead.
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}
