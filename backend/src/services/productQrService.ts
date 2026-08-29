import QRCode from 'qrcode';

/**
 * QR codes for physical products.
 *
 * A vendor downloads a product's QR code, sticks it on the real item, and a
 * shopper standing in front of that item scans it, types their phone number and
 * pays on the spot — no account, no cart, no checkout form. The scan lands on
 * the public /pay page, which talks to routes/qrPay.ts.
 *
 * The encoded URL is deliberately NOT read from FRONTEND_URL: that still points
 * at an old preview deployment, and a printed sticker outlives env churn — once
 * it's on a product it can never be corrected. QR_BASE_URL overrides the
 * canonical domain for self-hosted or staging setups.
 */
const CANONICAL_APP_ORIGIN = 'https://aiconx.net';

export function getQrBaseUrl(): string {
  const raw = process.env.QR_BASE_URL || process.env.PUBLIC_APP_URL || CANONICAL_APP_ORIGIN;
  return raw.trim().replace(/\/+$/, '');
}

export function buildProductPayUrl(productId: string): string {
  return `${getQrBaseUrl()}/pay?p=${encodeURIComponent(productId)}`;
}

export interface ProductQrCode {
  pay_url: string;
  png_data_url: string;
  svg: string;
}

/**
 * Renders a product's pay link as both a high-resolution PNG (what the vendor
 * downloads and prints) and an SVG (crisp at any label size, used for the
 * printable sheet). Error correction is level Q — 25% of the code can be
 * scuffed, smudged or peeled and it still scans, which matters a lot more on a
 * sticker stuck to a physical product than it does on a screen.
 */
export async function generateProductQr(
  productId: string,
  options: { size?: number } = {}
): Promise<ProductQrCode> {
  const payUrl = buildProductPayUrl(productId);
  const width = Math.min(2048, Math.max(256, Math.round(options.size || 1024)));

  const renderOptions = {
    margin: 2,
    errorCorrectionLevel: 'Q' as const,
    color: { dark: '#0f172a', light: '#ffffff' },
  };

  const [png_data_url, svg] = await Promise.all([
    QRCode.toDataURL(payUrl, { ...renderOptions, width, type: 'image/png' }),
    QRCode.toString(payUrl, { ...renderOptions, type: 'svg' }),
  ]);

  return { pay_url: payUrl, png_data_url, svg };
}
