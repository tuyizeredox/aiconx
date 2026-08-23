import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useParams } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SocketProvider } from '@/lib/SocketContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@southdevs/capacitor-google-auth';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AffiliateTracker from './components/shared/AffiliateTracker';
import ScrollToTop from './components/shared/ScrollToTop';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { LanguageProvider } from '@/components/providers/LanguageContext';
import MaintenanceGate from '@/components/shared/MaintenanceGate';
import { ThemeProvider } from "next-themes";
import { PostUploadProvider } from '@/lib/PostUploadContext';
import PostUploadIndicator from '@/components/shared/PostUploadIndicator';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

if (!googleClientId) {
  console.warn("VITE_GOOGLE_CLIENT_ID is not defined in environment variables. Google Login will not function.");
}

// The web GoogleOAuthProvider below only drives the browser flow; native
// Android/iOS use GoogleAuth's own sign-in UI instead (see GoogleSignInButton),
// configured via capacitor.config.ts's plugins.GoogleAuth block.
if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize();
}

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// Redirects for legacy notification links (already stored in the DB, or already
// delivered to devices as push notifications) that used path params instead of
// the app's actual `?id=` query-param routes.
const LegacyProductRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/ProductDetail?id=${id}`} replace />;
};

const LegacyCommunityRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/CommunityDetail?id=${id}`} replace />;
};

const LegacyStoreRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/storedetail${location.search}`} replace />;
};

// Lets a super_admin preview a live product/store page from the admin dashboard
// (e.g. the "View in Store" button) without being bounced back by the guards
// below, which otherwise keep super_admins confined to the admin dashboard.
const isAdminPreview = (location) => new URLSearchParams(location.search).get('adminPreview') === '1';

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Layout>
  : <ErrorBoundary>{children}</ErrorBoundary>;

const AppRoutes = () => {
  const { isLoadingAuth, isAuthenticated, authError, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center dark:bg-[#0a0a0c] bg-slate-50 transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 dark:border-slate-700 border-slate-200 dark:border-t-orange-500 border-t-orange-500 rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] dark:text-slate-600 text-slate-400">Loading</p>
        </div>
      </div>
    );
  }

  // Render the app
  return (
    <Routes>
      {/* Public routes (no layout) */}
      <Route path="/login" element={<Pages.Login />} />
      <Route path="/Login" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<Pages.Register />} />
      <Route path="/Register" element={<Navigate to="/register" replace />} />
      <Route path="/terms" element={<Pages.Terms />} />
      <Route path="/privacy" element={<Pages.Privacy />} />
      <Route path="/community-guidelines" element={<Pages.Guidelines />} />
      <Route path="/forgot-password" element={<Pages.ForgotPassword />} />
      <Route path="/ForgotPassword" element={<Navigate to="/forgot-password" replace />} />
      <Route path="/reset-password" element={<Pages.ResetPassword />} />
      <Route path="/ResetPassword" element={<Navigate to="/reset-password" replace />} />

      {/* The marketing landing page is gone: the feed is the pitch now, and it
          works without an account. /welcome stays as a redirect because the URL
          is already out in the wild — campaign links, shared links, and app
          shells installed before the change. */}
      <Route path="/welcome" element={<Navigate to="/" replace />} />

      {/* The shopping flow (product → cart → checkout) renders standalone, outside the
          sidebar/bottom-nav chrome, so the buying experience gets the full viewport and
          reads like a storefront. Each of those pages brings its own ShopHeaderBar.

          Product detail is publicly viewable so affiliate links work for logged-out visitors */}
      <Route path="/productdetail" element={
        isAuthenticated && user?.role === 'super_admin' && !isAdminPreview(location) ? <Navigate to="/admin-dashboard" replace /> :
        <ErrorBoundary><Pages.ProductDetail /></ErrorBoundary>
      } />

      {/* The marketplace is the front door of that same shopping flow, so it
          renders standalone too — the filter column plus a 4-up product grid
          needs the full viewport width, and the sidebar chrome would compete
          with its own search/filter toolbar. */}
      <Route path="/marketplace" element={
        !isAuthenticated ? <Navigate to="/login" state={{ from: location.pathname + location.search }} replace /> :
        user?.role === 'super_admin' && !isAdminPreview(location) ? <Navigate to="/admin-dashboard" replace /> :
        <ErrorBoundary><Pages.Marketplace /></ErrorBoundary>
      } />

      {/* Store pages are their own standalone full page (no sidebar/app chrome) so a
          vendor's custom storefront reads as a real landing page, and publicly
          viewable so shared store links work for logged-out visitors too.

          /store/:slug is the shareable form ("/store/kigali-coffee"); /storedetail?id=
          stays for links already out in the wild (notifications, bookmarks). Both
          render the same page — StoreDetail resolves either identifier. */}
      <Route path="/store/:slug" element={
        isAuthenticated && user?.role === 'super_admin' && !isAdminPreview(location) ? <Navigate to="/admin-dashboard" replace /> :
        <ErrorBoundary><Pages.StoreDetail /></ErrorBoundary>
      } />
      <Route path="/storedetail" element={
        isAuthenticated && user?.role === 'super_admin' && !isAdminPreview(location) ? <Navigate to="/admin-dashboard" replace /> :
        <ErrorBoundary><Pages.StoreDetail /></ErrorBoundary>
      } />

      {/* Cart is publicly viewable (guest cart lives in localStorage) so a guest can add to
          cart from an affiliate link and only needs to sign in once they reach checkout */}
      <Route path="/cart" element={
        isAuthenticated && user?.role === 'super_admin' ? <Navigate to="/admin-dashboard" replace /> :
        <ErrorBoundary><Pages.Cart /></ErrorBoundary>
      } />

      {/* Checkout requires login, but remembers where to return to so guest carts aren't lost */}
      <Route path="/checkout" element={
        !isAuthenticated ? <Navigate to="/login" state={{ from: location.pathname + location.search }} replace /> :
        user?.role === 'super_admin' ? <Navigate to="/admin-dashboard" replace /> :
        <ErrorBoundary><Pages.Checkout /></ErrorBoundary>
      } />

      {/* The feed is the front door for everyone.

          A visitor who has just installed the app should see products and
          creators immediately, not a pitch — so no landing page, no
          onboarding, no sign-in wall stands between opening the app and the
          first screen of things they might want to buy. Signing in is asked
          for at the moment it actually means something (liking, saving,
          checking out), which is also when it is easiest to justify. */}
      <Route path="/" element={
        // NOTE: This is a UX-only guard. Backend APIs must independently enforce super_admin authorization.
        isAuthenticated && user?.role === 'super_admin' ? <Navigate to="/admin-dashboard" replace /> :
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />

      {Object.entries(Pages).map(([path, Page]) => {
        const lowerPath = path.toLowerCase();
        // Discover is the other half of the shoppable feed — the search bar on
        // the home screen lands here — so it stays open to guests for the same
        // reason product pages already are.
        const isGuestViewable = path === 'Explore';
        // Skip Login and Register as they are handled above; ProductDetail, Cart and Checkout are handled above too
        if (['Login', 'Register', 'ForgotPassword', 'ResetPassword', 'AdminDashboard', 'Terms', 'Privacy', 'Guidelines', 'ProductDetail', 'Cart', 'Checkout', 'StoreDetail', 'Marketplace'].includes(path)) return null;
        
        return (
          <Route
            key={path}
            path={`/${lowerPath}`}
            element={
              !isAuthenticated && !isGuestViewable ? <Navigate to="/login" state={{ from: location.pathname + location.search }} replace /> :
              // NOTE: This is a UX-only guard. Backend APIs must independently enforce super_admin authorization.
              user?.role === 'super_admin' && !isAdminPreview(location) && !['AdminDashboard', 'Profile', 'Chat', 'Notifications', 'Settings'].includes(path) ?
              <Navigate to="/admin-dashboard" replace /> :
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        );
      })}
      
      {/* Legacy notification link redirects — see LegacyProductRedirect etc. above */}
      <Route path="/product/:id" element={<LegacyProductRedirect />} />
      <Route path="/community/:id" element={<LegacyCommunityRedirect />} />
      <Route path="/communities/:id" element={<LegacyCommunityRedirect />} />
      <Route path="/store" element={<LegacyStoreRedirect />} />

      <Route path="/admin-dashboard" element={
        !isAuthenticated ? <Navigate to="/login" state={{ from: location.pathname + location.search }} replace /> :
        user?.role !== 'super_admin' ? <Navigate to="/" replace /> :
        <LayoutWrapper currentPageName="AdminDashboard">
          <Pages.AdminDashboard />
        </LayoutWrapper>
      } />
      
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <GoogleOAuthProvider
      clientId={googleClientId}
      onScriptLoadError={() => console.warn('Google OAuth script failed to load.')}
      onScriptLoadSuccess={() => console.info('Google OAuth ready.')}
    >
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <SocketProvider>
            <QueryClientProvider client={queryClientInstance}>
              <LanguageProvider>
                <PostUploadProvider>
                  <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                    <ScrollToTop />
                    <AffiliateTracker />
                    <MaintenanceGate>
                      <AppRoutes />
                    </MaintenanceGate>
                    <PostUploadIndicator />
                  </Router>
                  <Toaster />
                  <SonnerToaster position="top-center" richColors closeButton />
                </PostUploadProvider>
              </LanguageProvider>
            </QueryClientProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}

export default App
