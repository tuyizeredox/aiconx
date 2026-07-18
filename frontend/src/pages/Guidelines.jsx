import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import Logo from '@/components/layout/Logo';

const Guidelines = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full dark:bg-[#0a0a0c] bg-slate-50 font-sans transition-colors duration-300">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between mb-8 sm:mb-12"
        >
          <Link
            to="/welcome"
            className="inline-flex items-center gap-2 text-sm font-semibold dark:text-slate-400 text-slate-600 hover:text-orange-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Link>
          <Logo size="sm" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="dark:bg-white/[0.02] bg-white rounded-2xl sm:rounded-3xl dark:border dark:border-white/10 border border-slate-200/80 p-6 sm:p-10 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_96px_-12px_rgba(0,0,0,0.7)]"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-slate-900 tracking-tight">
              {t("legal.guidelinesTitle")}
            </h1>
          </div>

          <p className="text-sm dark:text-slate-400 text-slate-500 mb-8">
            {t("legal.lastUpdated")}
          </p>

          <div className="space-y-8 text-sm dark:text-slate-300 text-slate-600 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.guidelinesIntro")}</h2>
              <p>
                Aicon X is a community of buyers, sellers, and creators. These guidelines exist so everyone can trade, share, and connect safely. By using Aicon X, you agree to follow them — every user, vendor, and affiliate, no exceptions.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.guidelinesRespect")}</h2>
              <p>
                Treat others the way you'd want to be treated. Hate speech, harassment, bullying, threats, and content that attacks someone's identity, race, religion, gender, or nationality are never allowed, in posts, comments, messages, or usernames.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.guidelinesProhibited")}</h2>
              <p>
                The following are prohibited anywhere on the platform: spam or repetitive unwanted content; nudity or sexually explicit material; graphic violence or content that promotes it; scams, fraud, or deceptive practices; and content that is illegal where you or your audience are located.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.guidelinesVendors")}</h2>
              <p>
                Vendors must list products honestly — accurate photos, descriptions, pricing, and availability. Counterfeit goods, misleading claims, and bait-and-switch listings are not tolerated and put your store at risk of suspension.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.guidelinesIP")}</h2>
              <p>
                Only post or sell content and products you own or have permission to use. Don't upload copyrighted media, counterfeit branded goods, or content that infringes someone else's intellectual property.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.guidelinesReporting")}</h2>
              <p>
                If you see something that breaks these guidelines, report it — every post and product has a Report option. Our team reviews reports and takes action, from removing content to suspending accounts, depending on severity.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.guidelinesConsequences")}</h2>
              <p>
                Violations can result in content removal, temporary restrictions, or permanent suspension, depending on severity and whether it's a repeat offense. We'll always try to tell you what happened and why when we take action on your account.
              </p>
            </section>
          </div>
        </motion.div>

        <p className="mt-8 text-center text-xs dark:text-slate-600 text-slate-400">
          © {new Date().getFullYear()} Aicon X. {t("legal.allRightsReserved")}
        </p>
      </div>
    </div>
  );
};

export default Guidelines;
