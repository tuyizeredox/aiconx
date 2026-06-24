import React, { useState } from "react";
import { authAPI } from "@/api/apiClient";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/layout/Logo";
import { ArrowLeft, Mail, Loader2, CheckCircle2, Sun, Moon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState("");
  const { resolvedTheme, setTheme } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email);
      setSubmitted(true);
      toast({ title: "Recovery link sent!", description: `Check your inbox at ${email} for reset instructions.`, variant: "success" });
      if (res.dev_token) {
        setDevToken(res.dev_token);
      }
    } catch (err) {
      const msg = err.message || "Something went wrong";
      toast({ title: "Request failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center dark:bg-[#0a0a0c] bg-slate-50 selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden font-sans transition-colors duration-300">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 dark:bg-[radial-gradient(circle_at_50%_50%,rgba(17,17,19,1)_0%,rgba(0,0,0,1)_100%)] bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100" />

        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 80, 0], y: [0, 40, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] dark:bg-orange-600/10 bg-orange-400/15 rounded-full blur-[120px]"
        />

        <div className="absolute inset-0 dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="absolute top-4 right-4 z-20">
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

      <div className="max-w-md w-full relative z-10 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="dark:bg-white/[0.02] bg-white dark:backdrop-blur-3xl backdrop-blur-xl p-8 sm:p-12 rounded-3xl sm:rounded-[3rem] dark:shadow-[0_32px_128px_-16px_rgba(0,0,0,0.7)] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.08)] dark:border dark:border-white/10 border border-slate-200/80 dark:ring-1 dark:ring-white/5 relative overflow-hidden group text-center transition-colors duration-300"
        >
          <Link to={createPageUrl("login")} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest dark:text-slate-500 text-slate-500 hover:text-orange-500 mb-8 transition-colors group/back">
            <ArrowLeft className="w-3 h-3 group-hover/back:-translate-x-1 transition-transform" /> Back to Access
          </Link>

          {!submitted ? (
            <div className="space-y-10">
              <div className="text-center space-y-6">
                <Logo size="lg" className="flex-col !gap-6 mx-auto" subtext="Recovery Protocol" showDecoration={true} />
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="email" className="text-[10px] font-black dark:text-slate-500 text-slate-500 uppercase tracking-[0.2em] ml-1">Identity Email</Label>
                  <div className="relative group">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-12 pr-4 py-6 sm:py-7 rounded-2xl dark:border-white/5 border-slate-200 dark:bg-white/[0.03] bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/40 focus:border-orange-400 dark:focus:bg-white/[0.05] focus:bg-white outline-none transition-all duration-300 font-bold dark:group-hover:border-white/10 group-hover:border-slate-300 dark:placeholder:text-slate-700 placeholder:text-slate-400 placeholder:font-medium"
                      required
                      autoComplete="email"
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 dark:text-slate-600 text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300" />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="group w-full bg-orange-600 text-white py-7 sm:py-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-500 active:scale-[0.98] transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:active:scale-100 shadow-[0_20px_40px_-10px_rgba(249,115,22,0.4)] hover:shadow-[0_20px_40px_-10px_rgba(249,115,22,0.6)] border-t border-white/20"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : t("auth.resetPassword")}
                </Button>
              </form>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/20">
                <CheckCircle2 className="w-10 h-10 text-orange-500" />
              </div>
              <h2 className="text-3xl font-black dark:text-white text-slate-900 mb-3 tracking-tighter">Link Sent!</h2>
              <p className="text-sm dark:text-slate-500 text-slate-500 mb-8 leading-relaxed font-medium">
                If an account exists for <b className="dark:text-white text-slate-800">{email}</b>, you will receive an email with instructions shortly.
              </p>

              {import.meta.env.DEV && devToken && (
                <div className="p-6 dark:bg-orange-500/5 bg-orange-50 rounded-[2rem] dark:border dark:border-orange-500/10 border border-orange-200 mb-8">
                  <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-3 opacity-60">Development Token</p>
                  <p className="text-xl font-mono font-bold dark:text-white text-slate-900 break-all">{devToken}</p>
                  <Link
                    to={createPageUrl("resetpassword") + `?token=${devToken}`}
                    className="mt-4 inline-block text-[10px] font-black text-orange-500 hover:text-orange-400 uppercase tracking-widest"
                  >
                    Go to Reset Page
                  </Link>
                </div>
              )}

              <Link to={createPageUrl("login")}>
                <Button variant="outline" className="w-full h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest dark:border-white/5 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all active:scale-[0.98]">
                  Return to Access
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
