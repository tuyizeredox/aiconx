import * as React from "react";
import { cva } from "class-variance-authority";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-4 sm:right-4 sm:top-auto sm:flex-col md:max-w-[400px]"
    {...props}
  />
));
ToastProvider.displayName = "ToastProvider";

const ToastViewport = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-4 sm:right-4 sm:top-auto sm:flex-col md:max-w-[400px]"
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-4 pr-10 shadow-lg transition-all duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default:
          "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/80 dark:text-rose-200 shadow-[0_8px_32px_-8px_rgba(239,68,68,0.2)]",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/80 dark:text-emerald-200 shadow-[0_8px_32px_-8px_rgba(16,185,129,0.2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const toastIconMap = {
  default: <Info className="h-5 w-5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />,
  destructive: <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />,
};

const Toast = React.forwardRef(({ className, variant = "default", open = true, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-state={open ? "open" : "closed"}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {toastIconMap[variant] ?? toastIconMap.default}
      {props.children}
    </div>
  );
});
Toast.displayName = "Toast";

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-lg p-1 opacity-60 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none",
      "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
      "group-[.destructive]:text-rose-400 group-[.destructive]:hover:text-rose-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </button>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-bold leading-tight", className)}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs mt-0.5 opacity-80 leading-relaxed", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
