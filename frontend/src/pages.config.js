/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AIAssistant from './pages/AIAssistant';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Bookmarks from './pages/Bookmarks';
import Settings from './pages/Settings';
import Affiliate from './pages/Affiliate';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Chat from './pages/Chat';
import Communities from './pages/Communities';
import CommunityDetail from './pages/CommunityDetail';
import CreatePost from './pages/CreatePost';
import Explore from './pages/Explore';
import Home from './pages/Home';
import Live from './pages/Live';
import Marketplace from './pages/Marketplace';
import MyStore from './pages/MyStore';
import Notifications from './pages/Notifications';
import OrderTracking from './pages/OrderTracking';
import Orders from './pages/Orders';
import PostDetail from './pages/PostDetail';
import ProductDetail from './pages/ProductDetail';
import Profile from './pages/Profile';
import StoreDetail from './pages/StoreDetail';
import Wishlist from './pages/Wishlist';
import VendorFinance from './pages/VendorFinance';
import PaymentSuccess from './pages/PaymentSuccess';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import Support from './pages/Support';
import LandingPage from './pages/LandingPage';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAssistant": AIAssistant,
    "Cart": Cart,
    "Checkout": Checkout,
    "Bookmarks": Bookmarks,
    "Settings": Settings,
    "Affiliate": Affiliate,
    "ForgotPassword": ForgotPassword,
    "ResetPassword": ResetPassword,
    "Chat": Chat,
    "Communities": Communities,
    "CommunityDetail": CommunityDetail,
    "CreatePost": CreatePost,
    "Explore": Explore,
    "Home": Home,
    "Live": Live,
    "Marketplace": Marketplace,
    "MyStore": MyStore,
    "Notifications": Notifications,
    "OrderTracking": OrderTracking,
    "Orders": Orders,
    "PostDetail": PostDetail,
    "ProductDetail": ProductDetail,
    "Profile": Profile,
    "StoreDetail": StoreDetail,
    "Wishlist": Wishlist,
    "VendorFinance": VendorFinance,
    "PaymentSuccess": PaymentSuccess,
    "Login": Login,
    "Register": Register,
    "AdminDashboard": AdminDashboard,
    "Support": Support,
    "LandingPage": LandingPage,
    "Terms": Terms,
    "Privacy": Privacy,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};