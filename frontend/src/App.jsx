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
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { LanguageProvider } from '@/components/providers/LanguageContext';
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
  return <Navigate to={`/StoreDetail${location.search}`} replace />;
};

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

      {/* Welcome / Landing page — only for unauthenticated users */}
      <Route path="/welcome" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Pages.LandingPage />
      } />

      {/* Product detail is publicly viewable so affiliate links work for logged-out visitors */}
      <Route path="/productdetail" element={
        isAuthenticated && user?.role === 'super_admin' ? <Navigate to="/admin-dashboard" replace /> :
        <LayoutWrapper currentPageName="ProductDetail">
          <Pages.ProductDetail />
        </LayoutWrapper>
      } />

      {/* Cart is publicly viewable (guest cart lives in localStorage) so a guest can add to
          cart from an affiliate link and only needs to sign in once they reach checkout */}
      <Route path="/cart" element={
        isAuthenticated && user?.role === 'super_admin' ? <Navigate to="/admin-dashboard" replace /> :
        <LayoutWrapper currentPageName="Cart">
          <Pages.Cart />
        </LayoutWrapper>
      } />

      {/* Checkout requires login, but remembers where to return to so guest carts aren't lost */}
      <Route path="/checkout" element={
        !isAuthenticated ? <Navigate to="/login" state={{ from: location.pathname + location.search }} replace /> :
        user?.role === 'super_admin' ? <Navigate to="/admin-dashboard" replace /> :
        <LayoutWrapper currentPageName="Checkout">
          <Pages.Checkout />
        </LayoutWrapper>
      } />

      {/* Main app routes (with layout & auth check) */}
      <Route path="/" element={
        !isAuthenticated ? <Pages.LandingPage /> :
        // NOTE: This is a UX-only guard. Backend APIs must independently enforce super_admin authorization.
        user?.role === 'super_admin' ? <Navigate to="/admin-dashboard" replace /> :
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />

      {Object.entries(Pages).map(([path, Page]) => {
        const lowerPath = path.toLowerCase();
        // Skip Login and Register as they are handled above; ProductDetail, Cart and Checkout are handled above too
        if (['Login', 'Register', 'ForgotPassword', 'ResetPassword', 'AdminDashboard', 'LandingPage', 'Terms', 'Privacy', 'Guidelines', 'ProductDetail', 'Cart', 'Checkout'].includes(path)) return null;
        
        return (
          <Route
            key={path}
            path={`/${lowerPath}`}
            element={
              !isAuthenticated ? <Navigate to="/welcome" replace /> :
              // NOTE: This is a UX-only guard. Backend APIs must independently enforce super_admin authorization.
              user?.role === 'super_admin' && !['AdminDashboard', 'Profile', 'Chat', 'Notifications', 'Settings'].includes(path) ? 
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
        !isAuthenticated ? <Navigate to="/welcome" replace /> :
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
                    <AffiliateTracker />
                    <AppRoutes />
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
