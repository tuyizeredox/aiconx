import * as React from "react"

// Must match Tailwind's `lg` breakpoint (1024px) — Layout.jsx uses this hook
// to decide JS-driven sidebar behavior (fixed desktop sidebar vs. off-canvas
// drawer) while using `lg:` CSS classes for the main-content margin and the
// mobile top/bottom nav bars. A mismatched threshold here makes both the
// desktop sidebar and the mobile nav render at once in the gap between them.
const MOBILE_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange);
  }, [])

  return !!isMobile
}
