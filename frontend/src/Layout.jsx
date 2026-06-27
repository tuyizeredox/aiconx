import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/lib/utils";
import { notificationsAPI, messagesAPI, cartAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Home,
  Search,
  ShoppingBag,
  MessageCircle,
  User,
  Plus,
  Store,
  Users,
  Package,
  Radio,
  Sparkles,
  Heart,
  Bookmark,
  Settings as SettingsIcon,
  MapPin,
  DollarSign,
  Link2,
  Bell,
  Shield,
  CreditCard,
  Menu,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import NotificationBell from "@/components/layout/NotificationBell";
import GlobalSearch from "@/components/layout/GlobalSearch";
import CreateActionModal from "@/components/layout/CreateActionModal";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";
import Logo from "@/components/layout/Logo";

const NAV_ITEMS = [
  { name: "Home", tKey: "nav.home", icon: Home, page: "Home" },
  { name: "Explore", tKey: "nav.explore", icon: Search, page: "Explore" },
  { name: "Create", icon: Plus, action: "create", accent: true },
  { name: "Cart", tKey: "nav.cart", icon: ShoppingBag, page: "Cart" },
  { name: "Profile", tKey: "nav.profile", icon: User, page: "Profile" },
];

const ADMIN_NAV_ITEMS = [
  { name: "Admin", icon: Shield, page: "AdminDashboard", href: "/admin-dashboard" },
  { name: "Messages", tKey: "nav.messages", icon: MessageCircle, page: "Chat" },
  { name: "Notifications", tKey: "nav.notifications", icon: Bell, page: "Notifications" },
  { name: "Settings", tKey: "nav.settings", icon: SettingsIcon, page: "Settings" },
  { name: "Profile", tKey: "nav.profile", icon: User, page: "Profile" },
];

const ALLOWED_ADMIN_SIDEBAR_NAMES = ["Admin", "Profile", "Messages", "Notifications", "Settings"];

const SIDEBAR_ITEMS = [
  { name: "Feed", tKey: "nav.home", icon: Home, page: "Home" },
  { name: "Profile", tKey: "nav.profile", icon: User, page: "Profile" },
  { name: "Explore", tKey: "nav.explore", icon: Search, page: "Explore" },
  { name: "Marketplace", tKey: "nav.shop", icon: ShoppingBag, page: "Marketplace" },
  { name: "Cart", tKey: "nav.cart", icon: ShoppingBag, page: "Cart" },
  { name: "Live Shopping", tKey: "nav.live", icon: Radio, page: "Live" },
  { name: "Communities", tKey: "nav.communities", icon: Users, page: "Communities" },
  { name: "Messages", tKey: "nav.messages", icon: MessageCircle, page: "Chat" },
  { name: "AI Assistant", tKey: "nav.aiAssistant", icon: Sparkles, page: "AIAssistant" },
  { name: "Wishlist", tKey: "nav.wishlist", icon: Heart, page: "Wishlist" },
  { name: "Bookmarks", tKey: "nav.bookmarks", icon: Bookmark, page: "Bookmarks" },
  { name: "Orders", tKey: "nav.orders", icon: Package, page: "Orders" },
  { name: "Track Order", tKey: "nav.trackOrder", icon: MapPin, page: "OrderTracking" },
  { name: "My Store", tKey: "nav.myStore", icon: Store, page: "MyStore" },
  { name: "Finance", tKey: "nav.finance", icon: DollarSign, page: "VendorFinance" },
  { name: "Account Plans", tKey: "nav.accountPlans", icon: CreditCard, page: "Settings", params: "?section=subscription" },
  { name: "Affiliate", tKey: "nav.affiliate", icon: Link2, page: "Affiliate" },
  { name: "Notifications", tKey: "nav.notifications", icon: Bell, page: "Notifications" },
  { name: "Settings", tKey: "nav.settings", icon: SettingsIcon, page: "Settings" },
  { name: "Admin", icon: Shield, page: "AdminDashboard", href: "/admin-dashboard", adminOnly: true },
];

const HIDE_LAYOUT_PAGES = [];

export default function Layout({ children, currentPageName }) {
  const { t } = useTranslation();
  const isMobileRaw = useIsMobile();
  const isMobile = isMobileRaw !== false; // treat undefined (SSR/initial) as mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const hoverTimerRef = useRef(null);

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const isDesktop = isMobileRaw === false;
  const isDesktopExpanded = isDesktop && (sidebarOpen || hoverOpen);

  const handleMouseEnter = () => {
    if (isDesktop && !sidebarOpen) {
      hoverTimerRef.current = setTimeout(() => setHoverOpen(true), 80);
    }
  };

  const handleMouseLeave = () => {
    if (isDesktop && !sidebarOpen) {
      clearTimeout(hoverTimerRef.current);
      setHoverOpen(false);
      setShowAllItems(false);
    }
  };



  const { data: unreadNotifs = [] } = useQuery({
    queryKey: ["unreadNotifs", currentUser?.email],
    queryFn: () => notificationsAPI.list({ unread_only: 'true' }).then(res => res.data || []),
    enabled: !!currentUser?.email,
  });

  const { data: unreadMessages = [] } = useQuery({
    queryKey: ["unreadMessages", currentUser?.email],
    queryFn: () => messagesAPI.listConversations().then(res => res.data || res || []),
    enabled: !!currentUser?.email,
    refetchInterval: 10000,
  });

  const { data: cartResponse = {} } = useQuery({
    queryKey: ["cart", currentUser?.username],
    queryFn: () => cartAPI.get(),
    enabled: !!currentUser?.username,
  });

  if (HIDE_LAYOUT_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  const unreadCount = unreadNotifs.length;
  const unreadMsgCount = unreadMessages.reduce((acc, conv) => acc + (conv.unread_count || 0), 0);
  const cartItemCount = Array.isArray(cartResponse?.items) ? cartResponse.items.length : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0c] transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {!isDesktop && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed left-0 top-0 bottom-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300
          ${!isDesktop
            ? `z-[70] ${sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"}`
            : `z-30 ${isDesktopExpanded ? "w-64" : "w-[72px]"}`
          }`}
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Link 
              to={currentUser?.role === 'super_admin' ? "/admin-dashboard" : "/"} 
              onClick={() => isMobile && setSidebarOpen(false)}
              className={`flex items-center gap-2 ${!isDesktopExpanded && isDesktop && "justify-center w-full"}`}
            >
              <Logo 
                size="md" 
                showText={isDesktopExpanded || !isDesktop} 
                className={!isDesktopExpanded && isDesktop ? "justify-center w-full !gap-0" : ""}
              />
            </Link>
            {(!isDesktop || isDesktopExpanded) && (
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {!isDesktop ? <X className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
            )}
          </div>
          {(isDesktopExpanded || !isDesktop) && currentUser?.role !== 'super_admin' && <GlobalSearch />}
        </div>

        <nav className="flex-1 px-2 space-y-0.5 overflow-hidden">
          {(() => {
            const visibleItems = SIDEBAR_ITEMS.filter((item) => {
              if (item.adminOnly && currentUser?.role !== 'super_admin') return false;
              if (currentUser?.role === 'super_admin' && !ALLOWED_ADMIN_SIDEBAR_NAMES.includes(item.name)) return false;
              return true;
            });
            const COLLAPSED_LIMIT = 7;
            const isCollapsed = !isDesktopExpanded && isDesktop;
            const itemsToShow = isCollapsed && !showAllItems
              ? visibleItems.slice(0, COLLAPSED_LIMIT)
              : visibleItems;
            const hasMore = isCollapsed && visibleItems.length > COLLAPSED_LIMIT;

            return (
              <>
                {itemsToShow.map((item) => {
                  const queryParams = new URLSearchParams(window.location.search);
                  const currentTab = queryParams.get("tab");
                  const itemTab = item.params ? new URLSearchParams(item.params).get("tab") : null;
                  const isActive = currentPageName === item.page && (itemTab ? currentTab === itemTab : !currentTab);
                  return (
                    <Link
                      key={item.name}
                      to={item.href || createPageUrl(item.page) + (item.params || "")}
                      onClick={() => !isDesktop && setSidebarOpen(false)}
                      title={isCollapsed ? item.name : ""}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      } ${isCollapsed ? "justify-center" : ""}`}
                    >
                      <item.icon className={`w-6 h-6 shrink-0 ${isActive ? "text-orange-600 dark:text-orange-400" : ""}`} />
                      {(isDesktopExpanded || !isDesktop) && (
                        <>
                          <span className="truncate">{item.tKey ? t(item.tKey) : item.name}</span>
                          {item.name === "Notifications" && unreadCount > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                          {item.name === "Messages" && unreadMsgCount > 0 && (
                            <span className="ml-auto bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                            </span>
                          )}
                          {item.name === "Cart" && cartItemCount > 0 && (
                            <span className="ml-auto bg-orange-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                              {cartItemCount}
                            </span>
                          )}
                        </>
                      )}
                      {isCollapsed && (
                        (item.name === "Notifications" && unreadCount > 0) ||
                        (item.name === "Messages" && unreadMsgCount > 0) ||
                        (item.name === "Cart" && cartItemCount > 0)
                      ) && (
                        <div className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                      )}
                    </Link>
                  );
                })}
                {hasMore && (
                  <button
                    onClick={() => setShowAllItems(prev => !prev)}
                    title={showAllItems ? "Show less" : "More"}
                    className="flex items-center justify-center w-full px-3 py-2.5 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
                  >
                    <ChevronRight className={`w-5 h-5 transition-transform ${showAllItems ? "rotate-90" : ""}`} />
                  </button>
                )}
              </>
            );
          })()}
        </nav>

        <div className={`p-3 border-t border-slate-100 dark:border-slate-800 space-y-2 ${!isDesktopExpanded && isDesktop && "flex flex-col items-center"}`}>
          {currentUser?.role !== 'super_admin' && (
            <button
              onClick={() => {
                setShowCreate(true);
                if (isMobile) setSidebarOpen(false);
              }}
              className={`flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-orange-200 dark:hover:shadow-orange-900/40 transition-all ${!isDesktopExpanded && isDesktop && "aspect-square w-11 h-11 p-0"}`}
            >
              <Plus className="w-5 h-5" />
              {(isDesktopExpanded || !isDesktop) && <span>{t("nav.create")}</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-400"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to={currentUser?.role === 'super_admin' ? "/admin-dashboard" : "/"} className="flex items-center gap-2.5">
            <Logo size="sm" showText={true} />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          {currentUser?.role !== 'super_admin' && (
            <Link to={createPageUrl("chat")} className="relative p-2">
              <MessageCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              {unreadMsgCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                </span>
              )}
            </Link>
          )}
          <NotificationBell userEmail={currentUser?.email} />
          {currentUser?.role !== 'super_admin' && (
            <Link to={createPageUrl("cart")} className="p-2">
              <ShoppingBag className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`pt-14 lg:pt-0 ${currentPageName === "Chat" ? "pb-0" : "pb-20"} lg:pb-0 min-h-screen dark:text-slate-100 transition-all duration-300 ${isDesktop && (sidebarOpen ? "lg:ml-64" : "lg:ml-[72px]")}`}>
        <AnnouncementBanner />
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      {currentPageName !== "Chat" && (
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 z-50">
        <div className="flex items-center justify-around h-16 px-2">
          {(currentUser?.role === 'super_admin' ? ADMIN_NAV_ITEMS : NAV_ITEMS).map((item) => {
            const isActive = currentPageName === item.page;
            if (item.accent) {
              return (
                <button
                  key={item.name}
                  onClick={() => setShowCreate(true)}
                  className="w-11 h-11 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-orange-900/40 -mt-4"
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              );
            }
            return (
              <Link
                key={item.name}
                to={item.href || createPageUrl(item.page)}
                className="flex flex-col items-center gap-0.5 relative"
              >
                <item.icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-orange-600 dark:text-orange-400" : "text-slate-400 dark:text-slate-500"
                  }`}
                />
                {item.name === "Cart" && cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center border border-white dark:border-slate-900">
                    {cartItemCount}
                  </span>
                )}
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? "text-orange-600 dark:text-orange-400" : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {item.tKey ? t(item.tKey) : item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}

      <CreateActionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
