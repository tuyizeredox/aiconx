import React, { useCallback, useEffect, useState } from 'react';
import { settingsAPI } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/components/providers/LanguageContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// How often to silently re-check while the maintenance screen is showing, so
// the app recovers on its own once an admin turns maintenance mode back off
// instead of leaving visitors stuck until they manually refresh.
const RECHECK_INTERVAL_MS = 20_000;

export default function MaintenanceGate({ children }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [maintenance, setMaintenance] = useState({ active: false, message: '' });
  const [checking, setChecking] = useState(false);

  // Returns true once the backend confirms maintenance has ended.
  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      await settingsAPI.getPublic();
      setMaintenance({ active: false, message: '' });
      return true;
    } catch (error) {
      if (error.maintenance) {
        setMaintenance({ active: true, message: error.message });
      }
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  // Proactive check on mount, so a fresh page load lands straight on the
  // maintenance screen instead of flashing broken/empty content first.
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Reactive: any API call anywhere in the app that gets blocked by
  // maintenance mode dispatches this, so the gate can react immediately
  // without waiting for its own poll.
  useEffect(() => {
    const handleMaintenanceEvent = (event) => {
      setMaintenance({ active: true, message: event.detail?.message || '' });
    };
    window.addEventListener('maintenance:active', handleMaintenanceEvent);
    return () => window.removeEventListener('maintenance:active', handleMaintenanceEvent);
  }, []);

  useEffect(() => {
    if (!maintenance.active) return;
    const interval = setInterval(async () => {
      const recovered = await checkStatus();
      if (recovered) window.location.reload();
    }, RECHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [maintenance.active, checkStatus]);

  // Super admins are never blocked server-side, so this is just a defensive
  // mirror of that rule — it should never actually trigger for them.
  if (maintenance.active && user?.role !== 'super_admin') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center dark:bg-[#0a0a0c] bg-slate-50 px-6 text-center transition-colors">
        <div className="flex flex-col items-center gap-4 max-w-md">
          <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-orange-500" />
          </div>
          <h1 className="text-xl font-bold dark:text-white text-slate-900">{t('maintenance.title')}</h1>
          <p className="text-sm dark:text-slate-400 text-slate-500">
            {maintenance.message || t('maintenance.defaultMessage')}
          </p>
          <button
            type="button"
            onClick={async () => {
              const recovered = await checkStatus();
              if (recovered) window.location.reload();
            }}
            disabled={checking}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {t('maintenance.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return children;
}
