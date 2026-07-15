import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/AuthContext';
import { getRedirectPath } from '@/lib/utils';
import { Mail, Lock, Loader2, ShieldCheck, ArrowRight, ArrowLeft, Eye, EyeOff, Fingerprint, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GoogleSignInButton from '@/components/shared/GoogleSignInButton';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Logo from "@/components/layout/Logo";
import LanguagePicker from "@/components/layout/LanguagePicker";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useTheme } from 'next-themes';
import { toast } from '@/components/ui/use-toast';

const MemoizedBackground = React.memo(() => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 dark:bg-[radial-gradient(circle_at_50%_50%,rgba(17,17,19,1)_0%,rgba(0,0,0,1)_100%)] bg-gradient-to-br from-slate-50 via-orange-50/40 to-orange-50/30" />
    <motion.div
      animate={{ scale: [1, 1.2, 1], x: [0, 100, 0], y: [0, 50, 0] }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] dark:bg-orange-600/10 bg-orange-400/20 rounded-full blur-[120px]"
    />
    <motion.div
      animate={{ scale: [1.2, 1, 1.2], x: [0, -120, 0], y: [0, -80, 0] }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] dark:bg-orange-600/10 bg-orange-400/15 rounded-full blur-[120px]"
    />
    <div className="absolute inset-0 dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
  </div>
));

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState(null);
  const [otpToken, setOtpToken] = useState('');

  const { login, googleLogin, verify2FA, loginBiometrics } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const redirectAfterLogin = (user) => navigate(location.state?.from || getRedirectPath(user));

  useEffect(() => {
    return () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  const handleBiometricLogin = async () => {
    if (!identifier) {
      setError('Please enter your email or username first to use biometric login');
      toast({ title: "Identity required", description: "Enter your email or username before using biometric login.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await loginBiometrics(identifier);
      toast({ title: "Biometric verified!", description: "Welcome back. Redirecting you now.", variant: "success" });
      redirectAfterLogin(res.user);
    } catch (err) {
      console.error(err);
      const msg = err.message || 'Biometric login failed. Make sure you have registered biometrics for this account.';
      setError(msg);
      toast({ title: "Biometric failed", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError('Google login failed: no credential received. Please try again.');
      toast({ title: "Google sign-in failed", description: "No credential received. Please try again.", variant: "destructive" });
      return;
    }
    setIsGoogleLoading(true);
    setError('');
    try {
      const res = await googleLogin(credentialResponse.credential);
      toast({ title: "Signed in!", description: "Welcome back. Google authentication successful.", variant: "success" });
      redirectAfterLogin(res.user);
    } catch (err) {
      const msg = err.message || 'Google login failed. Please try again.';
      setError(msg);
      toast({ title: "Google sign-in failed", description: msg, variant: "destructive" });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleError = (err) => {
    console.error('Google OAuth error:', err);

    const isNative = typeof window !== 'undefined' && window?.Capacitor?.isNativePlatform?.()
      ? true
      : false;

    // In Capacitor native builds, the web oauth flow can produce misleading
    // “pop-ups blocked” messages. Show a native-appropriate message.
    const msg = isNative
      ? (err?.message || 'Google sign-in failed on this device. Please try again.')
      : 'Google login failed. Make sure pop-ups are not blocked and try again.';

    setError(msg);
    toast({ title: "Google sign-in failed", description: msg, variant: "destructive" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await login(identifier, password, rememberMe);
      if (res.two_factor_required) {
        setTwoFactorToken(res.two_factor_token);
        setShow2FA(true);
        toast({ title: "Verification required", description: "Enter your 6-digit authentication code to continue." });
      } else {
        toast({ title: "Welcome back!", description: "You've been signed in successfully.", variant: "success" });
        redirectAfterLogin(res.user);
      }
    } catch (err) {
      const msg = err.message || 'Failed to login. Please check your credentials.';
      setError(msg);
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await verify2FA(twoFactorToken, otpToken);
      toast({ title: "Access granted!", description: "Two-factor authentication successful.", variant: "success" });
      redirectAfterLogin(res.user);
    } catch (err) {
      const msg = err.message || 'Invalid verification code.';
      setError(msg);
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;

  return (
    <div className="min-h-screen w-full relative flex flex-col lg:flex-row items-center justify-start lg:justify-center dark:bg-[#0a0a0c] bg-slate-50 selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden font-sans transition-colors duration-300 pt-4 lg:pt-0">
      <MemoizedBackground />

      <div className="flex lg:hidden items-center justify-between w-full max-w-md mx-auto px-4 sm:px-6 mb-4 relative z-20">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate('/welcome')}
          className="h-10 w-10 rounded-full dark:bg-white/5 bg-white/90 dark:hover:bg-white/10 hover:bg-white dark:text-slate-400 text-slate-600 dark:border-white/10 border-slate-200 border backdrop-blur-sm shadow-sm transition-all duration-300"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <LanguagePicker compact />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-10 w-10 rounded-full dark:bg-white/5 bg-white/90 dark:hover:bg-white/10 hover:bg-white dark:text-slate-400 text-slate-600 dark:border-white/10 border-slate-200 border backdrop-blur-sm shadow-sm transition-all duration-300"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="hidden lg:flex absolute top-4 inset-x-4 z-20 items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate('/welcome')}
          className="h-10 w-10 rounded-full dark:bg-white/5 bg-white/90 dark:hover:bg-white/10 hover:bg-white dark:text-slate-400 text-slate-600 dark:border-white/10 border-slate-200 border backdrop-blur-sm shadow-sm transition-all duration-300"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <LanguagePicker compact />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-10 w-10 rounded-full dark:bg-white/5 bg-white/90 dark:hover:bg-white/10 hover:bg-white dark:text-slate-400 text-slate-600 dark:border-white/10 border-slate-200 border backdrop-blur-sm shadow-sm transition-all duration-300"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="container relative z-10 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-24 px-4 sm:px-6 max-w-7xl mx-auto py-6 lg:py-10">

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
              {t("auth.loginHeroLine1")} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600">{t("auth.loginHeroLine2")}</span>
            </h1>
            <p className="text-base xl:text-lg dark:text-slate-400 text-slate-600 leading-relaxed max-w-sm">
              {t("auth.loginHeroSubtitle")}
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
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent dark:via-white/[0.03] via-orange-500/[0.01] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

            <AnimatePresence mode="wait">
              {!show2FA ? (
                <motion.div
                  key="login-form"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6 sm:space-y-8"
                >
                  <div className="text-center lg:text-left space-y-3 lg:hidden">
                    <Logo
                      size="md"
                      className="flex-col !gap-4 mx-auto"
                      subtext="Premium Social Commerce"
                      showDecoration={true}
                    />
                  </div>

                  <div className="hidden lg:block space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-black dark:text-white text-slate-900 tracking-tight">{t("auth.signIn")}</h2>
                    <p className="dark:text-slate-500 text-slate-500 text-sm">{t("auth.loginSubtitle")}</p>
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

                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="identifier" className="text-xs font-semibold dark:text-slate-400 text-slate-600 ml-0.5">{t("auth.email")} / {t("auth.username")}</Label>
                      <div className="relative group">
                        <Input
                          id="identifier"
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          className="w-full pl-11 pr-4 py-4 sm:py-5 rounded-xl dark:border-white/5 border-slate-200 dark:bg-white/[0.03] bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/40 focus:border-orange-400 dark:focus:bg-white/[0.05] focus:bg-white outline-none transition-all duration-300 font-medium dark:group-hover:border-white/10 group-hover:border-slate-300 dark:placeholder:text-slate-500 placeholder:text-slate-400"
                          placeholder={t("auth.emailOrUsernamePlaceholder")}
                          required
                          autoComplete="username"
                        />
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] dark:text-slate-500 text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center ml-0.5">
                        <Label htmlFor="password" className="text-xs font-semibold dark:text-slate-400 text-slate-600">{t("auth.password")}</Label>
                        <Link to="/forgot-password" title="Reset your password" className="text-xs font-medium text-orange-600 hover:text-orange-500 transition-colors">
                          {t("auth.forgotPassword")}
                        </Link>
                      </div>
                      <div className="relative group">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-11 pr-11 py-4 sm:py-5 rounded-xl dark:border-white/5 border-slate-200 dark:bg-white/[0.03] bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/40 focus:border-orange-400 dark:focus:bg-white/[0.05] focus:bg-white outline-none transition-all duration-300 font-medium dark:group-hover:border-white/10 group-hover:border-slate-300 dark:placeholder:text-slate-500 placeholder:text-slate-400"
                          placeholder={t("auth.passwordPlaceholder")}
                          required
                          autoComplete="current-password"
                        />
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] dark:text-slate-500 text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300" />
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
                    </div>

                    <div className="flex items-center justify-between px-0.5">
                      <label htmlFor="remember" className="flex items-center gap-2.5 cursor-pointer select-none">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={setRememberMe}
                          className="h-5 w-5 rounded-md border-slate-300 bg-white text-slate-900 hover:border-orange-500 dark:border-white/20 dark:bg-white/10 dark:text-white data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600 data-[state=checked]:text-white data-[state=checked]:hover:bg-orange-500 data-[state=checked]:hover:border-orange-500 transition-colors"
                        />
                        <span className="text-sm font-medium dark:text-slate-400 text-slate-600">
                          {t("auth.staySignedIn")}
                        </span>
                      </label>
                    </div>

                    <Button
                      type="submit"
                      disabled={anyLoading}
                      className="group w-full bg-orange-600 text-white py-5 sm:py-6 rounded-xl font-bold text-sm hover:bg-orange-500 active:scale-[0.98] transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:active:scale-100 shadow-[0_12px_32px_-8px_rgba(249,115,22,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(249,115,22,0.6)] border-t border-white/20"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      ) : (
                        <span className="flex items-center gap-2">
                          {t("auth.signIn")} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
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

                  <div className="flex justify-center gap-8 items-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <div className={`hover:scale-110 transition-transform duration-300 ${isGoogleLoading ? 'pointer-events-none' : ''}`}>
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
                              className="absolute inset-0 flex items-center justify-center rounded-full dark:bg-[#1a73e8] bg-[#1a73e8]"
                            >
                              <Loader2 className="h-5 w-5 animate-spin text-white" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <span className={`text-[10px] font-medium dark:text-slate-500 text-slate-500 transition-colors ${isGoogleLoading ? 'text-orange-500' : ''}`}>
                        {isGoogleLoading ? t("auth.signingIn") : t("auth.continueWith", { provider: 'Google' })}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={handleBiometricLogin}>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={anyLoading}
                        className="h-11 w-11 rounded-full dark:border-white/5 border-slate-200 dark:bg-white/5 bg-slate-50 group-hover:bg-orange-600 group-hover:border-orange-600 group-hover:text-white dark:text-slate-400 text-slate-500 transition-all duration-300 active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
                      </Button>
                      <span className="text-[9px] font-black dark:text-slate-600 text-slate-500 uppercase tracking-[0.15em] group-hover:text-orange-400 transition-colors">Biometric</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="dark:text-slate-500 text-slate-500 text-sm">
                      {t("auth.newHere")}{' '}
                      <Link to="/register" state={location.state} className="text-orange-600 hover:text-orange-500 font-semibold transition-colors relative group/link">
                        {t("auth.joinNetwork")}
                        <span className="absolute -bottom-0.5 left-0 w-full h-0.5 bg-orange-500 scale-x-0 group-hover/link:scale-x-100 transition-transform duration-300 origin-left" />
                      </Link>
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="otp-form"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-8"
                >
                  <div className="text-center space-y-6">
                    <motion.div
                      initial={{ rotate: -10, scale: 0.9 }}
                      animate={{ rotate: 0, scale: 1 }}
                      className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-orange-500/10 text-orange-500 mb-2 border border-orange-500/20 shadow-2xl shadow-orange-500/20"
                    >
                      <ShieldCheck className="h-10 w-10" />
                    </motion.div>
                    <div className="space-y-2">
                      <h1 className="text-3xl font-black dark:text-white text-slate-900 tracking-tighter uppercase">Vault</h1>
                      <p className="dark:text-slate-500 text-slate-500 font-semibold text-xs tracking-[0.2em] uppercase">
                        Identity Verification
                      </p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="dark:bg-rose-500/10 bg-rose-50 dark:border dark:border-rose-500/20 border border-rose-200 dark:text-rose-400 text-rose-700 px-5 py-4 rounded-2xl text-sm font-semibold flex items-start gap-3"
                      >
                        <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleVerify2FA} className="space-y-10 flex flex-col items-center">
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otpToken}
                        onChange={setOtpToken}
                        className="gap-2 sm:gap-3"
                      >
                        <InputOTPGroup className="gap-2 sm:gap-3">
                          <InputOTPSlot index={0} className="w-10 h-14 sm:w-12 sm:h-16 text-xl sm:text-2xl font-black rounded-2xl dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/50 focus:border-orange-400 outline-none" />
                          <InputOTPSlot index={1} className="w-10 h-14 sm:w-12 sm:h-16 text-xl sm:text-2xl font-black rounded-2xl dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/50 focus:border-orange-400 outline-none" />
                          <InputOTPSlot index={2} className="w-10 h-14 sm:w-12 sm:h-16 text-xl sm:text-2xl font-black rounded-2xl dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/50 focus:border-orange-400 outline-none" />
                        </InputOTPGroup>
                        <div className="w-2" />
                        <InputOTPGroup className="gap-2 sm:gap-3">
                          <InputOTPSlot index={3} className="w-10 h-14 sm:w-12 sm:h-16 text-xl sm:text-2xl font-black rounded-2xl dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/50 focus:border-orange-400 outline-none" />
                          <InputOTPSlot index={4} className="w-10 h-14 sm:w-12 sm:h-16 text-xl sm:text-2xl font-black rounded-2xl dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/50 focus:border-orange-400 outline-none" />
                          <InputOTPSlot index={5} className="w-10 h-14 sm:w-12 sm:h-16 text-xl sm:text-2xl font-black rounded-2xl dark:border-white/10 border-slate-200 dark:bg-white/5 bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/50 focus:border-orange-400 outline-none" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <div className="w-full space-y-4">
                      <Button
                        type="submit"
                        disabled={isLoading || otpToken.length !== 6}
                        className="group w-full bg-orange-600 text-white py-7 sm:py-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-500 active:scale-[0.98] transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:active:scale-100 shadow-[0_20px_40px_-10px_rgba(249,115,22,0.4)] border-t border-white/20"
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        ) : (
                          <span className="flex items-center gap-3">
                            Authorize Entry <ShieldCheck className="h-4 w-4 group-hover:scale-110 transition-transform duration-300" />
                          </span>
                        )}
                      </Button>

                      <button
                        type="button"
                        onClick={() => setShow2FA(false)}
                        className="w-full dark:text-slate-600 text-slate-500 dark:hover:text-white hover:text-slate-900 font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        <ArrowRight className="h-3 w-3 rotate-180" /> Back to Authentication
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center dark:text-slate-700 text-slate-400 text-[9px] font-black uppercase tracking-[0.4em]"
          >
            {t("auth.securedBy")}
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-3 text-center text-[10px] dark:text-slate-600 text-slate-500"
          >
            {t("auth.legalAgreement")}{' '}
            <Link to="/terms" className="text-orange-500 hover:text-orange-400 font-medium transition-colors">
              {t("common.terms")}
            </Link>
            {' '}{t("common.and")}{' '}
            <Link to="/privacy" className="text-orange-500 hover:text-orange-400 font-medium transition-colors">
              {t("common.privacy")}
            </Link>
            .
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
