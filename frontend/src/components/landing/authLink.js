// Guests on the landing page hit a sign-up wall before reaching auth-gated pages
// (a post, a store, their own storefront). Spreading `authLink(dest)` onto a
// <Link> sends them to /register but records where they were actually headed.
//
// Login.jsx and Register.jsx both redirect to `location.state.from` after every
// auth method (password, Google, OTP, biometric), and each passes `location.state`
// straight through on the "have an account? / need an account?" link — so the
// destination survives the user toggling between register and login.
export const authLink = (destination) => ({
  to: "/register",
  state: { from: destination },
});

export const productPath = (id) => `/productdetail?id=${id}`;
export const storePath = (id) => `/storedetail?id=${id}`;
export const postPath = (id) => `/postdetail?id=${id}`;
