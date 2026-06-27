import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SocketProvider } from '@/lib/SocketContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AffiliateTracker from './components/shared/AffiliateTracker';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { LanguageProvider } from '@/components/providers/LanguageContext';
import { ThemeProvider } from "next-themes";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

if (!googleClientId) {
  console.warn("VITE_GOOGLE_CLIENT_ID is not defined in environment variables. Google Login will not function.");
}

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Layout>
  : <ErrorBoundary>{children}</ErrorBoundary>;

const AppRoutes = () => {
  const { isLoadingAuth, isAuthenticated, authError, user } = useAuth();

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
      <Route path="/forgot-password" element={<Pages.ForgotPassword />} />
      <Route path="/ForgotPassword" element={<Navigate to="/forgot-password" replace />} />
      <Route path="/reset-password" element={<Pages.ResetPassword />} />
      <Route path="/ResetPassword" element={<Navigate to="/reset-password" replace />} />

      {/* Welcome / Landing page — only for unauthenticated users */}
      <Route path="/welcome" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Pages.LandingPage />
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
        // Skip Login and Register as they are handled above
        if (['Login', 'Register', 'ForgotPassword', 'ResetPassword', 'AdminDashboard', 'LandingPage', 'Terms', 'Privacy'].includes(path)) return null;
        
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
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthProvider>
          <SocketProvider>
            <QueryClientProvider client={queryClientInstance}>
              <LanguageProvider>
                <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
                  <AffiliateTracker />
                  <AppRoutes />
                </Router>
                <Toaster />
              </LanguageProvider>
            </QueryClientProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}

export default App
