import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import Logo from '@/components/layout/Logo';

const Terms = () => {
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
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-slate-900 tracking-tight">
              {t("legal.termsTitle")}
            </h1>
          </div>

          <p className="text-sm dark:text-slate-400 text-slate-500 mb-8">
            {t("legal.lastUpdated")}
          </p>

          <div className="space-y-8 text-sm dark:text-slate-300 text-slate-600 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.termsAcceptance")}</h2>
              <p>
                Welcome to Aicon X. These Terms of Service govern your use of our platform, services, and applications. By accessing or using Aicon X, you agree to be bound by these terms. If you do not agree to these terms, please do not use our platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.termsUseOfService")}</h2>
              <p>
                You must be at least 16 years old to use Aicon X. By creating an account, you represent that you are of legal age and have the capacity to enter into these terms. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>
              <p>
                You agree to use Aicon X only for lawful purposes and in accordance with these terms. You may not use the platform to distribute harmful, illegal, or infringing content, or to engage in fraudulent, abusive, or harassing behavior.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.termsAccounts")}</h2>
              <p>
                When you create an account, you must provide accurate and complete information. You may not impersonate others or use misleading usernames. We reserve the right to suspend or terminate accounts that violate these terms or that are inactive for extended periods.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.termsTransactions")}</h2>
              <p>
                Aicon X enables social commerce between users, vendors, and affiliates. All transactions are subject to our platform policies. Vendors are responsible for accurately listing products, fulfilling orders, and complying with applicable laws. Buyers agree to pay for purchases in accordance with the listed terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.termsLimitation")}</h2>
              <p>
                Aicon X is provided "as is" without warranties of any kind. To the extent permitted by law, we shall not be liable for indirect, incidental, or consequential damages arising from your use of the platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.termsChanges")}</h2>
              <p>
                We may update these terms from time to time. We will notify you of significant changes by posting the updated terms on the platform. Your continued use of Aicon X after changes constitutes acceptance of the revised terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold dark:text-white text-slate-900">{t("legal.termsContact")}</h2>
              <p>
                If you have any questions about these Terms of Service, please contact us through our Support page.
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

export default Terms;
