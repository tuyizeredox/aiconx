import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsAPI } from '@/api/apiClient';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const REASONS = [
  'spam',
  'nudity',
  'hate_speech',
  'violence',
  'false_information',
  'intellectual_property',
  'scam',
  'other',
];

export default function ReportModal({ isOpen, onOpenChange, targetId, targetType }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = (open) => {
    if (!open) {
      setReason('');
      setDescription('');
    }
    onOpenChange(open);
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error(t('report.selectReasonError'));
      return;
    }

    setIsSubmitting(true);
    try {
      await reportsAPI.create({
        target_id: targetId,
        target_type: targetType,
        reason,
        description,
      });
      toast.success(t('report.submitSuccess'));
      handleClose(false);
    } catch (error) {
      toast.error(error.message || t('report.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px] rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">{t('report.title')}</DialogTitle>
          <DialogDescription className="font-medium">
            {t('report.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason" className="text-sm font-bold">{t('report.reasonLabel')}</Label>
            <Select onValueChange={setReason} value={reason}>
              <SelectTrigger id="report-reason" className="rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                <SelectValue placeholder={t('report.reasonPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{t(`report.reasons.${r}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-description" className="text-sm font-bold">{t('report.detailsLabel')}</Label>
            <Textarea
              id="report-description"
              placeholder={t('report.detailsPlaceholder')}
              className="min-h-[100px] rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400 resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            className="rounded-xl font-bold"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold px-8"
          >
            {isSubmitting ? t('report.submitting') : t('report.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
