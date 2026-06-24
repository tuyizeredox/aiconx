import React, { useState } from 'react';
import { Mail, MessageCircle, ArrowLeft, ShieldCheck, LifeBuoy, Clock, Sparkles, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/lib/utils';
import { reportsAPI } from '@/api/apiClient';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Support() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportData, setReportData] = useState({
    reason: '',
    description: '',
  });
  
  const supportChannels = [
    {
      title: t('support.channels.aiAssistant.title'),
      description: t('support.channels.aiAssistant.description'),
      icon: Sparkles,
      action: t('support.channels.aiAssistant.action'),
      color: "bg-pink-500",
      onClick: () => navigate(createPageUrl("AIAssistant")),
    },
    {
      title: t('support.channels.liveChat.title'),
      description: t('support.channels.liveChat.description'),
      icon: MessageCircle,
      action: t('support.channels.liveChat.action'),
      color: "bg-orange-500",
      onClick: () => navigate(createPageUrl("Chat") + "?to=support"),
    },
    {
      title: t('support.channels.reportIssue.title'),
      description: t('support.channels.reportIssue.description'),
      icon: Flag,
      action: t('support.channels.reportIssue.action'),
      color: "bg-orange-500",
      onClick: () => setIsReportOpen(true),
    },
    {
      title: t('support.channels.emailSupport.title'),
      description: t('support.channels.emailSupport.description'),
      icon: Mail,
      action: t('support.channels.emailSupport.action'),
      color: "bg-orange-600",
      onClick: () => {
        const a = document.createElement('a');
        a.href = 'mailto:support@iqon.ai';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      },
    }
  ];

  const handleReportSubmit = async () => {
    if (!reportData.reason) {
      toast.error(t('support.report.selectReasonError'));
      return;
    }

    setIsSubmitting(true);
    try {
      await reportsAPI.create({
        target_id: "000000000000000000000000",
        target_type: "user",
        reason: reportData.reason,
        description: reportData.description
      });
      toast.success(t('support.report.submitSuccess'));
      setIsReportOpen(false);
      setReportData({ reason: '', description: '' });
    } catch (error) {
      toast.error(error.message || t('support.report.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    { q: t('support.faq.q1'), a: t('support.faq.a1') },
    { q: t('support.faq.q2'), a: t('support.faq.a2') },
    { q: t('support.faq.q3'), a: t('support.faq.a3') },
    { q: t('support.faq.q4'), a: t('support.faq.a4') },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link 
        to={createPageUrl("Home")} 
        className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('support.backToHome')}
      </Link>

      <div className="text-center mb-16">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">{t('support.title')}</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto font-medium">
          {t('support.subtitle')}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {supportChannels.map((channel, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/30 text-center flex flex-col items-center group hover:border-orange-100 dark:hover:border-orange-700 transition-all">
            <div className={`w-14 h-14 rounded-2xl ${channel.color} flex items-center justify-center text-white mb-6 shadow-lg shadow-slate-200 dark:shadow-slate-900/50 group-hover:scale-110 transition-transform`}>
              <channel.icon className="w-7 h-7" />
            </div>
            <h3 className="font-black text-lg mb-2 text-slate-900 dark:text-white">{channel.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-6 leading-relaxed flex-1">
              {channel.description}
            </p>
            <Button 
              onClick={channel.onClick}
              className="w-full rounded-xl font-bold bg-slate-900 hover:bg-black text-white"
            >
              {channel.action}
            </Button>
          </div>
        ))}
      </div>

      <div className="bg-indigo-600 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full mb-6">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">{t('support.buyerProtection.badge')}</span>
            </div>
            <h2 className="text-3xl font-black mb-4 tracking-tight">{t('support.buyerProtection.title')}</h2>
            <p className="text-white/80 text-sm font-medium leading-relaxed mb-6">
              {t('support.buyerProtection.description')}
            </p>
            <div className="flex flex-wrap gap-4">
               <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-200" />
                  <span className="text-xs font-bold">{t('support.buyerProtection.monitoring')}</span>
               </div>
               <div className="flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-indigo-200" />
                  <span className="text-xs font-bold">{t('support.buyerProtection.prioritySupport')}</span>
               </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[2.5rem] p-6 md:p-8">
            <h4 className="font-black mb-6 text-lg">{t('support.faq.title')}</h4>
            <Accordion type="single" collapsible className="w-full space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-white/10 border-b last:border-0">
                  <AccordionTrigger className="text-sm font-bold py-4 hover:text-indigo-200 hover:no-underline text-left">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-indigo-100 text-xs leading-relaxed font-medium pb-4">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{t('support.report.title')}</DialogTitle>
            <DialogDescription className="font-medium">
              {t('support.report.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-bold">{t('support.report.reasonLabel')}</Label>
              <Select onValueChange={(v) => setReportData({ ...reportData, reason: v })} value={reportData.reason}>
                <SelectTrigger id="reason" className="rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                  <SelectValue placeholder={t('support.report.reasonPlaceholder')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Bug Report">{t('support.report.reasons.bugReport')}</SelectItem>
                  <SelectItem value="Safety Concern">{t('support.report.reasons.safetyConcern')}</SelectItem>
                  <SelectItem value="Technical Issue">{t('support.report.reasons.technicalIssue')}</SelectItem>
                  <SelectItem value="Vendor Issue">{t('support.report.reasons.vendorIssue')}</SelectItem>
                  <SelectItem value="Feedback">{t('support.report.reasons.feedback')}</SelectItem>
                  <SelectItem value="Other">{t('support.report.reasons.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold">{t('support.report.detailsLabel')}</Label>
              <Textarea
                id="description"
                placeholder={t('support.report.detailsPlaceholder')}
                className="min-h-[120px] rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400 resize-none"
                value={reportData.description}
                onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsReportOpen(false)}
              className="rounded-xl font-bold"
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleReportSubmit}
              disabled={isSubmitting}
              className="bg-slate-900 hover:bg-black text-white rounded-xl font-bold px-8"
            >
              {isSubmitting ? t('support.report.submitting') : t('support.report.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
