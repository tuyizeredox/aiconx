import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, ArrowRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyITECPayPayment } from '@/lib/itecpay';
import { cartAPI } from '@/api/apiClient';
import { createPageUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function PaymentSuccess() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const navigate = useNavigate();
  const queryClient = useQueryClient();

useEffect(() => {
    const verify = async () => {
      if (!reference) {
        setStatus('error');
        return;
      }

      try {
        const response = await verifyITECPayPayment(reference);
        if (response.status === 200 && response.data?.status) {
          const paymentStatus = response.data.status.toUpperCase();
          if (paymentStatus === 'SUCCESS' || paymentStatus === 'PAID' || paymentStatus === 'COMPLETED') {
            await cartAPI.clear();
            localStorage.removeItem('iqon_ref');
            localStorage.removeItem('iqon_ref_time');
            queryClient.invalidateQueries({ queryKey: ['cart'] });
            setStatus('success');
            toast.success('Payment verified successfully!');
          } else {
            setStatus('error');
            toast.error('Payment verification failed');
          }
        } else {
          setStatus('error');
          toast.error('Payment verification failed');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        toast.error('An error occurred during verification');
      }
    };

    verify();
  }, [reference, queryClient]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] border border-slate-100 p-8 text-center shadow-2xl shadow-slate-200/50">
        {status === 'verifying' && (
          <div className="py-12">
            <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-6" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">{t("payment.verifying")}</h1>
            <p className="text-slate-500 font-medium">{t("payment.verifyingDesc")}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-8">
            <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-green-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">{t("payment.success")}</h1>
            <p className="text-slate-500 font-medium mb-8">{t("payment.successDesc")}</p>
            <div className="grid gap-3">
              <Button asChild className="bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-bold w-full">
                <Link to={createPageUrl("Orders")}>
                  {t("payment.viewOrders")} <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-xl font-bold w-full border-slate-200">
                <Link to={createPageUrl("Marketplace")}>
                  {t("payment.continueShopping")} <ShoppingBag className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="py-8">
            <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-600">
              <XCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-3">{t("payment.failed")}</h1>
            <p className="text-slate-500 font-medium mb-8">{t("payment.failedDesc")}</p>
            <Button asChild variant="outline" className="h-12 rounded-xl font-bold w-full border-slate-200">
              <Link to={createPageUrl("Checkout")}>
                {t("payment.tryAgain")}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
