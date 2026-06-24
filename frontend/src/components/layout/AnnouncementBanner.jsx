import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { announcementsAPI } from '@/api/apiClient';
import { X, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AnnouncementBanner() {
  const [dismissedIds, setDismissedIds] = useState([]);

  const { data: response, isLoading } = useQuery({
    queryKey: ['activeAnnouncements'],
    queryFn: () => announcementsAPI.getActive(),
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const announcements = response?.announcements || [];
  const visibleAnnouncements = announcements.filter(a => !dismissedIds.includes(a._id));

  if (isLoading || visibleAnnouncements.length === 0) return null;

  const handleDismiss = (id) => {
    setDismissedIds(prev => [...prev, id]);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'success': return <CheckCircle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = (type) => {
    switch (type) {
      case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400';
      case 'error': return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400';
      case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400';
      default: return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-400';
    }
  };

  return (
    <div className="w-full space-y-2 mb-4 px-4 lg:px-8 mt-4">
      {visibleAnnouncements.map((a) => (
        <div 
          key={a._id} 
          className={`relative flex items-start gap-3 p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300 ${getStyles(a.type)}`}
        >
          <div className="mt-0.5 shrink-0">
            {getIcon(a.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm leading-tight mb-1">{a.title}</h4>
            <p className="text-sm opacity-90">{a.content}</p>
          </div>
          <button 
            onClick={() => handleDismiss(a._id)}
            className="shrink-0 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
