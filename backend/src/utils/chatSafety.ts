// Blocks off-platform payment solicitation in buyer-vendor chat. Purchases must go
// through checkout — this is a keyword/pattern heuristic, not a guarantee: determined
// evasion (spelled-out digits, deliberate misspellings) isn't caught. It's meant to stop
// the common, casual case ("just pay me on WhatsApp"), not defeat a motivated bad actor.
const PAYMENT_KEYWORDS = [
  'mobile money', 'momo', 'bank account', 'account number', 'whatsapp', 'telegram',
  'wire transfer', 'western union', 'moneygram', 'paypal', 'cash app', 'venmo',
  'send money', 'transfer money', 'off platform', 'off-platform', 'outside the app',
  'outside this app', 'pay me', 'pay directly', 'direct payment', 'pay you directly',
];

// A run of 7+ digits (allowing spaces/dashes/parens in between) — phone numbers,
// account numbers, mobile money numbers.
const DIGIT_RUN_REGEX = /(?:\d[\s\-().]?){7,}/;

export function checkPaymentSolicitation(content: string): { blocked: boolean; reason?: string } {
  if (!content) return { blocked: false };
  const lower = content.toLowerCase();

  const matchedKeyword = PAYMENT_KEYWORDS.find((kw) => lower.includes(kw));
  if (matchedKeyword) {
    return { blocked: true, reason: 'payment_keyword' };
  }

  if (DIGIT_RUN_REGEX.test(content)) {
    return { blocked: true, reason: 'number_sequence' };
  }

  return { blocked: false };
}
