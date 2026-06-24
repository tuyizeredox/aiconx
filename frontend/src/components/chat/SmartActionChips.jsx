import React from 'react';
import { motion } from 'framer-motion';
import { Package, Heart, Sparkles, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function SmartActionChips({ onChipClick }) {
  const { t } = useTranslation();

  const CHIPS = [
    { labelKey: "ai.chip_lastOrder", icon: Package },
    { labelKey: "ai.chip_wishlist", icon: Heart },
    { labelKey: "ai.chip_dailyPicks", icon: Sparkles },
    { labelKey: "ai.chip_trending", icon: ShoppingBag },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
      {CHIPS.map((chip, i) => (
        <motion.button
          key={chip.labelKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onChipClick(t(chip.labelKey))}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full text-xs text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-950 hover:border-orange-100 dark:hover:border-orange-800 hover:text-orange-700 dark:hover:text-orange-400 transition-all whitespace-nowrap shadow-sm shrink-0"
        >
          <chip.icon className="w-3 h-3 text-orange-500" />
          {t(chip.labelKey)}
        </motion.button>
      ))}
    </div>
  );
}
