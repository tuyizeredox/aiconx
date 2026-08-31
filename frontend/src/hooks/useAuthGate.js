import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

/**
 * The gate a signed-out visitor meets when they try to act.
 *
 * Guests can read a good deal of the app — a shared post, a product, a store,
 * the marketplace — and that is deliberate. But every action on top of that
 * reading (liking, commenting, saving, following, booking) needs an account,
 * and until now those buttons simply did nothing when tapped. Nothing is the
 * worst possible answer: it reads as a broken app rather than as a closed
 * door, and it never mentions that an account can be made in a minute.
 *
 * So each gated action sends the visitor to sign-in carrying two things:
 *
 *   `intent` — what they were trying to do, so the sign-in screen can say
 *              "Sign in to like this post" instead of a bare form.
 *   `from`   — where they were, so signing in (or signing up, since the
 *              register link forwards this same state) returns them there
 *              rather than dumping them on a home feed.
 *
 * Both live in router state, which Login and Register already read.
 */

// Every intent here needs a matching `auth.intents.<key>` string. Anything
// without one falls back to the generic line, so a new caller degrades to a
// sensible screen rather than a blank one.
export const AUTH_INTENTS = [
  "like",
  "comment",
  "repost",
  "share",
  "save",
  "follow",
  "wishlist",
  "book",
  "ask",
  "review",
  "message",
  "checkout",
  "report",
];

// For call sites that are a <Link> rather than a handler.
export function authGateState(intent, location) {
  return { from: location.pathname + location.search, intent };
}

export default function useAuthGate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Returns true when the caller may proceed. When it returns false it has
  // already navigated, so callers just bail out.
  const requireAuth = useCallback(
    (intent) => {
      if (user) return true;
      navigate("/login", { state: authGateState(intent, location) });
      return false;
    },
    [user, navigate, location]
  );

  const gateState = useCallback((intent) => authGateState(intent, location), [location]);

  return { isSignedIn: !!user, requireAuth, gateState };
}
