import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { adminAPI } from '@/api/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/components/providers/LanguageContext';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  Store, 
  CreditCard, 
  BarChart3, 
  UserX, 
  UserCheck, 
  CheckCircle, 
  AlertCircle,
  Search,
  RefreshCw,
  MoreVertical,
  ShieldAlert,
  ShieldCheck as ShieldCheckIcon,
  Flag,
  History,
  Settings as SettingsIcon,
  Percent,
  Wallet,
  Eye,
  Filter,
  Package,
  Trash2,
  Archive,
  Ban,
  Plus,
  Crown,
  DollarSign
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

const StoreDetailsModal = ({ store, isOpen, onOpenChange, onUpdateStatus, onUpdateVerification, onDelete, products, productsLoading }) => {
  const { t } = useTranslation();
  if (!store) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {store.name}
            {store.is_verified && <ShieldCheckIcon className="w-5 h-5 text-orange-500" />}
          </DialogTitle>
          <DialogDescription>
            {t('admin.storeModal.storeId', { id: store._id })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">{t('admin.storeModal.ownerInfo')}</Label>
              <div className="mt-1 font-medium">@{store.owner_username}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('admin.storeModal.status')}</Label>
              <div className="mt-1">
                <Badge variant={store.status === 'active' ? 'success' : store.status === 'pending' ? 'warning' : 'destructive'}>
                  {store.status}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('admin.storeModal.joinedAt')}</Label>
              <div className="mt-1">{new Date(store.created_at).toLocaleDateString()}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('admin.storeModal.description')}</Label>
              <div className="mt-1 text-sm">{store.description || t('admin.storeModal.noDescription')}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">{t('admin.storeModal.metrics')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">{t('admin.storeModal.orders')}</div>
                  <div className="text-xl font-bold">{store.orders_count || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">{t('admin.storeModal.products')}</div>
                  <div className="text-xl font-bold">{store.products_count || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">{t('admin.storeModal.revenue')}</div>
                  <div className="text-xl font-bold text-success">{formatCurrency(store.total_revenue || 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">{t('admin.storeModal.rating')}</div>
                  <div className="text-xl font-bold">{store.rating_avg || 'N/A'}</div>
                </div>
              </div>
            </div>

            {store.logo_url && (
              <div>
                <Label className="text-muted-foreground">{t('admin.storeModal.logo')}</Label>
                <img 
                  src={store.logo_url} 
                  alt={store.name} 
                  className="mt-2 w-24 h-24 object-cover rounded-md border"
                />
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            {t('admin.storeModal.products')} ({products.length})
          </h4>
          {productsLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t('admin.products.loading')}</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t('admin.storeModal.noProducts')}</div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.products.colProduct')}</TableHead>
                    <TableHead>{t('admin.products.colPrice')}</TableHead>
                    <TableHead>{t('admin.products.colStatus')}</TableHead>
                    <TableHead>{t('admin.products.colSales')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.images && product.images[0] && (
                            <img 
                              src={product.images[0]} 
                              alt={product.title}
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          <div>
                            <div className="font-medium">{product.title}</div>
                            <div className="text-xs text-muted-foreground">{product.category}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(product.price)}</TableCell>
                      <TableCell>
                        <Badge variant={product.status === 'active' ? 'success' : 'outline'}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{product.sales_count || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t pt-4 mt-4">
          <div className="flex-1 flex gap-2">
            {store.status !== 'active' && (
              <Button 
                onClick={() => onUpdateStatus(store._id, 'active')}
                className="bg-success hover:bg-success/90"
              >
                {t('admin.storeModal.approveStore')}
              </Button>
            )}
            {store.status !== 'suspended' && (
              <Button 
                variant="destructive"
                onClick={() => onUpdateStatus(store._id, 'suspended')}
              >
                {t('admin.storeModal.suspendStore')}
              </Button>
            )}
          </div>
          <Button 
            variant="outline"
            onClick={() => onUpdateVerification(store._id, !store.is_verified)}
          >
            {store.is_verified ? t('admin.storeModal.removeVerification') : t('admin.storeModal.verifyStore')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => onDelete(store._id)}
          >
            <Trash2 className="w-4 h-4 mr-2" /> {t('admin.storeModal.deleteStore')}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Users State
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState(null);

  // Stores State
  const [stores, setStores] = useState([]);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [storeLoading, setStoreLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [storePage, setStorePage] = useState(1);
  const [storePagination, setStorePagination] = useState(null);
  const [storeProducts, setStoreProducts] = useState([]);
  const [storeProductsLoading, setStoreProductsLoading] = useState(false);

  // Products State
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [productLoading, setProductLoading] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productPagination, setProductPagination] = useState(null);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPagination, setOrderPagination] = useState(null);

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [withdrawalAction, setWithdrawalAction] = useState('completed');

  // Verifications State
  const [verifications, setVerifications] = useState([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState('pending');
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [verificationReason, setVerificationReason] = useState('');
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationAction, setVerificationAction] = useState('approve');

  // Reports State
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState('pending');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportNotes, setReportNotes] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportAction, setReportAction] = useState('resolved');
  const [contentAction, setContentAction] = useState('none');

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);

  // Announcements State
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    type: 'info',
    target: 'all',
    is_active: true,
    expires_at: ''
  });

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [planPrices, setPlanPrices] = useState({
    free:  { monthly: 0,     annual: 0 },
    pro:   { monthly: 29000, annual: 23000 },
    elite: { monthly: 79000, annual: 63000 },
  });
  const [planPricesSaving, setPlanPricesSaving] = useState(false);

  const fetchPlanPrices = useCallback(async () => {
    try {
      const data = await adminAPI.getSubscriptionPlans();
      if (data?.plans) {
        setPlanPrices({
          free:  { monthly: data.plans.free?.monthly  ?? 0,     annual: data.plans.free?.annual  ?? 0 },
          pro:   { monthly: data.plans.pro?.monthly   ?? 29000, annual: data.plans.pro?.annual   ?? 23000 },
          elite: { monthly: data.plans.elite?.monthly ?? 99000, annual: data.plans.elite?.annual ?? 79000 },
        });
      }
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => { fetchPlanPrices(); }, [fetchPlanPrices]);

  const handleSavePlanPrices = async () => {
    setPlanPricesSaving(true);
    try {
      await adminAPI.updateSubscriptionPlans(planPrices);
      toast({ title: t('common.success'), description: t('admin.subscriptions.pricesSaved') });
    } catch (err) {
      toast({ title: t('common.error'), description: err?.message || t('admin.subscriptions.pricesSaveFailed'), variant: 'destructive' });
    } finally {
      setPlanPricesSaving(false);
    }
  };

  // Posts State
  const [posts, setPosts] = useState([]);
  const [postSearch, setPostSearch] = useState('');
  const [postFilter, setPostFilter] = useState('all');
  const [postLoading, setPostLoading] = useState(false);
  const [postPage, setPostPage] = useState(1);
  const [postPagination, setPostPagination] = useState(null);

  // Settings State
  const [settings, setSettings] = useState({
    maintenance_mode: false,
    maintenance_message: '',
    allow_registration: true,
    min_withdrawal_amount: 10,
    platform_fee_percent: 5,
    subscription_mode: false
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getStats();
      setStats(data);
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.failedFetchStats'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (page = userPage) => {
    try {
      setUserLoading(true);
      const data = await adminAPI.getUsers({ search: userSearch, page, limit: 10 });
      setUsers(data.users);
      setUserPagination(data.pagination);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.users.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setUserLoading(false);
    }
  };

  const fetchStores = async (page = storePage) => {
    try {
      setStoreLoading(true);
      const data = await adminAPI.getStores({ 
        search: storeSearch,
        status: storeFilter === 'all' ? undefined : storeFilter,
        page,
        limit: 10,
      });
      setStores(data.stores);
      setStorePagination(data.pagination);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.stores.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setStoreLoading(false);
    }
  };

  const fetchStoreProducts = async (storeId) => {
    try {
      setStoreProductsLoading(true);
      const data = await adminAPI.getStoreProducts(storeId, { limit: 50 });
      setStoreProducts(data.products || []);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.products.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setStoreProductsLoading(false);
    }
  };

  const fetchProducts = async (page = productPage) => {
    try {
      setProductLoading(true);
      const data = await adminAPI.getProducts({ 
        search: productSearch,
        status: productFilter === 'all' ? undefined : productFilter,
        page,
        limit: 10,
      });
      setProducts(data.products || []);
      setProductPagination(data.pagination);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.products.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setProductLoading(false);
    }
  };

  const fetchOrders = async (page = orderPage) => {
    try {
      setOrderLoading(true);
      const data = await adminAPI.getOrders({ 
        search: orderSearch,
        status: orderFilter === 'all' ? undefined : orderFilter,
        page,
        limit: 10,
      });
      setOrders(data.orders || []);
      setOrderPagination(data.pagination);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.orders.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setOrderLoading(false);
    }
  };

  const fetchWithdrawals = async (filter = withdrawalFilter) => {
    try {
      setWithdrawalLoading(true);
      const data = await adminAPI.getWithdrawals({
        status: filter === 'all' ? undefined : filter,
      });
      setWithdrawals(data.withdrawals || []);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.withdrawals.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const fetchVerifications = async (filter = verificationFilter) => {
    try {
      setVerificationLoading(true);
      const data = await adminAPI.getVerifications({ status: filter });
      setVerifications(data.stores || []);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.verifications.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const fetchReports = async (filter = reportFilter) => {
    try {
      setReportsLoading(true);
      const data = await adminAPI.getReports({
        status: filter === 'all' ? undefined : filter,
      });
      setReports(data.reports || []);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.moderation.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      setActivityLogsLoading(true);
      const data = await adminAPI.getActivityLogs();
      setActivityLogs(data.logs);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.logs.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setActivityLogsLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      const data = await adminAPI.getAnnouncements();
      setAnnouncements(data.announcements || []);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.announcements.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    if (activeTab === 'stores') { setStorePage(1); fetchStores(1); }
  }, [storeFilter]);

  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    if (activeTab === 'products') { setProductPage(1); fetchProducts(1); }
  }, [productFilter]);

  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    if (activeTab === 'orders') { setOrderPage(1); fetchOrders(1); }
  }, [orderFilter]);

  const fetchSubscriptions = async () => {
    try {
      setSubscriptionsLoading(true);
      const data = await adminAPI.getSubscriptions({ search: subscriptionSearch });
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.subscriptions.failedFetch'),
        variant: 'destructive',
      });
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  const fetchPosts = async (page = postPage) => {
    try {
      setPostLoading(true);
      const data = await adminAPI.getPosts({
        search: postSearch,
        visibility: postFilter === 'all' ? undefined : postFilter,
        page,
        limit: 10,
      });
      setPosts(data.posts || []);
      setPostPagination(data.pagination);
    } catch (error) {
      toast({ title: t('common.error'), description: t('admin.posts.failedFetch'), variant: 'destructive' });
    } finally {
      setPostLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'stores') fetchStores();
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'withdrawals') fetchWithdrawals();
    if (activeTab === 'verifications') fetchVerifications();
    if (activeTab === 'moderation') fetchReports();
    if (activeTab === 'logs') fetchActivityLogs();
    if (activeTab === 'subscriptions') fetchSubscriptions();
    if (activeTab === 'announcements') fetchAnnouncements();
    if (activeTab === 'posts') { setPostPage(1); fetchPosts(1); }
  }, [activeTab, user]);

  const handleBlockUser = async (userId, isBlocked) => {
    try {
      await adminAPI.updateUserBlockStatus(userId, !isBlocked);
      toast({
        title: t('common.success'),
        description: isBlocked ? t('admin.users.userUnblockedSuccess') : t('admin.users.userBlockedSuccess'),
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.users.failedUpdateStatus'),
        variant: 'destructive',
      });
    }
  };

  const handleBulkBlockUsers = async (isBlocked) => {
    if (selectedUserIds.length === 0) return;
    try {
      await adminAPI.bulkUpdateUserBlockStatus(selectedUserIds, isBlocked);
      toast({
        title: t('common.success'),
        description: isBlocked
          ? t('admin.users.bulkBlockedSuccess', { count: selectedUserIds.length })
          : t('admin.users.bulkUnblockedSuccess', { count: selectedUserIds.length }),
      });
      setSelectedUserIds([]);
      fetchUsers();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.users.failedUpdateBulk'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStoreStatus = async (storeId, status) => {
    try {
      await adminAPI.updateStoreStatus(storeId, status);
      toast({
        title: t('common.success'),
        description: t('admin.stores.storeStatusUpdated', { status }),
      });
      fetchStores();
      if (selectedStore?._id === storeId) {
        setIsStoreModalOpen(false);
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.stores.failedUpdateStatus'),
        variant: 'destructive',
      });
    }
  };

  const handleBulkUpdateStoreStatus = async (status) => {
    if (selectedStoreIds.length === 0) return;
    try {
      await adminAPI.bulkUpdateStoreStatus(selectedStoreIds, status);
      toast({
        title: t('common.success'),
        description: t('admin.stores.bulkStatusUpdated', { count: selectedStoreIds.length, status }),
      });
      setSelectedStoreIds([]);
      fetchStores();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.stores.failedBulkUpdate'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStoreVerification = async (storeId, isVerified) => {
    try {
      await adminAPI.updateStoreVerification(storeId, isVerified);
      toast({
        title: t('common.success'),
        description: isVerified ? t('admin.stores.verificationEnabled') : t('admin.stores.verificationDisabled'),
      });
      fetchStores();
      if (selectedStore?._id === storeId) {
        setIsStoreModalOpen(false);
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.stores.failedVerification'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdateProductStatus = async (productId, status) => {
    try {
      await adminAPI.updateProductStatus(productId, status);
      toast({
        title: t('common.success'),
        description: t('admin.products.statusUpdated', { status }),
      });
      fetchProducts();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.products.failedUpdateStatus'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm(t('admin.products.confirmDelete'))) return;
    try {
      await adminAPI.deleteProduct(productId);
      toast({
        title: t('common.success'),
        description: t('admin.products.deletedSuccess'),
      });
      fetchProducts();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.products.failedDelete'),
        variant: 'destructive',
      });
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm(t('admin.posts.confirmDelete'))) return;
    try {
      await adminAPI.deletePost(postId);
      toast({ title: t('common.success'), description: t('admin.posts.deletedSuccess') });
      fetchPosts();
    } catch (error) {
      toast({ title: t('common.error'), description: t('admin.posts.failedDelete'), variant: 'destructive' });
    }
  };

  const handleUpdatePostVisibility = async (postId, visibility) => {
    try {
      await adminAPI.updatePostVisibility(postId, visibility);
      toast({ title: t('common.success'), description: t('admin.posts.visibilityUpdated', { visibility }) });
      fetchPosts();
    } catch (error) {
      toast({ title: t('common.error'), description: t('admin.posts.failedUpdateVisibility'), variant: 'destructive' });
    }
  };

  const handleWithdrawalStatus = async (id, status, notes = '') => {
    try {
      await adminAPI.updateWithdrawalStatus(id, status, notes);
      toast({
        title: t('common.success'),
        description: t('admin.withdrawals.statusUpdated', { status }),
      });
      fetchWithdrawals();
      setIsWithdrawalModalOpen(false);
      setWithdrawalNotes('');
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.withdrawals.failedUpdate'),
        variant: 'destructive',
      });
    }
  };

  const handleVerificationAction = async (storeId, action, reason = '') => {
    try {
      await adminAPI.updateVerification(storeId, action, reason);
      toast({
        title: t('common.success'),
        description: action === 'approve' ? t('admin.verifications.approved') : t('admin.verifications.rejected'),
      });
      fetchVerifications();
      setIsVerificationModalOpen(false);
      setVerificationReason('');
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error.message || t('admin.verifications.failedUpdate'),
        variant: 'destructive',
      });
    }
  };

  const handleResolveReport = async (id, status, notes = '', action = 'none') => {
    try {
      await adminAPI.resolveReport(id, status, notes, action);
      toast({
        title: t('common.success'),
        description: t('admin.moderation.reportStatusUpdated', { status }),
      });
      fetchReports();
      setIsReportModalOpen(false);
      setReportNotes('');
      setContentAction('none');
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.moderation.failedResolve'),
        variant: 'destructive',
      });
    }
  };

  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    try {
      if (selectedAnnouncement) {
        await adminAPI.updateAnnouncement(selectedAnnouncement._id, announcementForm);
        toast({ title: t('common.success'), description: t('admin.announcements.updatedSuccess') });
      } else {
        await adminAPI.createAnnouncement(announcementForm);
        toast({ title: t('common.success'), description: t('admin.announcements.createdSuccess') });
      }
      setIsAnnouncementModalOpen(false);
      fetchAnnouncements();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.announcements.failedSave'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm(t('admin.announcements.confirmDelete'))) return;
    try {
      await adminAPI.deleteAnnouncement(id);
      toast({ title: t('common.success'), description: t('admin.announcements.deletedSuccess') });
      fetchAnnouncements();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.announcements.failedDelete'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdateSettings = async (data) => {
    try {
      setSettingsLoading(true);
      const updated = await adminAPI.updateSettings(data);
      setSettings(updated);
      toast({
        title: t('common.success'),
        description: t('admin.settings.updatedSuccess'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.settings.failedUpdate'),
        variant: 'destructive',
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleVerifyUser = async (userId, isVerified) => {
    try {
      await adminAPI.updateUserVerification(userId, !isVerified);
      toast({
        title: t('common.success'),
        description: !isVerified ? t('admin.users.verifiedSuccess') : t('admin.users.unverifiedSuccess'),
      });
      fetchUsers();
    } catch (error) {
      toast({ title: t('common.error'), description: t('admin.users.failedVerify'), variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm(t('admin.users.confirmDelete'))) return;
    try {
      await adminAPI.deleteUser(userId);
      toast({ title: t('common.success'), description: t('admin.users.deletedSuccess') });
      fetchUsers();
    } catch (error) {
      toast({ title: t('common.error'), description: t('admin.users.failedDelete'), variant: 'destructive' });
    }
  };

  const handleDeleteStore = async (storeId) => {
    if (!window.confirm(t('admin.stores.confirmDelete'))) return;
    try {
      await adminAPI.deleteStore(storeId);
      toast({ title: t('common.success'), description: t('admin.stores.deletedSuccess') });
      if (selectedStore?._id === storeId) setIsStoreModalOpen(false);
      fetchStores();
    } catch (error) {
      toast({ title: t('common.error'), description: t('admin.stores.failedDelete'), variant: 'destructive' });
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await adminAPI.updateOrderStatus(orderId, status);
      toast({ title: t('common.success'), description: t('admin.orders.statusUpdated', { status }) });
      fetchOrders();
    } catch (error) {
      toast({ title: t('common.error'), description: t('admin.orders.failedUpdateStatus'), variant: 'destructive' });
    }
  };

  const handleResolveDispute = async (orderId, resolution) => {
    try {
      await adminAPI.resolveOrderDispute(orderId, resolution);
      toast({
        title: t('common.success'),
        description: resolution === 'release' ? t('admin.orders.disputeReleased') : t('admin.orders.disputeRefunded'),
      });
      fetchOrders();
    } catch (error) {
      toast({ title: t('common.error'), description: t('admin.orders.failedResolveDispute'), variant: 'destructive' });
    }
  };

  const PaginationControls = ({ pagination, page, setPage, onFetch }) => {
    if (!pagination || pagination.pages <= 1) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          {t('admin.pagination.showing', {
            from: ((page - 1) * pagination.limit) + 1,
            to: Math.min(page * pagination.limit, pagination.total),
            total: pagination.total,
          })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); onFetch(p); }}
          >
            {t('admin.pagination.previous')}
          </Button>
          <span className="text-sm font-medium">{page} / {pagination.pages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.pages}
            onClick={() => { const p = page + 1; setPage(p); onFetch(p); }}
          >
            {t('admin.pagination.next')}
          </Button>
        </div>
      </div>
    );
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t('admin.accessDenied')}</h1>
        <p className="text-muted-foreground">{t('admin.noPermission')}</p>
        <Button className="mt-6" onClick={() => window.location.href = '/'}>{t('admin.goHome')}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark:bg-[#0a0a0c] bg-slate-50">
      <div className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('admin.title')}</h1>
          <p className="text-muted-foreground">{t('admin.subtitle')}</p>
        </div>
        <Button onClick={fetchStats} disabled={loading} variant="outline" className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('admin.refreshStats')}
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.totalUsers')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.users || 0}</div>
            <p className="text-xs text-muted-foreground">{t('admin.platformUsers')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.activeStores')}</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.stores?.active || 0}</div>
            <p className="text-xs text-muted-foreground">{t('admin.pendingApproval', { count: stats?.counts?.stores?.pending || 0 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.totalProducts')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.products || 0}</div>
            <p className="text-xs text-muted-foreground">{t('admin.liveProducts')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.pendingWithdrawals')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.withdrawals?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">{t('admin.awaitingProcessing')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.pendingReports')}</CardTitle>
            <Flag className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.reports?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">{t('admin.reportsToReview')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.disputedOrders')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.disputed_orders || 0}</div>
            <p className="text-xs text-muted-foreground">{t('admin.awaitingResolution')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.totalSales')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.counts?.total_sales ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{t('admin.totalPlatformVolume')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.platformEarnings')}</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.counts?.platform_earnings ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{t('admin.platformEarningsSub', { fee: stats?.counts?.platform_fee_percent ?? 5 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.subscriptionRevenue')}</CardTitle>
            <Crown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.counts?.subscriptions?.total_revenue ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{t('admin.activeSubscriptions', { count: stats?.counts?.subscriptions?.active || 0 })}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto auto-rows-[auto] lg:grid lg:grid-cols-12 lg:w-auto whitespace-nowrap scrollbar-hide">
          <TabsTrigger value="overview" className="whitespace-nowrap">{t('admin.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="users" className="whitespace-nowrap">{t('admin.tabs.users')}</TabsTrigger>
          <TabsTrigger value="stores" className="whitespace-nowrap">{t('admin.tabs.stores')}</TabsTrigger>
          <TabsTrigger value="products" className="whitespace-nowrap">{t('admin.tabs.products')}</TabsTrigger>
          <TabsTrigger value="posts" className="whitespace-nowrap">{t('admin.tabs.posts')}</TabsTrigger>
          <TabsTrigger value="announcements" className="whitespace-nowrap">{t('admin.tabs.announcements')}</TabsTrigger>
          <TabsTrigger value="subscriptions" className="whitespace-nowrap">{t('admin.tabs.subscriptions')}</TabsTrigger>
          <TabsTrigger value="moderation" className="whitespace-nowrap">{t('admin.tabs.moderation')}</TabsTrigger>
          <TabsTrigger value="orders" className="whitespace-nowrap">{t('admin.tabs.orders')}</TabsTrigger>
          <TabsTrigger value="withdrawals" className="whitespace-nowrap">{t('admin.tabs.withdrawals')}</TabsTrigger>
          <TabsTrigger value="verifications" className="whitespace-nowrap">{t('admin.tabs.verifications')}</TabsTrigger>
          <TabsTrigger value="logs" className="whitespace-nowrap">{t('admin.tabs.logs')}</TabsTrigger>
          <TabsTrigger value="settings" className="whitespace-nowrap">{t('admin.tabs.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('admin.overview.salesTitle')}</CardTitle>
                <CardDescription>{t('admin.overview.salesDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.charts?.sales || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="_id" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <RechartsTooltip 
                      labelFormatter={(val) => new Date(val).toLocaleDateString()}
                      formatter={(val) => [formatCurrency(val), t('admin.overview.salesLabel')]}
                    />
                    <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  {t('admin.overview.recentActivity')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.recent?.activity?.map((log) => (
                    <div key={log._id} className="flex flex-col border-b pb-2 last:border-0">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium">{log.user_id?.display_name || t('admin.overview.adminFallback')}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">
                        {log.action.replace(/_/g, ' ')} 
                        {log.target_type && ` ${t('admin.overview.on', { type: log.target_type })}`}
                      </span>
                    </div>
                  ))}
                  {(!stats?.recent?.activity || stats?.recent?.activity.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('admin.overview.noActivity')}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('admin.overview.recentUsers')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {stats?.recent?.users?.map((u) => (
                    <div key={u._id} className="flex items-center">
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{u.display_name || t('admin.overview.anonymous')}</p>
                        <p className="text-sm text-muted-foreground">@{u.username}</p>
                      </div>
                      <div className="ml-auto font-medium">
                        <Badge variant={u.role === 'super_admin' ? 'default' : u.role === 'vendor' ? 'secondary' : 'outline'}>
                          {u.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>{t('admin.overview.recentStores')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {stats?.recent?.stores?.map((s) => (
                    <div key={s._id} className="flex items-center">
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{s.name}</p>
                        <p className="text-sm text-muted-foreground">@{s.owner_username}</p>
                      </div>
                      <div className="ml-auto">
                        <Badge variant={s.status === 'active' ? 'success' : s.status === 'pending' ? 'warning' : 'destructive'}>
                          {s.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('admin.users.title')}</CardTitle>
                  <CardDescription>{t('admin.users.desc')}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedUserIds.length > 0 && (
                    <div className="flex items-center gap-2 mr-4 bg-muted p-1 px-2 rounded-md">
                      <span className="text-xs font-medium">{t('admin.users.selected', { count: selectedUserIds.length })}</span>
                      <Button size="xs" variant="destructive" className="h-7 px-2" onClick={() => handleBulkBlockUsers(true)}>
                        <Ban className="w-3 h-3 mr-1" /> {t('admin.users.block')}
                      </Button>
                      <Button size="xs" variant="outline" className="h-7 px-2" onClick={() => handleBulkBlockUsers(false)}>
                        <UserCheck className="w-3 h-3 mr-1" /> {t('admin.users.unblock')}
                      </Button>
                      <Button size="xs" variant="ghost" className="h-7 px-2" onClick={() => setSelectedUserIds([])}>
                        {t('admin.users.clear')}
                      </Button>
                    </div>
                  )}
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin.users.searchPlaceholder')}
                      className="pl-8 w-full sm:w-[250px] h-9"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (setUserPage(1), fetchUsers(1))}
                    />
                  </div>
                  <Button onClick={() => { setUserPage(1); fetchUsers(1); }} disabled={userLoading} size="sm" className="h-9">
                    {t('common.search')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={users.length > 0 && selectedUserIds.length === users.length}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedUserIds(users.map(u => u._id));
                          else setSelectedUserIds([]);
                        }}
                      />
                    </TableHead>
                    <TableHead>{t('admin.users.colUser')}</TableHead>
                    <TableHead>{t('admin.users.colEmail')}</TableHead>
                    <TableHead>{t('admin.users.colRole')}</TableHead>
                    <TableHead>{t('admin.users.colStatus')}</TableHead>
                    <TableHead>{t('admin.users.colVerified')}</TableHead>
                    <TableHead>{t('admin.users.colJoined')}</TableHead>
                    <TableHead className="text-right">{t('admin.users.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {userLoading ? t('admin.users.loading') : t('admin.users.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u._id} className={selectedUserIds.includes(u._id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedUserIds.includes(u._id)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedUserIds(prev => [...prev, u._id]);
                              else setSelectedUserIds(prev => prev.filter(id => id !== u._id));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{u.display_name || u.username}</div>
                          <div className="text-xs text-muted-foreground">@{u.username}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'super_admin' ? 'default' : u.role === 'vendor' ? 'secondary' : 'outline'}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.is_blocked ? (
                            <Badge variant="destructive">{t('admin.users.blocked')}</Badge>
                          ) : (
                            <Badge variant="success">{t('admin.users.active')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.is_verified ? (
                            <Badge variant="success" className="bg-orange-500 hover:bg-orange-600">{t('admin.users.verified')}</Badge>
                          ) : (
                            <Badge variant="outline">{t('admin.users.unverified')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>{t('admin.users.actionsLabel')}</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleBlockUser(u._id, u.is_blocked)}>
                                {u.is_blocked ? (
                                  <><UserCheck className="mr-2 h-4 w-4" /> {t('admin.users.unblock')}</>
                                ) : (
                                  <><UserX className="mr-2 h-4 w-4" /> {t('admin.users.block')}</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleVerifyUser(u._id, u.is_verified)}>
                                <ShieldCheckIcon className="mr-2 h-4 w-4 text-orange-500" />
                                {u.is_verified ? t('admin.users.unverifyAccount') : t('admin.users.verifyAccount')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                const roles = ['user', 'vendor', 'super_admin'];
                                const next = roles[(roles.indexOf(u.role) + 1) % roles.length];
                                adminAPI.updateUserRole(u._id, next).then(() => {
                                  toast({ title: t('common.success'), description: t('admin.users.roleChanged', { role: next }) });
                                  fetchUsers();
                                }).catch(() => toast({ title: t('common.error'), description: t('admin.users.failedUpdateRole'), variant: 'destructive' }));
                              }}>
                                <ShieldAlert className="mr-2 h-4 w-4" />
                                {t('admin.users.changeRole')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteUser(u._id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> {t('admin.users.deleteUser')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
              <PaginationControls
                pagination={userPagination}
                page={userPage}
                setPage={setUserPage}
                onFetch={fetchUsers}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('admin.stores.title')}</CardTitle>
                  <CardDescription>{t('admin.stores.desc')}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedStoreIds.length > 0 && (
                    <div className="flex items-center gap-2 mr-4 bg-muted p-1 px-2 rounded-md">
                      <span className="text-xs font-medium">{t('admin.stores.selected', { count: selectedStoreIds.length })}</span>
                      <Button size="xs" variant="success" className="h-7 px-2" onClick={() => handleBulkUpdateStoreStatus('active')}>
                        <CheckCircle className="w-3 h-3 mr-1" /> {t('admin.stores.activate')}
                      </Button>
                      <Button size="xs" variant="destructive" className="h-7 px-2" onClick={() => handleBulkUpdateStoreStatus('suspended')}>
                        <Ban className="w-3 h-3 mr-1" /> {t('admin.stores.suspend')}
                      </Button>
                      <Button size="xs" variant="ghost" className="h-7 px-2" onClick={() => setSelectedStoreIds([])}>
                        {t('admin.stores.clear')}
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mr-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={storeFilter} onValueChange={setStoreFilter}>
                      <SelectTrigger className="w-[130px] h-9">
                        <SelectValue placeholder={t('admin.stores.colStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('admin.stores.allStatus')}</SelectItem>
                        <SelectItem value="active">{t('admin.stores.active')}</SelectItem>
                        <SelectItem value="pending">{t('admin.stores.pending')}</SelectItem>
                        <SelectItem value="suspended">{t('admin.stores.suspended')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin.stores.searchPlaceholder')}
                      className="pl-8 w-full sm:w-[200px] h-9"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (setStorePage(1), fetchStores(1))}
                    />
                  </div>
                  <Button onClick={() => { setStorePage(1); fetchStores(1); }} disabled={storeLoading} size="sm" className="h-9">
                    {t('common.search')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={stores.length > 0 && selectedStoreIds.length === stores.length}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedStoreIds(stores.map(s => s._id));
                          else setSelectedStoreIds([]);
                        }}
                      />
                    </TableHead>
                    <TableHead>{t('admin.stores.colName')}</TableHead>
                    <TableHead>{t('admin.stores.colOwner')}</TableHead>
                    <TableHead>{t('admin.stores.colStatus')}</TableHead>
                    <TableHead>{t('admin.stores.colVerified')}</TableHead>
                    <TableHead>{t('admin.stores.colStats')}</TableHead>
                    <TableHead className="text-right">{t('admin.stores.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t('admin.stores.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stores.map((s) => (
                      <TableRow key={s._id} className={selectedStoreIds.includes(s._id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedStoreIds.includes(s._id)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedStoreIds(prev => [...prev, s._id]);
                              else setSelectedStoreIds(prev => prev.filter(id => id !== s._id));
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{s.name}</span>
                            <span className="text-xs text-muted-foreground font-normal">ID: {s._id.substring(0, 8)}...</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">@{s.owner_username}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'active' ? 'success' : s.status === 'pending' ? 'warning' : 'destructive'}>
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.is_verified ? (
                            <Badge variant="success" className="bg-orange-500 hover:bg-orange-600">{t('admin.stores.verified')}</Badge>
                          ) : (
                            <Badge variant="outline">{t('admin.stores.unverified')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span>{t('admin.stores.productCount', { count: s.products_count || 0 })}</span>
                            <span>{t('admin.stores.orderCount', { count: s.orders_count || 0 })}</span>
                            <span className="text-success font-medium">{formatCurrency(s.total_revenue || 0)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedStore(s);
                                fetchStoreProducts(s._id);
                                setIsStoreModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>{t('admin.stores.manageLabel')}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateStoreStatus(s._id, 'active')}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-success" /> {t('admin.stores.setActive')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateStoreStatus(s._id, 'suspended')}>
                                  <AlertCircle className="w-4 h-4 mr-2 text-destructive" /> {t('admin.stores.suspend')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateStoreVerification(s._id, !s.is_verified)}>
                                  <ShieldCheckIcon className="w-4 h-4 mr-2 text-orange-500" /> 
                                  {s.is_verified ? t('admin.stores.removeVerification') : t('admin.stores.verifyStore')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteStore(s._id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> {t('admin.stores.deleteStore')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
              <PaginationControls
                pagination={storePagination}
                page={storePage}
                setPage={setStorePage}
                onFetch={fetchStores}
              />
            </CardContent>
          </Card>

          <StoreDetailsModal 
            store={selectedStore}
            isOpen={isStoreModalOpen}
            onOpenChange={setIsStoreModalOpen}
            onUpdateStatus={handleUpdateStoreStatus}
            onUpdateVerification={handleUpdateStoreVerification}
            onDelete={handleDeleteStore}
            products={storeProducts}
            productsLoading={storeProductsLoading}
          />
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('admin.products.title')}</CardTitle>
                  <CardDescription>{t('admin.products.desc')}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="product-status" className="text-xs whitespace-nowrap">{t('admin.products.statusLabel')}</Label>
                    <Select value={productFilter} onValueChange={setProductFilter}>
                      <SelectTrigger id="product-status" className="w-[120px] h-9">
                        <SelectValue placeholder={t('admin.products.allStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('admin.products.allStatus')}</SelectItem>
                        <SelectItem value="active">{t('admin.products.active')}</SelectItem>
                        <SelectItem value="draft">{t('admin.products.draft')}</SelectItem>
                        <SelectItem value="sold_out">{t('admin.products.soldOut')}</SelectItem>
                        <SelectItem value="archived">{t('admin.products.archived')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative flex-1 sm:flex-none min-w-[140px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin.products.searchPlaceholder')}
                      className="pl-8 w-full sm:w-[200px] h-9"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (setProductPage(1), fetchProducts(1))}
                    />
                  </div>
                  <Button onClick={() => { setProductPage(1); fetchProducts(1); }} disabled={productLoading} size="sm" className="h-9">
                    {t('common.search')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.products.colProduct')}</TableHead>
                    <TableHead>{t('admin.products.colStore')}</TableHead>
                    <TableHead>{t('admin.products.colPrice')}</TableHead>
                    <TableHead>{t('admin.products.colStatus')}</TableHead>
                    <TableHead>{t('admin.products.colStats')}</TableHead>
                    <TableHead className="text-right">{t('admin.products.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t('admin.products.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((p) => (
                      <TableRow key={p._id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {p.images && p.images[0] ? (
                              <img src={p.images[0]} alt="" className="w-10 h-10 object-cover rounded bg-muted" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="max-w-[200px] truncate">{p.title}</span>
                              <span className="text-xs text-muted-foreground font-normal">ID: {p._id.substring(0, 8)}...</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{p.store_name}</span>
                            <span className="text-xs text-muted-foreground">@{p.vendor_username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">{formatCurrency(p.price)}</span>
                            {p.compare_at_price > p.price && (
                              <span className="text-xs text-muted-foreground line-through">{formatCurrency(p.compare_at_price)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            p.status === 'active' ? 'success' : 
                            p.status === 'draft' ? 'warning' : 
                            p.status === 'sold_out' ? 'destructive' : 'outline'
                          }>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span>{t('admin.products.salesCount', { count: p.sales_count || 0 })}</span>
                            <span>{t('admin.products.viewsCount', { count: p.views_count || 0 })}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>{t('admin.products.menuLabel')}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateProductStatus(p._id, 'active')}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-success" /> {t('admin.products.activate')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateProductStatus(p._id, 'archived')}>
                                  <Archive className="w-4 h-4 mr-2 text-muted-foreground" /> {t('admin.products.archive')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteProduct(p._id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> {t('admin.products.deleteProduct')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
              <PaginationControls
                pagination={productPagination}
                page={productPage}
                setPage={setProductPage}
                onFetch={fetchProducts}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('admin.orders.title')}</CardTitle>
                  <CardDescription>{t('admin.orders.desc')}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={orderFilter} onValueChange={(v) => { setOrderFilter(v); setOrderPage(1); }}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder={t('admin.orders.allStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('admin.orders.allStatus')}</SelectItem>
                        <SelectItem value="pending">{t('admin.orders.pending')}</SelectItem>
                        <SelectItem value="confirmed">{t('admin.orders.confirmed')}</SelectItem>
                        <SelectItem value="processing">{t('admin.orders.processing')}</SelectItem>
                        <SelectItem value="shipped">{t('admin.orders.shipped')}</SelectItem>
                        <SelectItem value="delivered">{t('admin.orders.delivered')}</SelectItem>
                        <SelectItem value="cancelled">{t('admin.orders.cancelled')}</SelectItem>
                        <SelectItem value="refunded">{t('admin.orders.refunded')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative flex-1 sm:flex-none min-w-[140px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin.orders.searchPlaceholder')}
                      className="pl-8 w-full sm:w-[230px] h-9"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchOrders(1)}
                    />
                  </div>
                  <Button onClick={() => fetchOrders(1)} disabled={orderLoading} size="sm" className="h-9">
                    {t('common.search')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.orders.colId')}</TableHead>
                    <TableHead>{t('admin.orders.colBuyer')}</TableHead>
                    <TableHead>{t('admin.orders.colStore')}</TableHead>
                    <TableHead>{t('admin.orders.colAmount')}</TableHead>
                    <TableHead>{t('admin.orders.colStatus')}</TableHead>
                    <TableHead>{t('admin.orders.colPayment')}</TableHead>
                    <TableHead>{t('admin.orders.colDate')}</TableHead>
                    <TableHead className="text-right">{t('admin.orders.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {orderLoading ? t('admin.orders.loading') : t('admin.orders.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((o) => (
                      <TableRow key={o._id}>
                        <TableCell className="font-mono text-xs">{o._id.substring(0, 8)}...</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">@{o.buyer_username}</span>
                            <span className="text-xs text-muted-foreground">{o.buyer_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{o.store_name}</span>
                            <span className="text-xs text-muted-foreground">@{o.vendor_username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(o.total)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            o.status === 'delivered' ? 'success' :
                            o.status === 'cancelled' || o.status === 'refunded' ? 'destructive' :
                            o.status === 'pending' ? 'warning' : 'default'
                          }>
                            {o.status}
                          </Badge>
                          {o.buyer_confirmation_status === 'disputed' && (
                            <Badge variant="destructive" className="ml-1">{t('admin.orders.disputed')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.payment_status === 'paid' ? 'success' : o.payment_status === 'failed' ? 'destructive' : 'warning'} className="capitalize">
                            {o.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>{t('admin.orders.menuLabel')}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  disabled={o.status === s}
                                  onClick={() => handleUpdateOrderStatus(o._id, s)}
                                  className="capitalize"
                                >
                                  {s}
                                </DropdownMenuItem>
                              ))}
                              {o.buyer_confirmation_status === 'disputed' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel>{t('admin.orders.disputeLabel')}</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleResolveDispute(o._id, 'release')} className="text-success">
                                    {t('admin.orders.releaseFunds')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleResolveDispute(o._id, 'refund')} className="text-destructive">
                                    {t('admin.orders.refundBuyer')}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
              <PaginationControls
                pagination={orderPagination}
                page={orderPage}
                setPage={setOrderPage}
                onFetch={fetchOrders}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle>{t('admin.withdrawals.title')}</CardTitle>
                <CardDescription>{t('admin.withdrawals.desc')}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={withdrawalFilter} onValueChange={(v) => { setWithdrawalFilter(v); fetchWithdrawals(v); }}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder={t('admin.withdrawals.allStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.withdrawals.allStatus')}</SelectItem>
                    <SelectItem value="pending">{t('admin.withdrawals.pending')}</SelectItem>
                    <SelectItem value="processing">{t('admin.withdrawals.processing')}</SelectItem>
                    <SelectItem value="completed">{t('admin.withdrawals.completed')}</SelectItem>
                    <SelectItem value="rejected">{t('admin.withdrawals.rejected')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => fetchWithdrawals(withdrawalFilter)} disabled={withdrawalLoading} variant="ghost" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${withdrawalLoading ? 'animate-spin' : ''}`} />
                  {t('common.refresh')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.withdrawals.colVendor')}</TableHead>
                    <TableHead>{t('admin.withdrawals.colAmount')}</TableHead>
                    <TableHead>{t('admin.withdrawals.colMethod')}</TableHead>
                    <TableHead>{t('admin.withdrawals.colStatus')}</TableHead>
                    <TableHead>{t('admin.withdrawals.colDate')}</TableHead>
                    <TableHead className="text-right">{t('admin.withdrawals.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t('admin.withdrawals.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    withdrawals.map((w) => (
                      <TableRow key={w._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm">@{w.vendor_username}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                {w.payee_type === 'affiliate' ? t('admin.withdrawals.affiliate') : t('admin.withdrawals.vendor')}
                              </Badge>
                            </div>
                            {w.notes && (
                              <span className="text-xs text-muted-foreground italic truncate max-w-[200px]" title={w.notes}>
                                {t('admin.withdrawals.noteLabel', { note: w.notes })}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-success">{formatCurrency(w.amount)}</TableCell>
                        <TableCell className="capitalize">
                          <Badge variant="outline" className="font-normal">
                            {w.payment_method?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            w.status === 'completed' ? 'success' : 
                            w.status === 'pending' ? 'warning' : 
                            w.status === 'rejected' ? 'destructive' : 'default'
                          }>
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(w.created_at).toLocaleDateString()}<br/>
                          {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="text-right">
                          {w.status === 'pending' && (
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-success border-success/20 hover:bg-success/10 h-8" 
                                onClick={() => {
                                  setSelectedWithdrawal(w);
                                  setWithdrawalAction('completed');
                                  setWithdrawalNotes('');
                                  setIsWithdrawalModalOpen(true);
                                }}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> {t('admin.withdrawals.approve')}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-destructive border-destructive/20 hover:bg-destructive/10 h-8" 
                                onClick={() => {
                                  setSelectedWithdrawal(w);
                                  setWithdrawalAction('rejected');
                                  setWithdrawalNotes('');
                                  setIsWithdrawalModalOpen(true);
                                }}
                              >
                                <AlertCircle className="w-4 h-4 mr-1" /> {t('admin.withdrawals.reject')}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Dialog open={isWithdrawalModalOpen} onOpenChange={setIsWithdrawalModalOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{withdrawalAction === 'completed' ? t('admin.withdrawals.approveTitle') : t('admin.withdrawals.rejectTitle')}</DialogTitle>
                <DialogDescription>
                  {t('admin.withdrawals.reviewDesc', { vendor: selectedWithdrawal?.vendor_username, amount: formatCurrency(selectedWithdrawal?.amount) })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="notes">{t('admin.withdrawals.adminNotes')}</Label>
                  <Textarea
                    id="notes"
                    placeholder={withdrawalAction === 'completed' ? t('admin.withdrawals.approvedPlaceholder') : t('admin.withdrawals.rejectedPlaceholder')}
                    value={withdrawalNotes}
                    onChange={(e) => setWithdrawalNotes(e.target.value)}
                    className="h-24"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsWithdrawalModalOpen(false)}>{t('common.cancel')}</Button>
                <Button 
                  variant={withdrawalAction === 'completed' ? 'success' : 'destructive'}
                  onClick={() => handleWithdrawalStatus(selectedWithdrawal?._id, withdrawalAction, withdrawalNotes)}
                >
                  {withdrawalAction === 'completed' ? t('admin.withdrawals.confirmApproval') : t('admin.withdrawals.confirmRejection')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="verifications" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle>{t('admin.verifications.title')}</CardTitle>
                <CardDescription>{t('admin.verifications.desc')}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={verificationFilter} onValueChange={(v) => { setVerificationFilter(v); fetchVerifications(v); }}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder={t('admin.verifications.allStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.verifications.allStatus')}</SelectItem>
                    <SelectItem value="pending">{t('admin.verifications.pending')}</SelectItem>
                    <SelectItem value="approved">{t('admin.verifications.approved')}</SelectItem>
                    <SelectItem value="rejected">{t('admin.verifications.rejected')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => fetchVerifications(verificationFilter)} disabled={verificationLoading} variant="ghost" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${verificationLoading ? 'animate-spin' : ''}`} />
                  {t('common.refresh')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.verifications.colStore')}</TableHead>
                    <TableHead>{t('admin.verifications.colDocument')}</TableHead>
                    <TableHead>{t('admin.verifications.colImage')}</TableHead>
                    <TableHead>{t('admin.verifications.colStatus')}</TableHead>
                    <TableHead>{t('admin.verifications.colDate')}</TableHead>
                    <TableHead className="text-right">{t('admin.verifications.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t('admin.verifications.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    verifications.map((v) => (
                      <TableRow key={v._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{v.name}</span>
                            <span className="text-xs text-muted-foreground">@{v.owner_username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-sm">
                          {v.identity_document_type?.replace('_', ' ') || '—'}
                          <div className="text-xs text-muted-foreground">{v.identity_document_number}</div>
                        </TableCell>
                        <TableCell>
                          {v.identity_document_image_url ? (
                            <a href={v.identity_document_image_url} target="_blank" rel="noreferrer">
                              <img src={v.identity_document_image_url} alt="" className="w-12 h-12 object-cover rounded-lg border" />
                            </a>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            v.verification_status === 'approved' ? 'success' :
                            v.verification_status === 'pending' ? 'warning' :
                            v.verification_status === 'rejected' ? 'destructive' : 'default'
                          }>
                            {v.verification_status}
                          </Badge>
                          {v.verification_status === 'rejected' && v.identity_rejection_reason && (
                            <div className="text-xs text-muted-foreground italic mt-1 max-w-[160px] truncate" title={v.identity_rejection_reason}>
                              {v.identity_rejection_reason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {v.identity_submitted_at ? new Date(v.identity_submitted_at).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.verification_status === 'pending' && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-success border-success/20 hover:bg-success/10 h-8"
                                onClick={() => {
                                  setSelectedVerification(v);
                                  setVerificationAction('approve');
                                  setVerificationReason('');
                                  setIsVerificationModalOpen(true);
                                }}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> {t('admin.verifications.approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/20 hover:bg-destructive/10 h-8"
                                onClick={() => {
                                  setSelectedVerification(v);
                                  setVerificationAction('reject');
                                  setVerificationReason('');
                                  setIsVerificationModalOpen(true);
                                }}
                              >
                                <AlertCircle className="w-4 h-4 mr-1" /> {t('admin.verifications.reject')}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{verificationAction === 'approve' ? t('admin.verifications.approveTitle') : t('admin.verifications.rejectTitle')}</DialogTitle>
                <DialogDescription>
                  {t('admin.verifications.reviewDesc', { store: selectedVerification?.name, owner: selectedVerification?.owner_username })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="verification-reason">
                    {verificationAction === 'approve' ? t('admin.verifications.adminNotes') : t('admin.verifications.rejectionReason')}
                  </Label>
                  <Textarea
                    id="verification-reason"
                    placeholder={verificationAction === 'approve' ? t('admin.verifications.approvedPlaceholder') : t('admin.verifications.rejectedPlaceholder')}
                    value={verificationReason}
                    onChange={(e) => setVerificationReason(e.target.value)}
                    className="h-24"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsVerificationModalOpen(false)}>{t('common.cancel')}</Button>
                <Button
                  variant={verificationAction === 'approve' ? 'success' : 'destructive'}
                  disabled={verificationAction === 'reject' && !verificationReason.trim()}
                  onClick={() => handleVerificationAction(selectedVerification?._id, verificationAction, verificationReason)}
                >
                  {verificationAction === 'approve' ? t('admin.verifications.confirmApproval') : t('admin.verifications.confirmRejection')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          {/* Plan Pricing Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> {t('admin.subscriptions.pricingTitle')}</CardTitle>
              <CardDescription>{t('admin.subscriptions.pricingDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {[{id:'pro',label:'Pro'},{id:'elite',label:'Elite'}].map(plan => (
                  <div key={plan.id} className="space-y-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{plan.label} {t('admin.subscriptions.planPrices')}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500 mb-1 block">{t('admin.subscriptions.monthly')} (RWF)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={planPrices[plan.id]?.monthly ?? 0}
                          onChange={e => setPlanPrices(prev => ({ ...prev, [plan.id]: { ...prev[plan.id], monthly: Number(e.target.value) } }))}
                          className="rounded-lg h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 mb-1 block">{t('admin.subscriptions.annual')} (RWF)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={planPrices[plan.id]?.annual ?? 0}
                          onChange={e => setPlanPrices(prev => ({ ...prev, [plan.id]: { ...prev[plan.id], annual: Number(e.target.value) } }))}
                          className="rounded-lg h-9"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={handleSavePlanPrices} disabled={planPricesSaving} className="mt-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl">
                {t('admin.subscriptions.savePrices')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('admin.subscriptions.title')}</CardTitle>
                  <CardDescription>{t('admin.subscriptions.desc')}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin.subscriptions.searchPlaceholder')}
                      className="pl-8 w-full sm:w-[250px] h-9"
                      value={subscriptionSearch}
                      onChange={(e) => setSubscriptionSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchSubscriptions()}
                    />
                  </div>
                  <Button onClick={fetchSubscriptions} disabled={subscriptionsLoading} size="sm" className="h-9">
                    {t('common.search')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.subscriptions.colVendor')}</TableHead>
                    <TableHead>{t('admin.subscriptions.colRole')}</TableHead>
                    <TableHead>{t('admin.subscriptions.colPlan')}</TableHead>
                    <TableHead>{t('admin.subscriptions.colStatus')}</TableHead>
                    <TableHead>{t('admin.subscriptions.colAmount')}</TableHead>
                    <TableHead>{t('admin.subscriptions.colExpires')}</TableHead>
                    <TableHead className="text-right">{t('admin.subscriptions.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {subscriptionsLoading ? t('admin.subscriptions.loading') : t('admin.subscriptions.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    subscriptions.map((sub) => (
                      <TableRow key={sub._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">@{sub.vendor_username}</span>
                            <span className="text-xs text-muted-foreground">{t('admin.subscriptions.storeId', { id: sub.store_id })}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sub.user_role === 'super_admin' ? 'destructive' : sub.user_role === 'vendor' ? 'success' : 'secondary'} className="capitalize">
                            {sub.user_role || 'user'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {sub.plan_id?.name || sub.plan_name || sub.plan || 'Standard'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            sub.status === 'active' ? 'success' : 
                            sub.status === 'expired' ? 'destructive' : 
                            sub.status === 'cancelled' ? 'secondary' : 'warning'
                          }>
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(sub.amount || 0)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : t('admin.subscriptions.never')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>{t('admin.subscriptions.menuLabel')}</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => {
                                if (confirm(t('admin.subscriptions.cancelConfirm'))) {
                                  adminAPI.cancelSubscription(sub._id).then(() => {
                                    toast({ title: t('common.success'), description: t('admin.subscriptions.cancelledSuccess') });
                                    fetchSubscriptions();
                                  });
                                }
                              }}>
                                <UserX className="w-4 h-4 mr-2" /> {t('admin.subscriptions.cancelSubscription')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle>{t('admin.moderation.title')}</CardTitle>
                <CardDescription>{t('admin.moderation.desc')}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={reportFilter} onValueChange={(v) => { setReportFilter(v); fetchReports(v); }}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder={t('admin.moderation.allReports')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.moderation.allReports')}</SelectItem>
                    <SelectItem value="pending">{t('admin.moderation.pending')}</SelectItem>
                    <SelectItem value="resolved">{t('admin.moderation.resolved')}</SelectItem>
                    <SelectItem value="dismissed">{t('admin.moderation.dismissed')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => fetchReports(reportFilter)} disabled={reportsLoading} variant="ghost" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${reportsLoading ? 'animate-spin' : ''}`} />
                  {t('common.refresh')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.moderation.colType')}</TableHead>
                    <TableHead>{t('admin.moderation.colReason')}</TableHead>
                    <TableHead>{t('admin.moderation.colContent')}</TableHead>
                    <TableHead>{t('admin.moderation.colReporter')}</TableHead>
                    <TableHead>{t('admin.moderation.colStatus')}</TableHead>
                    <TableHead>{t('admin.moderation.colDate')}</TableHead>
                    <TableHead className="text-right">{t('admin.moderation.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t('admin.moderation.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((r) => (
                      <TableRow key={r._id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{r.target_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium truncate max-w-[200px]" title={r.description}>
                              {r.reason}
                            </span>
                            {r.admin_notes && (
                              <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                                {t('admin.moderation.adminNoteLabel', { notes: r.admin_notes })}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.target_summary ? (
                            <div className="flex flex-col gap-0.5 max-w-[180px]">
                              <a
                                href={r.target_type === 'post' ? `/postdetail?id=${r.target_id}` : `/productdetail?id=${r.target_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate hover:underline"
                                title={r.target_summary.title}
                              >
                                {r.target_summary.title}
                              </a>
                              {!r.target_summary.active && (
                                <Badge variant="secondary" className="w-fit text-[10px]">
                                  {t('admin.moderation.contentInactive')}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.reporter_id?.display_name || t('admin.moderation.system')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            r.status === 'resolved' ? 'success' : 
                            r.status === 'dismissed' ? 'secondary' : 'warning'
                          }>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === 'pending' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>{t('admin.moderation.menuLabel')}</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedReport(r);
                                  setReportAction('resolved');
                                  setReportNotes('');
                                  setContentAction('none');
                                  setIsReportModalOpen(true);
                                }}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-success" /> {t('admin.moderation.resolve')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedReport(r);
                                  setReportAction('dismissed');
                                  setReportNotes('');
                                  setContentAction('none');
                                  setIsReportModalOpen(true);
                                }}>
                                  <AlertCircle className="w-4 h-4 mr-2 text-muted-foreground" /> {t('admin.moderation.dismiss')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{reportAction === 'resolved' ? t('admin.moderation.resolveTitle') : t('admin.moderation.dismissTitle')}</DialogTitle>
                <DialogDescription>
                  {reportAction === 'resolved'
                    ? t('admin.moderation.resolveDesc', { type: selectedReport?.target_type })
                    : t('admin.moderation.dismissDesc', { type: selectedReport?.target_type })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="p-3 bg-muted rounded-md text-sm">
                  <div className="font-semibold">{selectedReport?.reason}</div>
                  <div className="mt-1 text-muted-foreground">{selectedReport?.description}</div>
                  {selectedReport?.target_summary && (
                    <div className="mt-2 pt-2 border-t text-muted-foreground truncate">
                      {t('admin.moderation.reportedContentLabel')}: {selectedReport.target_summary.title}
                    </div>
                  )}
                </div>
                {reportAction === 'resolved' && ['post', 'product'].includes(selectedReport?.target_type) && (
                  <div className="space-y-2">
                    <Label htmlFor="content-action">{t('admin.moderation.contentAction')}</Label>
                    <Select value={contentAction} onValueChange={setContentAction}>
                      <SelectTrigger id="content-action">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('admin.moderation.contentActionNone')}</SelectItem>
                        <SelectItem value="deactivate">{t('admin.moderation.contentActionDeactivate')}</SelectItem>
                        <SelectItem value="remove">{t('admin.moderation.contentActionRemove')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="report-notes">{t('admin.moderation.adminNotes')}</Label>
                  <Textarea
                    id="report-notes"
                    placeholder={t('admin.moderation.notesPlaceholder')}
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    className="h-24"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsReportModalOpen(false)}>{t('common.cancel')}</Button>
                <Button 
                  variant={reportAction === 'resolved' ? 'success' : 'secondary'}
                  onClick={() => handleResolveReport(selectedReport?._id, reportAction, reportNotes, contentAction)}
                >
                  {reportAction === 'resolved' ? t('admin.moderation.confirmResolution') : t('admin.moderation.confirmDismissal')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="posts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                {t('admin.posts.title')}
              </CardTitle>
              <CardDescription>{t('admin.posts.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('admin.posts.searchPlaceholder')}
                    value={postSearch}
                    onChange={(e) => setPostSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setPostPage(1); fetchPosts(1); } }}
                    className="pl-8"
                  />
                </div>
                <Select value={postFilter} onValueChange={(v) => { setPostFilter(v); setPostPage(1); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder={t('admin.posts.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.posts.all')}</SelectItem>
                    <SelectItem value="public">{t('admin.posts.public')}</SelectItem>
                    <SelectItem value="followers">{t('admin.posts.followers')}</SelectItem>
                    <SelectItem value="community">{t('admin.posts.community')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => { setPostPage(1); fetchPosts(1); }} disabled={postLoading}>
                  <Search className="w-4 h-4 mr-1" /> {t('common.search')}
                </Button>
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.posts.colAuthor')}</TableHead>
                    <TableHead>{t('admin.posts.colContent')}</TableHead>
                    <TableHead>{t('admin.posts.colType')}</TableHead>
                    <TableHead>{t('admin.posts.colVisibility')}</TableHead>
                    <TableHead>{t('admin.posts.colLikes')}</TableHead>
                    <TableHead>{t('admin.posts.colComments')}</TableHead>
                    <TableHead>{t('admin.posts.colDate')}</TableHead>
                    <TableHead>{t('admin.posts.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8">{t('common.loading')}</TableCell></TableRow>
                  ) : posts.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t('admin.posts.empty')}</TableCell></TableRow>
                  ) : posts.map((post) => (
                    <TableRow key={post._id}>
                      <TableCell>
                        <div className="font-medium">@{post.author_username}</div>
                        {post.author_name && <div className="text-xs text-muted-foreground">{post.author_name}</div>}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm">{post.content || <span className="text-muted-foreground italic">{t('admin.posts.noText')}</span>}</p>
                        {post.media_urls?.length > 0 && (
                          <span className="text-xs text-muted-foreground">{t('admin.posts.mediaFiles', { count: post.media_urls.length })}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{post.media_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={post.visibility === 'public' ? 'default' : post.visibility === 'followers' ? 'secondary' : 'outline'} className="capitalize">
                          {post.visibility}
                        </Badge>
                      </TableCell>
                      <TableCell>{post.likes_count}</TableCell>
                      <TableCell>{post.comments_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('admin.posts.menuLabel')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleUpdatePostVisibility(post._id, 'public')}>
                              {t('admin.posts.setPublic')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdatePostVisibility(post._id, 'followers')}>
                              {t('admin.posts.setFollowers')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdatePostVisibility(post._id, 'community')}>
                              {t('admin.posts.setCommunity')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeletePost(post._id)}>
                              <Trash2 className="w-4 h-4 mr-2" /> {t('admin.posts.deletePost')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              {postPagination && postPagination.pages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('admin.posts.showingCount', { count: posts.length, total: postPagination.total })}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={postPage <= 1} onClick={() => { setPostPage(p => p - 1); fetchPosts(postPage - 1); }}>{t('admin.posts.previous')}</Button>
                    <span className="text-sm px-2 py-1">{t('admin.posts.pageOf', { page: postPage, pages: postPagination.pages })}</span>
                    <Button variant="outline" size="sm" disabled={postPage >= postPagination.pages} onClick={() => { setPostPage(p => p + 1); fetchPosts(postPage + 1); }}>{t('admin.posts.next')}</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>{t('admin.announcements.title')}</CardTitle>
                  <CardDescription>{t('admin.announcements.desc')}</CardDescription>
                </div>
                <Button onClick={() => {
                  setSelectedAnnouncement(null);
                  setAnnouncementForm({
                    title: '',
                    content: '',
                    type: 'info',
                    target: 'all',
                    is_active: true,
                    expires_at: ''
                  });
                  setIsAnnouncementModalOpen(true);
                }} size="sm" className="shrink-0 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {t('admin.announcements.newButton')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.announcements.colAnnouncement')}</TableHead>
                    <TableHead>{t('admin.announcements.colTarget')}</TableHead>
                    <TableHead>{t('admin.announcements.colType')}</TableHead>
                    <TableHead>{t('admin.announcements.colStatus')}</TableHead>
                    <TableHead>{t('admin.announcements.colExpires')}</TableHead>
                    <TableHead className="text-right">{t('admin.announcements.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t('admin.announcements.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    announcements.map((a) => (
                      <TableRow key={a._id}>
                        <TableCell>
                          <div className="font-medium">{a.title}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">{a.content}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{a.target}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            a.type === 'info' ? 'default' : 
                            a.type === 'warning' ? 'warning' : 
                            a.type === 'error' ? 'destructive' : 'success'
                          } className="capitalize">
                            {a.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {a.is_active ? (
                            <Badge variant="success">{t('admin.announcements.active')}</Badge>
                          ) : (
                            <Badge variant="outline">{t('admin.announcements.inactive')}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : t('admin.announcements.never')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedAnnouncement(a);
                                setAnnouncementForm({
                                  title: a.title,
                                  content: a.content,
                                  type: a.type,
                                  target: a.target,
                                  is_active: a.is_active,
                                  expires_at: a.expires_at ? new Date(a.expires_at).toISOString().split('T')[0] : ''
                                });
                                setIsAnnouncementModalOpen(true);
                              }}
                            >
                              <SettingsIcon className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-destructive"
                              onClick={() => handleDeleteAnnouncement(a._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Dialog open={isAnnouncementModalOpen} onOpenChange={setIsAnnouncementModalOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{selectedAnnouncement ? t('admin.announcements.editTitle') : t('admin.announcements.createTitle')}</DialogTitle>
                <DialogDescription>
                  {t('admin.announcements.dialogDesc')}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveAnnouncement} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="title">{t('admin.announcements.titleLabel')}</Label>
                  <Input 
                    id="title" 
                    placeholder={t('admin.announcements.titlePlaceholder')}
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">{t('admin.announcements.contentLabel')}</Label>
                  <Textarea 
                    id="content" 
                    placeholder={t('admin.announcements.contentPlaceholder')}
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                    required
                    className="h-24"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">{t('admin.announcements.typeLabel')}</Label>
                    <Select 
                      value={announcementForm.type} 
                      onValueChange={(v) => setAnnouncementForm({...announcementForm, type: v})}
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">{t('admin.announcements.information')}</SelectItem>
                        <SelectItem value="warning">{t('admin.announcements.warning')}</SelectItem>
                        <SelectItem value="success">{t('admin.announcements.success')}</SelectItem>
                        <SelectItem value="error">{t('admin.announcements.critical')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target">{t('admin.announcements.targetLabel')}</Label>
                    <Select 
                      value={announcementForm.target} 
                      onValueChange={(v) => setAnnouncementForm({...announcementForm, target: v})}
                    >
                      <SelectTrigger id="target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('admin.announcements.everyone')}</SelectItem>
                        <SelectItem value="vendors">{t('admin.announcements.vendorsOnly')}</SelectItem>
                        <SelectItem value="users">{t('admin.announcements.usersOnly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expires">{t('admin.announcements.expiryLabel')}</Label>
                    <Input 
                      id="expires" 
                      type="date" 
                      value={announcementForm.expires_at}
                      onChange={(e) => setAnnouncementForm({...announcementForm, expires_at: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-8">
                    <Switch 
                      id="is-active" 
                      checked={announcementForm.is_active}
                      onCheckedChange={(v) => setAnnouncementForm({...announcementForm, is_active: v})}
                    />
                    <Label htmlFor="is-active">{t('admin.announcements.activeLabel')}</Label>
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsAnnouncementModalOpen(false)}>{t('common.cancel')}</Button>
                  <Button type="submit">
                    {selectedAnnouncement ? t('admin.announcements.updateBtn') : t('admin.announcements.publishBtn')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.logs.title')}</CardTitle>
              <CardDescription>{t('admin.logs.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.logs.colAdmin')}</TableHead>
                    <TableHead>{t('admin.logs.colAction')}</TableHead>
                    <TableHead>{t('admin.logs.colTarget')}</TableHead>
                    <TableHead>{t('admin.logs.colIp')}</TableHead>
                    <TableHead>{t('admin.logs.colDate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {activityLogsLoading ? t('admin.logs.loading') : t('admin.logs.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    activityLogs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell>
                          <div className="font-medium">{log.user_id?.display_name || t('admin.logs.internal')}</div>
                          <div className="text-[10px] text-muted-foreground">{log.user_id?.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs capitalize">{log.target_type || '-'}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.ip_address || t('admin.logs.internal')}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                {t('admin.settings.title')}
              </CardTitle>
              <CardDescription>{t('admin.settings.desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('admin.settings.securityTitle')}</h3>
                <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-slate-50/50">
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="maintenance-mode" className="text-base flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-orange-500" />
                      {t('admin.settings.maintenanceLabel')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('admin.settings.maintenanceDesc')}
                    </p>
                  </div>
                  <Switch
                    id="maintenance-mode"
                    checked={settings.maintenance_mode}
                    onCheckedChange={(checked) => handleUpdateSettings({ maintenance_mode: checked })}
                    disabled={settingsLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maintenance-message">{t('admin.settings.maintenanceMsgLabel')}</Label>
                  <Textarea
                    id="maintenance-message"
                    placeholder={t('admin.settings.maintenanceMsgPlaceholder')}
                    value={settings.maintenance_message}
                    onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })}
                    className="min-h-[100px]"
                  />
                  <Button 
                    onClick={() => handleUpdateSettings({ maintenance_message: settings.maintenance_message })}
                    disabled={settingsLoading}
                    size="sm"
                  >
                    {t('admin.settings.saveMessage')}
                  </Button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">{t('admin.settings.subscriptionTitle')}</h3>
                <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="subscription-mode" className="text-base flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      {t('admin.settings.subscriptionModeLabel')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {settings.subscription_mode
                        ? t('admin.settings.subscriptionEnabled')
                        : t('admin.settings.subscriptionDisabled')}
                    </p>
                  </div>
                  <Switch
                    id="subscription-mode"
                    checked={settings.subscription_mode ?? false}
                    onCheckedChange={(checked) => handleUpdateSettings({ subscription_mode: checked })}
                    disabled={settingsLoading}
                  />
                </div>
                {!settings.subscription_mode && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                    {t('admin.settings.subscriptionWarning')}
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">{t('admin.settings.policiesTitle')}</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-slate-50/50">
                    <div className="flex flex-col space-y-1">
                      <Label htmlFor="allow-reg" className="text-base">{t('admin.settings.registrationLabel')}</Label>
                      <p className="text-xs text-muted-foreground">{t('admin.settings.registrationDesc')}</p>
                    </div>
                    <Switch
                      id="allow-reg"
                      checked={settings.allow_registration}
                      onCheckedChange={(checked) => handleUpdateSettings({ allow_registration: checked })}
                      disabled={settingsLoading}
                    />
                  </div>

                  <div className="space-y-2 border p-4 rounded-lg bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-4 h-4 text-orange-500" />
                      <Label htmlFor="min-withdrawal">{t('admin.settings.minWithdrawal')}</Label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="min-withdrawal"
                        type="number"
                        value={settings.min_withdrawal_amount}
                        onChange={(e) => setSettings({ ...settings, min_withdrawal_amount: parseFloat(e.target.value) })}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdateSettings({ min_withdrawal_amount: settings.min_withdrawal_amount })}
                        disabled={settingsLoading}
                      >
                        {t('admin.settings.update')}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 border p-4 rounded-lg bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Percent className="w-4 h-4 text-emerald-500" />
                      <Label htmlFor="fee-percent">{t('admin.settings.platformFee')}</Label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="fee-percent"
                        type="number"
                        value={settings.platform_fee_percent}
                        onChange={(e) => setSettings({ ...settings, platform_fee_percent: parseFloat(e.target.value) })}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdateSettings({ platform_fee_percent: settings.platform_fee_percent })}
                        disabled={settingsLoading}
                      >
                        {t('admin.settings.update')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
