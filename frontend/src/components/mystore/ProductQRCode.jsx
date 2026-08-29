import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Copy, Check, Printer, QrCode, AlertTriangle } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { productsAPI } from "@/api/apiClient";
import { useTranslation } from "react-i18next";

// A4 sticker sheet, 3 across and 4 down. Sized so a label still holds a QR big
// enough to scan from arm's length after being cut out and stuck on a product.
const SHEET = {
  pageWidth: 210,
  pageHeight: 297,
  margin: 10,
  cols: 3,
  rows: 4,
};
const CELL_W = (SHEET.pageWidth - SHEET.margin * 2) / SHEET.cols;
const CELL_H = (SHEET.pageHeight - SHEET.margin * 2) / SHEET.rows;

function truncate(text, max) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Draws one scan-to-pay label into a jsPDF document.
 *
 * Everything a shopper needs to act is on the label itself — what it is, what
 * it costs, and that scanning is how you pay for it — because the label often
 * ends up somewhere the product's own packaging isn't.
 */
function drawLabel(doc, label, col, row) {
  const x = SHEET.margin + col * CELL_W;
  const y = SHEET.margin + row * CELL_H;
  const pad = 4;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(x + 1.5, y + 1.5, CELL_W - 3, CELL_H - 3, 2.5, 2.5, "S");

  const qrSize = 34;
  const qrX = x + (CELL_W - qrSize) / 2;
  doc.addImage(label.png_data_url, "PNG", qrX, y + pad + 2, qrSize, qrSize);

  let cursor = y + pad + qrSize + 8;

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(truncate(label.title, 26), x + CELL_W / 2, cursor, { align: "center" });

  cursor += 6;
  doc.setFontSize(12);
  doc.setTextColor(234, 88, 12);
  doc.text(formatCurrency(label.price), x + CELL_W / 2, cursor, { align: "center" });

  cursor += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Scan to pay with Mobile Money", x + CELL_W / 2, cursor, { align: "center" });

  if (label.store_name) {
    cursor += 4.5;
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(truncate(label.store_name, 32), x + CELL_W / 2, cursor, { align: "center" });
  }
}

/**
 * Lays labels out across as many A4 pages as they need and saves the PDF.
 * Passing the same label repeatedly produces a sheet of one product; passing
 * one per product produces a sheet for the whole catalogue.
 */
export function buildLabelSheet(labels, filename) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const perPage = SHEET.cols * SHEET.rows;

  labels.forEach((label, index) => {
    const slot = index % perPage;
    if (index > 0 && slot === 0) doc.addPage();
    drawLabel(doc, label, slot % SHEET.cols, Math.floor(slot / SHEET.cols));
  });

  doc.save(filename);
}

function slugify(text) {
  return String(text || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "product";
}

export default function ProductQRCode({ product, open, onOpenChange }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const productId = product?.id || product?._id;

  const { data: qr, isLoading, isError, error } = useQuery({
    queryKey: ["productQr", productId],
    queryFn: () => productsAPI.qrCode(productId),
    enabled: !!productId && open,
    staleTime: Infinity,
  });

  const downloadPng = () => {
    const link = document.createElement("a");
    link.href = qr.png_data_url;
    link.download = `qr-${slugify(qr.title)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadSheet = () => {
    buildLabelSheet(Array.from({ length: 12 }, () => qr), `labels-${slugify(qr.title)}.pdf`);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(qr.pay_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("qr.linkCopied"));
    } catch {
      toast.error(t("qr.copyFailed"));
    }
  };

  // Printing straight from the dialog would drag the whole app's chrome onto
  // the page, so the label is rebuilt standalone in its own window.
  const printLabel = () => {
    const win = window.open("", "_blank", "width=460,height=640");
    if (!win) {
      toast.error(t("qr.popupBlocked"));
      return;
    }
    win.document.write(`<!doctype html><html><head><title>${qr.title}</title>
      <style>
        @page { margin: 12mm; }
        body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; text-align: center;
               color: #0f172a; margin: 0; padding: 24px; }
        img { width: 62mm; height: 62mm; }
        h1 { font-size: 15px; margin: 14px 0 4px; }
        .price { font-size: 20px; font-weight: 700; color: #ea580c; margin: 0 0 8px; }
        .hint { font-size: 11px; color: #475569; margin: 0; }
        .store { font-size: 10px; color: #94a3b8; margin-top: 4px; }
      </style></head><body>
      <img src="${qr.png_data_url}" alt="" />
      <h1>${qr.title.replace(/</g, "&lt;")}</h1>
      <p class="price">${formatCurrency(qr.price)}</p>
      <p class="hint">Scan to pay with Mobile Money</p>
      ${qr.store_name ? `<p class="store">${qr.store_name.replace(/</g, "&lt;")}</p>` : ""}
      <script>window.onload = function () { window.print(); };<\/script>
      </body></html>`);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-orange-500" />
            {t("qr.title")}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        )}

        {isError && (
          <div className="py-10 px-2 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 mx-auto text-amber-500" />
            <p className="text-sm text-slate-500 dark:text-ink-400">
              {error?.message || t("qr.loadFailed")}
            </p>
          </div>
        )}

        {qr && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-ink-400 leading-relaxed">
              {t("qr.description")}
            </p>

            <div className="rounded-2xl border border-slate-200 dark:border-ink-700 bg-white p-5 text-center">
              <img
                src={qr.png_data_url}
                alt={t("qr.title")}
                className="w-44 h-44 mx-auto"
              />
              <p className="mt-3 text-sm font-semibold text-slate-900 truncate">{qr.title}</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(qr.price)}</p>
              <p className="text-[11px] text-slate-500 mt-1">{t("qr.scanToPay")}</p>
              {qr.store_name && (
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{qr.store_name}</p>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-ink-800 border border-slate-100 dark:border-ink-700 px-3 py-2">
              <span className="flex-1 min-w-0 truncate text-[11px] text-slate-500 dark:text-ink-400">
                {qr.pay_url}
              </span>
              <button
                onClick={copyLink}
                className="p-1 rounded text-slate-400 hover:text-orange-500 transition-colors shrink-0"
                title={t("qr.copyLink")}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={downloadPng} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                {t("qr.downloadImage")}
              </Button>
              <Button onClick={downloadSheet} variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                {t("qr.downloadSheet")}
              </Button>
            </div>
            <Button onClick={printLabel} variant="ghost" className="w-full">
              <Printer className="w-4 h-4 mr-2" />
              {t("qr.print")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
