import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import Logo from '@/components/layout/Logo';

const Privacy = () => {
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
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-slate-900 tracking-tight">
              {t("legal.privacyTitle")}
            </h1>
          </div>

          <p className="text-sm dark:text-slate-400 text-slate-500 mb-8">
            {t("legal.lastUpdated")}
          </p>

          <div className="space-y-8 text-sm dark:text-slate-300 text-slate-600 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.privacyIntroduction")}</h2>
              <p>
                At Aicon X, we respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and safeguard your data when you use our platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.privacyInformation")}</h2>
              <p>
                We collect information that you provide directly, such as your name, email address, username, profile information, and payment details. We also collect usage data, device information, and cookies to improve your experience and ensure platform security.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.privacyUse")}</h2>
              <p>
                We use your information to provide and improve our services, process transactions, personalize your experience, communicate with you, and comply with legal obligations. We do not sell your personal information to third parties.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.privacySharing")}</h2>
              <p>
                We may share your information with trusted service providers who help us operate the platform, with other users as necessary for transactions and social features, or when required by law. We require all partners to handle your data responsibly and in accordance with this policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.privacySecurity")}</h2>
              <p>
                We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is completely secure. We encourage you to use strong passwords and report any suspicious activity immediately.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.privacyRights")}</h2>
              <p>
                You have the right to access, update, or delete your personal information. You can manage most of your data through your account settings. For additional requests, please contact our support team.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.privacyChanges")}</h2>
              <p>
                We may update this Privacy Policy periodically. We will notify you of significant changes by posting the updated policy on our platform. Please review this page regularly to stay informed about our privacy practices.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.privacyContact")}</h2>
              <p>
                If you have any questions or concerns about this Privacy Policy, please contact us through our Support page.
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

export default Privacy;
