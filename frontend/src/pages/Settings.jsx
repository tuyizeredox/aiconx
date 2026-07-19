import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { authAPI } from "@/api/apiClient";
import { uploadAvatar } from "@/lib/storage";
import { createPageUrl } from "@/lib/utils";
import SubscriptionManager from "@/components/mystore/SubscriptionManager";
import AvatarImg from "@/components/shared/AvatarImg";
import BackLink from "@/components/shared/BackLink";
import { useAuth } from "@/lib/AuthContext";
import {
  User, Lock, Bell, Camera, Loader2,
  ChevronRight, LogOut, Shield, Smartphone,
  Globe, Moon, Mail, CreditCard, LayoutGrid,
  DollarSign, Link2, Heart, Bookmark, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useLang, useTranslation } from "@/components/providers/LanguageContext";
import { useTheme } from "next-themes";

function SettingSection({ icon: Icon, title, description, children, active, onClick }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden mb-4 shadow-sm">
      <button 
        onClick={onClick}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>
          </div>
        </div>
        <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform ${active ? "rotate-90" : ""}`} />
      </button>
      
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-50 dark:border-slate-800"
          >
            <div className="p-5 bg-slate-50/30 dark:bg-slate-800/20">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const { user: currentUser, logout, checkUserAuth, registerBiometrics } = useAuth();
  const { lang: currentLang, setLang, SUPPORTED_LANGS, currentLangInfo } = useLang();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState("profile");
  const queryClient = useQueryClient();

  // Handle URL params to open specific sections
  useEffect(() => {
    const section = searchParams.get("section");
    if (section) {
      setActiveSection(section);
    }
  }, [searchParams]);

  const [profileData, setProfileData] = useState({
    username: currentUser?.username || "",
    display_name: currentUser?.display_name || "",
    bio: currentUser?.bio || "",
    avatar_url: currentUser?.avatar_url || "",
    banner_url: currentUser?.banner_url || ""
  });

  const [uploading, setUploading] = useState({ avatar: false, banner: false });

  // Password & Email update states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [passForm, setPassForm] = useState({ current: "", new: "", confirm: "" });
  const [emailForm, setEmailForm] = useState({ newEmail: "", password: "" });

  // Phone update states
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showPhoneVerifyModal, setShowPhoneVerifyModal] = useState(false);
  const [phoneForm, setPhoneForm] = useState({ newPhone: "" });

  // 2FA Setup state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState({ qrCode: "", secret: "" });
  const [otpToken, setOtpToken] = useState("");

  // Preference states
  const [notifications, setNotifications] = useState({
    notif_sales: currentUser?.notifications?.notif_sales ?? true,
    notif_msg: currentUser?.notifications?.notif_msg ?? true,
    notif_follow: currentUser?.notifications?.notif_follow ?? true,
    notif_live: currentUser?.notifications?.notif_live ?? false,
  });

  const { theme, setTheme } = useTheme();
  const hasSyncedTheme = React.useRef(false);

  // Sync state with currentUser when it loads
  React.useEffect(() => {
    if (currentUser) {
      setProfileData({
        username: currentUser.username || "",
        display_name: currentUser.display_name || "",
        bio: currentUser.bio || "",
        avatar_url: currentUser.avatar_url || "",
        banner_url: currentUser.banner_url || ""
      });
      
      if (currentUser.notifications) {
        setNotifications({
          notif_sales: currentUser.notifications.notif_sales ?? true,
          notif_msg: currentUser.notifications.notif_msg ?? true,
          notif_follow: currentUser.notifications.notif_follow ?? true,
          notif_live: currentUser.notifications.notif_live ?? false,
        });
      }

      // Sync theme preference from user data ONCE on load
      if (currentUser.preferences?.theme && !hasSyncedTheme.current) {
        if (currentUser.preferences.theme !== theme) {
          setTheme(currentUser.preferences.theme);
        }
        hasSyncedTheme.current = true;
      }
    }
  }, [currentUser, theme, setTheme]);

  const handleNotificationToggle = (id) => {
    const newState = { ...notifications, [id]: !notifications[id] };
    setNotifications(newState);
    updateMutation.mutate({ notifications: newState });
  };

  const [selectedLang, setSelectedLang] = useState(currentLang);
  const [langSaving, setLangSaving] = useState(false);

  React.useEffect(() => {
    setSelectedLang(currentLang);
  }, [currentLang]);

  const handleLanguageChange = (code) => {
    setSelectedLang(code);
  };

  const handleSaveLanguage = async () => {
    setLangSaving(true);
    try {
      await setLang(selectedLang);
      toast.success(t("settings.languageUpdated"));
    } catch {
      toast.error(t("settings.languageUpdateFailed"));
    } finally {
      setLangSaving(false);
    }
  };

  const handle2FAToggle = () => {
    setOtpToken("");
    if (currentUser?.is_2fa_enabled) {
      setShowDisable2FAModal(true);
    } else {
      setup2FAMutation.mutate();
    }
  };

  const setup2FAMutation = useMutation({
    mutationFn: () => authAPI.setup2FA(),
    onSuccess: (data) => {
      setTwoFactorData({ qrCode: data.qrCode, secret: data.secret });
      setShow2FAModal(true);
      setOtpToken("");
    },
    onError: (err) => toast.error(err.message || t("settings.twoFASetupFailed")),
  });

  const enable2FAMutation = useMutation({
    mutationFn: () => authAPI.enable2FA(otpToken),
    onSuccess: () => {
      toast.success(t("settings.twoFAEnabled"));
      setShow2FAModal(false);
      checkUserAuth();
      setOtpToken("");
    },
    onError: (err) => toast.error(err.message || t("settings.invalidCode")),
  });

  const disable2FAMutation = useMutation({
    mutationFn: () => authAPI.disable2FA(otpToken),
    onSuccess: () => {
      toast.success(t("settings.twoFADisabled"));
      setShowDisable2FAModal(false);
      checkUserAuth();
      setOtpToken("");
    },
    onError: (err) => toast.error(err.message || t("settings.invalidCode")),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => authAPI.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      checkUserAuth();
      toast.success(t("settings.updated"));
    },
    onError: (err) => {
      toast.error(err.message || t("settings.updateFailed"));
    }
  });

  const passMutation = useMutation({
    mutationFn: () => authAPI.updatePassword(passForm.current, passForm.new),
    onSuccess: () => {
      toast.success(t("settings.passwordUpdated"));
      setShowPasswordModal(false);
      setPassForm({ current: "", new: "", confirm: "" });
    },
    onError: (err) => toast.error(err.message || t("settings.passwordUpdateFailed")),
  });

  const emailMutation = useMutation({
    mutationFn: () => authAPI.updateEmail(emailForm.newEmail, emailForm.password),
    onSuccess: () => {
      setOtpToken("");
      toast.success(t("settings.emailCodeSent"));
      setShowEmailModal(false);
      setShowEmailVerifyModal(true);
    },
    onError: (err) => toast.error(err.message || t("settings.emailUpdateFailed")),
  });

  const verifyEmailMutation = useMutation({
    mutationFn: (token) => authAPI.verifyEmail(emailForm.newEmail, token),
    onSuccess: () => {
      toast.success(t("settings.emailVerified"));
      setShowEmailVerifyModal(false);
      setEmailForm({ newEmail: "", password: "" });
      setOtpToken("");
      checkUserAuth();
    },
    onError: (err) => toast.error(err.message || t("settings.invalidCode")),
  });

  const phoneMutation = useMutation({
    mutationFn: () => authAPI.updatePhone(phoneForm.newPhone),
    onSuccess: () => {
      setOtpToken("");
      toast.success(t("settings.phoneCodeSent"));
      setShowPhoneModal(false);
      setShowPhoneVerifyModal(true);
    },
    onError: (err) => toast.error(err.message || t("settings.phoneUpdateFailed")),
  });

  const verifyPhoneMutation = useMutation({
    mutationFn: (token) => authAPI.verifyPhone(phoneForm.newPhone, token),
    onSuccess: () => {
      toast.success(t("settings.phoneVerified"));
      setShowPhoneVerifyModal(false);
      setPhoneForm({ newPhone: "" });
      setOtpToken("");
      checkUserAuth();
    },
    onError: (err) => toast.error(err.message || t("settings.invalidCode")),
  });

  const [isRegisteringBiometrics, setIsRegisteringBiometrics] = useState(false);

  const handleRegisterBiometrics = async () => {
    setIsRegisteringBiometrics(true);
    try {
      const result = await registerBiometrics();
      if (result.verified) {
        toast.success(t("settings.biometricsRegisteredSuccess"));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || t("settings.biometricsRegisteredError"));
    } finally {
      setIsRegisteringBiometrics(false);
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const res = await uploadAvatar(file);
      if (res.url) {
        setProfileData(prev => ({ ...prev, [`${type}_url`]: res.url }));
        updateMutation.mutate({ [`${type}_url`]: res.url });
      }
    } catch (err) {
      toast.error(t("settings.uploadFailed", { type }));
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleProfileSave = () => {
    updateMutation.mutate({
      username: profileData.username,
      display_name: profileData.display_name,
      bio: profileData.bio
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <BackLink to="Profile" label={t("common.backTo", { page: t("nav.profile") })} />
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{t("settings.title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("settings.appearanceDesc")}</p>
      </div>

      {/* Profile Section */}
      <SettingSection 
        icon={User} 
        title={t("settings.profile")}
        description={t("settings.profileDesc")}
        active={activeSection === "profile"}
        onClick={() => setActiveSection(activeSection === "profile" ? "" : "profile")}
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            {/* Banner Upload */}
            <div className="relative h-32 w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 group">
              {profileData.banner_url ? (
                <img src={profileData.banner_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 opacity-80" />
              )}
              <label className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <div className="bg-white/20 backdrop-blur-md p-2 rounded-full border border-white/30">
                  {uploading.banner ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'banner')} disabled={uploading.banner} />
              </label>
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-md border border-white/10">
                <p className="text-[9px] text-white font-bold uppercase tracking-wider">{t("settings.profileBanner")}</p>
              </div>
            </div>

            {/* Avatar Upload */}
            <div className="flex flex-col items-center -mt-12 relative z-10">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 ring-4 ring-white dark:ring-slate-900 shadow-lg">
                  <AvatarImg
                    src={profileData.avatar_url}
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center bg-orange-50 dark:bg-orange-900/30 text-orange-500 font-bold text-2xl">
                        {profileData.display_name?.[0]?.toUpperCase() || "U"}
                      </div>
                    }
                  />
                  {uploading.avatar && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-orange-600 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center cursor-pointer hover:bg-orange-700 transition-colors shadow-sm">
                  <Camera className="w-4 h-4 text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} disabled={uploading.avatar} />
                </label>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-2">{t("settings.avatarRecommendation")}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 ml-1">{t("settings.username")}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                <Input 
                  value={profileData.username} 
                  onChange={e => setProfileData({...profileData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})}
                  placeholder="username"
                  className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-orange-500 pl-8"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 ml-1">{t("settings.usernameHint")}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 ml-1">{t("settings.displayName")}</label>
              <Input 
                value={profileData.display_name} 
                onChange={e => setProfileData({...profileData, display_name: e.target.value})}
                placeholder="Full name or nickname"
                className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 ml-1">{t("settings.bio")}</label>
              <textarea 
                value={profileData.bio}
                onChange={e => setProfileData({...profileData, bio: e.target.value})}
                placeholder={t("settings.bioPlaceholder")}
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 focus:border-orange-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none transition-all resize-none"
              />
              <p className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-1">{profileData.bio.length}/500</p>
            </div>
            <Button 
              onClick={handleProfileSave}
              disabled={updateMutation.isPending}
              className="w-full bg-slate-900 dark:bg-orange-600 hover:bg-slate-800 dark:hover:bg-orange-700 text-white rounded-xl h-11 font-semibold"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("settings.saveChanges")}
            </Button>
          </div>
        </div>
      </SettingSection>

      {/* Account Section */}
      <SettingSection 
        icon={Lock} 
        title={t("settings.account")}
        description={t("settings.accountDesc")}
        active={activeSection === "account"}
        onClick={() => setActiveSection(activeSection === "account" ? "" : "account")}
      >
        <div className="space-y-4">
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("settings.emailAddress")}</p>
                <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 shrink-0">{t("settings.private")}</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{currentUser?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-orange-600 dark:text-orange-400 font-bold text-xs h-8 px-3 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 shrink-0"
              onClick={() => setShowEmailModal(true)}
            >
              {t("settings.change")}
            </Button>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("settings.phoneNumber")}</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {currentUser?.phone_number || t("settings.notSet")}
                {currentUser?.is_phone_verified && (
                  <span className="ml-2 text-[10px] bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full border border-green-100 dark:border-green-900">{t("common.verified")}</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-orange-600 dark:text-orange-400 font-bold text-xs h-8 px-3 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 shrink-0"
              onClick={() => setShowPhoneModal(true)}
            >
              {currentUser?.phone_number ? t("settings.change") : t("settings.add")}
            </Button>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("settings.password")}</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">••••••••••••</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-orange-600 dark:text-orange-400 font-bold text-xs h-8 px-3 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20"
              onClick={() => setShowPasswordModal(true)}
            >
              {t("settings.update")}
            </Button>
          </div>
          <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/30 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-sm shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-orange-900 dark:text-orange-100">{t("settings.twoFactor")}</h4>
              <p className="text-xs text-orange-600/70 dark:text-orange-400/70 mb-2 leading-relaxed">{t("settings.twoFactorDesc")}</p>
              <Button 
                size="sm" 
                onClick={handle2FAToggle}
                disabled={updateMutation.isPending}
                className={`${currentUser?.is_2fa_enabled ? "bg-red-500 hover:bg-red-600" : "bg-orange-600 hover:bg-orange-700"} text-white rounded-lg h-8 text-[10px] font-bold px-3`}
              >
                {currentUser?.is_2fa_enabled ? t("settings.disable2FA") : t("settings.enable2FA")}
              </Button>
            </div>
          </div>

          <div className="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-2xl border border-violet-100 dark:border-violet-900/30 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-sm shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-violet-900 dark:text-violet-100">{t("settings.biometricAuth")}</h4>
              <p className="text-xs text-violet-600/70 dark:text-violet-400/70 mb-2 leading-relaxed">{t("settings.biometricAuthDesc")}</p>
              <div className="flex flex-col gap-2">
                <Button 
                  size="sm" 
                  onClick={handleRegisterBiometrics}
                  disabled={isRegisteringBiometrics}
                  className="bg-violet-600 hover:bg-violet-700 text-white rounded-lg h-8 text-[10px] font-bold px-3 w-fit"
                >
                  {isRegisteringBiometrics ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-2" />
                  ) : null}
                  {t("settings.registerBiometrics")}
                </Button>
                {currentUser?.authenticators?.length > 0 && (
                  <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <Shield className="w-3 h-3" /> {t("settings.biometricsRegisteredCount", { count: currentUser.authenticators.length })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Dialog */}
        <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader><DialogTitle>{t("settings.updatePassword")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input 
                type="password" 
                placeholder={t("settings.currentPassword")}
                value={passForm.current}
                onChange={e => setPassForm({...passForm, current: e.target.value})}
              />
              <Input 
                type="password" 
                placeholder={t("settings.newPassword")}
                value={passForm.new}
                onChange={e => setPassForm({...passForm, new: e.target.value})}
              />
              <Input 
                type="password" 
                placeholder={t("settings.confirmNewPassword")}
                value={passForm.confirm}
                onChange={e => setPassForm({...passForm, confirm: e.target.value})}
              />
              <Button 
                className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl"
                disabled={!passForm.current || !passForm.new || passForm.new !== passForm.confirm || passMutation.isPending}
                onClick={() => passMutation.mutate()}
              >
                {passMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t("settings.updatePassword")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Email Dialog */}
        <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader><DialogTitle>{t("settings.changeEmailAddress")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input 
                type="email" 
                placeholder={t("settings.newEmailAddress")}
                value={emailForm.newEmail}
                onChange={e => setEmailForm({...emailForm, newEmail: e.target.value})}
              />
              <Input 
                type="password" 
                placeholder={t("settings.currentPassword")}
                value={emailForm.password}
                onChange={e => setEmailForm({...emailForm, password: e.target.value})}
              />
              <Button 
                className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl"
                disabled={!emailForm.newEmail || !emailForm.password || emailMutation.isPending}
                onClick={() => emailMutation.mutate()}
              >
                {emailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t("settings.changeEmailAddress")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SettingSection>

      {/* Notifications */}
      <SettingSection 
        icon={Bell} 
        title={t("settings.notifications")}
        description={t("settings.notificationsDesc")}
        active={activeSection === "notifications"}
        onClick={() => setActiveSection(activeSection === "notifications" ? "" : "notifications")}
      >
        <div className="space-y-2">
          {[
            { id: "notif_sales", label: t("settings.salesOrders"), icon: CreditCard },
            { id: "notif_msg", label: t("settings.directMessages"), icon: Mail },
            { id: "notif_follow", label: t("settings.newFollowers"), icon: User },
            { id: "notif_live", label: t("settings.liveStreams"), icon: Smartphone },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500">
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
              </div>
              <div 
                onClick={() => handleNotificationToggle(item.id)}
                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors shadow-inner ${notifications[item.id] ? "bg-orange-600" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${notifications[item.id] ? "right-0.5" : "left-0.5"}`} />
              </div>
            </div>
          ))}
        </div>
      </SettingSection>

      {/* Quick Links */}
      {currentUser?.role !== 'super_admin' && (
        <SettingSection
          icon={LayoutGrid}
          title={t("settings.quickLinks")}
          description={t("settings.quickLinksDesc")}
          active={activeSection === "quickLinks"}
          onClick={() => setActiveSection(activeSection === "quickLinks" ? "" : "quickLinks")}
        >
          <div className="space-y-2">
            {[
              { label: t("nav.finance"), icon: DollarSign, page: "VendorFinance" },
              { label: t("nav.affiliate"), icon: Link2, page: "Affiliate" },
              { label: t("nav.wishlist"), icon: Heart, page: "Wishlist" },
              { label: t("nav.bookmarks"), icon: Bookmark, page: "Bookmarks" },
              { label: t("nav.trackOrder"), icon: MapPin, page: "OrderTracking" },
            ].map((item) => (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </SettingSection>
      )}

      {/* Appearance */}
      <SettingSection
        icon={Moon}
        title={t("settings.appearance")}
        description={t("settings.appearanceDesc")}
        active={activeSection === "appearance"}
        onClick={() => setActiveSection(activeSection === "appearance" ? "" : "appearance")}
      >
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <Moon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("common.theme")}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "light", label: t("common.lightMode") },
              { value: "dark", label: t("common.darkMode") },
              { value: "system", label: t("common.systemMode") },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setTheme(opt.value);
                  if (currentUser) {
                    updateMutation.mutate({ preferences: { ...currentUser.preferences, theme: opt.value } });
                  }
                }}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                  theme === opt.value
                    ? "bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-100"
                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-orange-200 dark:hover:border-orange-800 hover:text-orange-600 dark:hover:text-orange-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </SettingSection>

      {/* Language */}
      <SettingSection
        icon={Globe}
        title={t("settings.language")}
        description={t("settings.languageDesc")}
        active={activeSection === "preferences"}
        onClick={() => setActiveSection(activeSection === "preferences" ? "" : "preferences")}
      >
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("common.language")}</span>
            </div>
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg">
              {currentLangInfo?.flag} {currentLangInfo?.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {SUPPORTED_LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                  selectedLang === l.code
                    ? "bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-100"
                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-orange-200 dark:hover:border-orange-800 hover:text-orange-600 dark:hover:text-orange-400"
                }`}
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>
          <Button
            onClick={handleSaveLanguage}
            disabled={selectedLang === currentLang || langSaving}
            className="w-full bg-slate-900 dark:bg-orange-600 hover:bg-slate-800 dark:hover:bg-orange-700 text-white rounded-xl h-10 text-xs font-bold"
          >
            {langSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : `${t("common.save")} ${t("common.language")}`}
          </Button>
        </div>
      </SettingSection>

      {/* Subscription Plan Section */}
      <SettingSection
        icon={CreditCard}
        title={t("profile.subscriptionMgmt")}
        description={t("profile.managePlanDesc")}
        active={activeSection === "subscription"}
        onClick={() => setActiveSection(activeSection === "subscription" ? "" : "subscription")}
      >
        <SubscriptionManager vendorUsername={currentUser?.username} />
      </SettingSection>

      {/* Logout / Dangerous Zone */}
      <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
        <Button 
          variant="outline"
          onClick={() => logout()}
          className="w-full border-red-100 dark:border-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-xl h-11 font-bold transition-all"
        >
          <LogOut className="w-4 h-4 mr-2" /> {t("common.logout")}
        </Button>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-6">
          {t("settings.versionInfo")}<br/>
          {t("settings.copyright")}
        </p>
      </div>

      {/* 2FA Setup Modal */}
      <Dialog open={show2FAModal} onOpenChange={setShow2FAModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("settings.setup2FA")}</DialogTitle>
            <DialogDescription>
              {t("settings.setup2FADesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            {twoFactorData.qrCode && (
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border-4 border-slate-50 dark:border-slate-700 shadow-inner">
                <img src={twoFactorData.qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            )}
            <div className="space-y-2 text-center">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t("settings.verificationCode")}</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpToken} onChange={setOtpToken}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-11"
              disabled={otpToken.length !== 6 || enable2FAMutation.isPending}
              onClick={() => enable2FAMutation.mutate()}
            >
              {enable2FAMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t("settings.verifyAndEnable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Modal */}
      <Dialog open={showDisable2FAModal} onOpenChange={setShowDisable2FAModal}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("settings.disable2FATitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.disable2FADesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <InputOTP maxLength={6} value={otpToken} onChange={setOtpToken}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button 
              variant="destructive"
              className="w-full rounded-xl h-11 font-bold"
              disabled={otpToken.length !== 6 || disable2FAMutation.isPending}
              onClick={() => disable2FAMutation.mutate()}
            >
              {disable2FAMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t("settings.confirmDisable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Verification Code Modal */}
      <Dialog open={showEmailVerifyModal} onOpenChange={setShowEmailVerifyModal}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("settings.verifyNewEmail")}</DialogTitle>
            <DialogDescription>
              {t("settings.verifyEmailDesc", { email: emailForm.newEmail })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <InputOTP maxLength={6} value={otpToken} onChange={setOtpToken}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-11"
              disabled={otpToken.length !== 6 || verifyEmailMutation.isPending}
              onClick={() => verifyEmailMutation.mutate(otpToken)}
            >
              {verifyEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t("settings.verifyEmail")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Phone Modal */}
      <Dialog open={showPhoneModal} onOpenChange={setShowPhoneModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>{t("settings.updatePhone")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">{t("settings.newPhoneWhatsapp")}</label>
              <Input
                type="tel"
                placeholder="+1234567890"
                value={phoneForm.newPhone}
                onChange={e => setPhoneForm({...phoneForm, newPhone: e.target.value})}
                className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">{t("settings.phoneHint")}</p>
            </div>
            <Button 
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-700 rounded-xl h-11 font-bold"
              disabled={!phoneForm.newPhone || phoneForm.newPhone.length < 10 || phoneMutation.isPending}
              onClick={() => phoneMutation.mutate()}
            >
              {phoneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t("settings.sendVerificationCode")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phone Verification Code Modal */}
      <Dialog open={showPhoneVerifyModal} onOpenChange={setShowPhoneVerifyModal}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("settings.verifyPhone")}</DialogTitle>
            <DialogDescription>
              {t("settings.verifyPhoneDesc", { phone: phoneForm.newPhone })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <InputOTP maxLength={6} value={otpToken} onChange={setOtpToken}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-11 font-bold"
              disabled={otpToken.length !== 6 || verifyPhoneMutation.isPending}
              onClick={() => verifyPhoneMutation.mutate(otpToken)}
            >
              {verifyPhoneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t("settings.verifyAndUpdate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
