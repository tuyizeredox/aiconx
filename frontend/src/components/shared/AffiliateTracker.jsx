import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { affiliateLinksAPI } from '@/api/apiClient';

/**
 * AffiliateTracker Component
 * Captures 'ref' query parameter from URL, tracks clicks, and stores in localStorage
 */
export default function AffiliateTracker() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');

  useEffect(() => {
    if (ref) {
      // 0. Use sessionStorage to avoid tracking multiple times in the same session
      const sessionKey = `iqon_ref_tracked_${ref}`;
      if (sessionStorage.getItem(sessionKey)) return;
      
      // 1. Store in localStorage for conversion tracking later (checkout)
      localStorage.setItem('iqon_ref', ref);
      localStorage.setItem('iqon_ref_time', Date.now().toString());

      // 2. Track click in backend
      const trackClick = async () => {
        try {
          await affiliateLinksAPI.trackClick(ref);
          sessionStorage.setItem(sessionKey, '1');
          // console.log(`[Affiliate] Tracked click for ref: ${ref}`); // Removed production log
        } catch (error) {
          console.error('[Affiliate] Failed to track click:', error);
        }
      };

      trackClick();
    }
  }, [ref]);

  return null;
}
