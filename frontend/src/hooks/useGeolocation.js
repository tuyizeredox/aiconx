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

  const reset = useCallback(() => {
    setCoords(null);
    setStatus("idle");
  }, []);

  return { coords, status, request, reset };
}

export default useGeolocation;
