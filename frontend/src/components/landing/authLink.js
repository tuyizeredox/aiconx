// Guests on the landing page hit a sign-up wall before reaching auth-gated pages
// (a post, a store, their own storefront). Spreading `authLink(dest)` onto a
// <Link> sends them to /register but records where they were actually headed.
//
// Login.jsx and Register.jsx both redirect to `location.state.from` after every
// auth method (password, Google, OTP, biometric), and each passes `location.state`
// straight through on the "have an account? / need an account?" link — so the
// destination survives the user toggling between register and login.
import { storeUrl } from "@/lib/utils";

export const authLink = (destination) => ({
  to: "/register",
  state: { from: destination },
});

export const productPath = (id) => `/productdetail?id=${id}`;
// Takes the store object (not just an id) so guests land on the readable
// /store/:slug link — see storeUrl in lib/utils for the id fallback.
export const storePath = (store) => storeUrl(store);
export const postPath = (id) => `/postdetail?id=${id}`;
