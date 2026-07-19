import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/lib/utils";

// Matches the back-link convention already used on ProductDetail/Cart/Checkout/etc:
// a fixed, hardcoded destination (not history-based navigate(-1)) so it still works
// when the page was opened directly (deep link, push notification, affiliate link).
export default function BackLink({ to, label, className = "" }) {
  return (
    <Link
      to={createPageUrl(to)}
      className={`inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" /> {label}
    </Link>
  );
}
