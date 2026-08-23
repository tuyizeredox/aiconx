import { useCallback, useRef, useState } from "react";

/**
 * Browser geolocation, on demand.
 *
 * Deliberately never auto-requests: the permission prompt only appears after
 * the shopper explicitly asks for a location-based result (e.g. flipping on
 * "near me"), so nobody is challenged by a browser dialog just for opening a
 * page. The last fix is cached for the lifetime of the component, so toggling
 * a filter off and on again doesn't re-prompt.
 *
 * status: "idle" | "locating" | "ready" | "denied" | "unavailable" | "error"
 */
export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState("idle");
  // Guards against a second request being fired while one is in flight (a
  // double-tap on the toggle would otherwise queue two permission prompts).
  const pending = useRef(false);

  const request = useCallback(() => {
    if (pending.current) return;

    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    pending.current = true;
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        pending.current = false;
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("ready");
      },
      (error) => {
        pending.current = false;
        setCoords(null);
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  /**
   * Fills in coordinates only if the browser already holds a granted
   * geolocation permission, and does nothing otherwise.
   *
   * Pages that merely *decorate* with distance — "1.2 km away" on a product —
   * use this instead of `request`, so opening a product page can never be the
   * thing that raises a permission dialog. The shopper opts in once, from the
   * feed, and the rest of the app quietly benefits.
   */
  const requestIfGranted = useCallback(async () => {
    if (coords || pending.current) return;
    try {
      const permission = await navigator.permissions?.query({ name: "geolocation" });
      if (permission?.state === "granted") request();
    } catch {
      // Permissions API missing or blocked (older Safari, some webviews):
      // stay silent rather than falling back to a prompt.
    }
  }, [coords, request]);

  const reset = useCallback(() => {
    setCoords(null);
    setStatus("idle");
  }, []);

  return { coords, status, request, requestIfGranted, reset };
}

export default useGeolocation;
