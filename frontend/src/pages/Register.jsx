import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/AuthContext';
import { getRedirectPath } from '@/lib/utils';
import { Mail, Lock, User, Loader2, ArrowRight, ArrowLeft, Eye, EyeOff, Sun, Moon, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GoogleSignInButton from '@/components/shared/GoogleSignInButton';
import Seo from '@/components/shared/Seo';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/layout/Logo";
import LanguagePicker from "@/components/layout/LanguagePicker";
import { useTheme } from 'next-themes';
import { toast } from '@/components/ui/use-toast';

const MemoizedBackground = React.memo(() => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 dark:bg-[radial-gradient(circle_at_50%_50%,rgba(17,17,19,1)_0%,rgba(0,0,0,1)_100%)] bg-gradient-to-br from-orange-50/40 via-slate-50 to-orange-50/30" />
    <motion.div
      animate={{ scale: [1.2, 1, 1.2], x: [0, -100, 0], y: [0, -50, 0] }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] dark:bg-orange-600/10 bg-orange-400/15 rounded-full blur-[120px]"
    />
    <motion.div
      animate={{ scale: [1, 1.2, 1], x: [0, 120, 0], y: [0, 80, 0] }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -bottom-[20%] -left-[10%] w-[70%] h-[70%] dark:bg-orange-600/10 bg-orange-400/20 rounded-full blur-[120px]"
    />
    <div className="absolute inset-0 dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
  </div>
));

const PasswordStrength = ({ password, t }) => {
  const checks = [
    { label: t("auth.passwordStrength6Chars"), pass: password.length >= 6 },
    { label: t("auth.passwordStrengthUppercase"), pass: /[A-Z]/.test(password) },
    { label: t("auth.passwordStrengthNumber"), pass: /\d/.test(password) },
  ];
  if (!password) return null;
  const passed = checks.filter(c => c.pass).length;
  const color = passed === checks.length ? 'emerald' : passed >= 2 ? 'orange' : 'slate';
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1.5">
        {checks.map((c, i) => (
          <div
            key={c.label}
            className={`h-1 flex-1 rounded-full transition-colors ${c.pass ? (passed === checks.length ? 'bg-emerald-500' : 'bg-orange-500') : 'dark:bg-slate-700 bg-slate-200'}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-medium dark:text-slate-500 text-slate-500">
        {checks.map((c) => (
          <span key={c.label} className={`flex items-center gap-1 ${c.pass ? 'text-emerald-500' : ''}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.pass ? 'bg-emerald-500' : 'dark:bg-slate-700 bg-slate-300'}`} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const Register = () => {
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    email: '',
    password: '',
    confirm_password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { register, googleLogin } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const redirectAfterAuth = (user) => navigate(location.state?.from || getRedirectPath(user));

  useEffect(() => {
    return () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError(t("auth.googleSignUpNoCredential"));
      toast({ title: t("auth.googleSignUpFailedTitle"), description: t("auth.noCredentialDesc"), variant: "destructive" });
      return;
    }
    setIsGoogleLoading(true);
    setError('');
    try {
      const res = await googleLogin(credentialResponse.credential);
      toast({ title: t("auth.accountCreatedTitle"), description: t("auth.googleSignUpSuccessDesc"), variant: "success" });
      redirectAfterAuth(res.user);
    } catch (err) {
      const msg = err.message || t("auth.googleSignUpFailed");
      setError(msg);
      toast({ title: t("auth.googleSignUpFailedTitle"), description: msg, variant: "destructive" });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleError = (err) => {
    console.error('Google OAuth error:', err);
    const msg = t("auth.googleSignUpFailedPopup");
    setError(msg);
    toast({ title: t("auth.googleSignUpFailedTitle"), description: msg, variant: "destructive" });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      const msg = t("auth.passwordMismatch");
      setError(msg);
      toast({ title: t("auth.passwordsDontMatchTitle"), description: t("auth.passwordsDontMatchDesc"), variant: "destructive" });
      return;
    }

    if (!formData.username || formData.username.length < 3) {
      const msg = t("auth.usernameTooShort");
      setError(msg);
      toast({ title: t("auth.usernameTooShortTitle"), description: t("auth.usernameTooShortDesc"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        display_name: formData.display_name
      });
      toast({ title: t("auth.welcomeAboardTitle"), description: t("auth.accountCreatedDesc"), variant: "success" });
      redirectAfterAuth(res.user);
    } catch (err) {
      const msg = err.message || t("auth.createAccountFailedGeneric");
      setError(msg);
      toast({ title: t("auth.registrationFailedTitle"), description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full pl-11 pr-4 py-4 sm:py-5 rounded-xl dark:border-white/5 border-slate-200 dark:bg-white/[0.03] bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/40 focus:border-orange-400 dark:focus:bg-white/[0.05] focus:bg-white outline-none transition-all duration-300 font-medium dark:group-hover:border-white/10 group-hover:border-slate-300 dark:placeholder:text-slate-500 placeholder:text-slate-400";
  const iconClass = "absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] dark:text-slate-500 text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300";
  const labelClass = "text-xs font-semibold dark:text-slate-400 text-slate-600 ml-0.5";

  return (
    <div className="min-h-screen w-full relative flex flex-col lg:flex-row items-center justify-start lg:justify-center dark:bg-[#0a0a0c] bg-slate-50 selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden font-sans transition-colors duration-300 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8 sm:px-6 lg:py-8">
      <Seo path="/register" title="Create Account" description="Create your free Aicon X account to start shopping, selling, and connecting with communities today." />
      <MemoizedBackground />

      <div className="flex lg:hidden items-center justify-between w-full max-w-md mx-auto mb-4 relative z-20">
        <button
          type="button"
          onClick={() => navigate('/welcome')}
          className="h-10 w-10 rounded-full dark:bg-white/5 bg-white/90 dark:hover:bg-white/10 hover:bg-white dark:text-slate-400 text-slate-600 dark:border-white/10 border-slate-200 border backdrop-blur-sm shadow-sm transition-all duration-300 flex items-center justify-center"
          aria-label={t("auth.goBack")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <LanguagePicker compact />
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-10 w-10 rounded-full dark:bg-white/5 bg-white/90 dark:hover:bg-white/10 hover:bg-white dark:text-slate-400 text-slate-600 dark:border-white/10 border-slate-200 border backdrop-blur-sm shadow-sm transition-all duration-300 flex items-center justify-center"
            aria-label={t("auth.toggleTheme")}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="hidden lg:flex absolute top-4 inset-x-4 z-20 items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/welcome')}
          className="h-10 w-10 rounded-full dark:bg-white/5 bg-white/90 dark:hover:bg-white/10 hover:bg-white dark:text-slate-400 text-slate-600 dark:border-white/10 border-slate-200 border backdrop-blur-sm shadow-sm transition-all duration-300 flex items-center justify-center"
          aria-label={t("auth.goBack")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <LanguagePicker compact />
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-10 w-10 rounded-full dark:bg-white/5 bg-white/90 dark:hover:bg-white/10 hover:bg-white dark:text-slate-400 text-slate-600 dark:border-white/10 border-slate-200 border backdrop-blur-sm shadow-sm transition-all duration-300 flex items-center justify-center"
            aria-label={t("auth.toggleTheme")}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="w-full relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 max-w-6xl mx-auto lg:flex-1">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex flex-col space-y-6 max-w-md shrink-0"
        >
          <div className="space-y-5">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <Logo size="lg" showText={false} className="!gap-0" />
            </motion.div>
            <h1 className="text-5xl xl:text-6xl font-black dark:text-white text-slate-900 tracking-tighter leading-[0.9]">
              {t("auth.registerHeroLine1")} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600">{t("auth.registerHeroLine2")}</span>
            </h1>
            <p className="text-base xl:text-lg dark:text-slate-400 text-slate-600 leading-relaxed max-w-sm">
              {t("auth.registerHeroSubtitle")}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="dark:bg-white/[0.02] bg-white dark:backdrop-blur-3xl backdrop-blur-xl p-5 sm:p-8 rounded-2xl sm:rounded-3xl dark:shadow-[0_24px_96px_-12px_rgba(0,0,0,0.7)] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.08)] dark:border dark:border-white/10 border border-slate-200/80 dark:ring-1 dark:ring-white/5 relative overflow-hidden transition-colors duration-300">
            <div className="space-y-5 sm:space-y-6">
              <div className="text-center lg:text-left space-y-3 lg:hidden">
                <Logo
                  size="md"
                  className="flex-col !gap-4 mx-auto"
                  subtext={t("auth.joinTheNetwork")}
                  showDecoration={true}
                />
              </div>

              <div className="hidden lg:block space-y-1">
                <h2 className="text-2xl sm:text-3xl font-black dark:text-white text-slate-900 tracking-tight">{t("auth.registerTitle")}</h2>
                <p className="dark:text-slate-500 text-slate-500 text-sm">{t("auth.registerSubtitle")}</p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="dark:bg-rose-500/10 bg-rose-50 dark:border dark:border-rose-500/20 border border-rose-200 dark:text-rose-400 text-rose-700 px-3 py-2.5 rounded-xl text-sm font-medium flex items-start gap-2.5"
                  >
                    <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="display_name" className={labelClass}>{t("auth.fullName")}</Label>
                      <div className="relative group">
                        <Input
                          id="display_name"
                          type="text"
                          name="display_name"
                          value={formData.display_name}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder={t("auth.displayNamePlaceholder")}
                          required
                          autoComplete="name"
                        />
                        <User className={iconClass} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="username" className={labelClass}>{t("auth.username")}</Label>
                      <div className="relative group">
                        <Input
                          id="username"
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                          className={`${inputClass} pl-10`}
                          placeholder={t("auth.usernamePlaceholder")}
                          required
                          minLength={3}
                          autoComplete="username"
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm dark:text-slate-500 text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300">@</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className={labelClass}>{t("auth.email")}</Label>
                    <div className="relative group">
                      <Input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder={t("auth.emailPlaceholder")}
                        required
                        autoComplete="email"
                      />
                      <Mail className={iconClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className={labelClass}>{t("auth.password")}</Label>
                      <div className="relative group">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className={`${inputClass} pr-11`}
                          placeholder={t("auth.passwordPlaceholder")}
                          required
                          minLength={6}
                          autoComplete="new-password"
                        />
                        <Lock className={iconClass} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 dark:text-slate-500 text-slate-400 hover:text-orange-500 transition-colors duration-300 focus:outline-none h-9 w-9 dark:hover:bg-white/5 hover:bg-slate-100 rounded-lg"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <PasswordStrength password={formData.password} t={t} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm_password" className={labelClass}>{t("auth.confirmPassword")}</Label>
                      <div className="relative group">
                        <Input
                          id="confirm_password"
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirm_password"
                          value={formData.confirm_password}
                          onChange={handleChange}
                          className={`${inputClass} pr-11`}
                          placeholder={t("auth.passwordPlaceholder")}
                          required
                          minLength={6}
                          autoComplete="new-password"
                        />
                        <Lock className={iconClass} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 dark:text-slate-500 text-slate-400 hover:text-orange-500 transition-colors duration-300 focus:outline-none h-9 w-9 dark:hover:bg-white/5 hover:bg-slate-100 rounded-lg"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      {formData.confirm_password && (
                        <div className={`flex items-center gap-1.5 mt-1 text-xs font-medium transition-colors ${formData.password === formData.confirm_password ? 'text-emerald-500' : 'text-rose-500'}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {formData.password === formData.confirm_password ? t("auth.passwordsMatch") : t("auth.passwordsDoNotMatch")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="group w-full bg-orange-600 text-white py-5 sm:py-6 rounded-xl font-bold text-sm hover:bg-orange-500 active:scale-[0.98] transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:active:scale-100 shadow-[0_12px_32px_-8px_rgba(249,115,22,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(249,115,22,0.6)] border-t border-white/20"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {t("auth.createAccount")} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t dark:border-white/5 border-slate-200"></span>
                </div>
                <div className="relative flex justify-center">
                  <span className="dark:bg-[#0a0a0c] bg-white px-3 text-[10px] uppercase tracking-wider dark:text-slate-600 text-slate-500 font-medium">
                    {t("auth.orContinueWith")}
                  </span>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div className={`hover:scale-105 transition-transform duration-300 ${isGoogleLoading ? 'pointer-events-none' : ''}`}>
                      <GoogleSignInButton
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                      />
                    </div>
                    <AnimatePresence>
                      {isGoogleLoading && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute inset-0 flex items-center justify-center rounded-full bg-[#1a73e8]"
                        >
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className={`text-[10px] font-medium dark:text-slate-500 text-slate-500 transition-colors ${isGoogleLoading ? 'text-orange-500' : ''}`}>
                    {isGoogleLoading ? t("auth.signingUp") : t("auth.continueWith", { provider: 'Google' })}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="dark:text-slate-500 text-slate-500 text-sm">
                  {t("auth.haveAccount")}{' '}
                  <Link to="/login" state={location.state} className="text-orange-600 hover:text-orange-500 font-semibold transition-colors relative group/link">
                    {t("auth.signInLink")}
                    <span className="absolute -bottom-0.5 left-0 w-full h-0.5 bg-orange-500 scale-x-0 group-hover/link:scale-x-100 transition-transform duration-300 origin-left" />
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-5 text-center dark:text-slate-700 text-slate-400 text-[10px] font-medium tracking-wide"
          >
            {t("auth.securedBy")}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-3 text-center text-[10px] dark:text-slate-600 text-slate-500"
          >
            {t("auth.legalAgreement")}{' '}
            <Link to="/terms" className="text-orange-600 hover:text-orange-500 font-medium transition-colors">
              {t("common.terms")}
            </Link>
            {', '}
            <Link to="/privacy" className="text-orange-600 hover:text-orange-500 font-medium transition-colors">
              {t("common.privacy")}
            </Link>
            {' '}{t("common.and")}{' '}
            <Link to="/community-guidelines" className="text-orange-600 hover:text-orange-500 font-medium transition-colors">
              {t("common.communityGuidelines")}
            </Link>
            .
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
