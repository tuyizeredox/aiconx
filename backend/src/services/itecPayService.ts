import { Order } from '../models/Order';
import { VendorSubscription } from '../models/VendorSubscription';
import { PLAN_PRIORITY, PLAN_LIMITS } from '../middleware/subscription';
import { Product } from '../models/Product';
import { Settings } from '../models/Settings';
import { creditAffiliateConversions } from './affiliateService';
import axios from 'axios';

export interface ITECPayPaymentResponse {
  status: number;
  data: {
    financial_transaction_id?: string;
    transaction_id: string;
    amount: string;
    currency: string;
    status: string;
  };
}

export interface ITECPayCardResponse {
  status: number;
  PCODE: string;
  amount: number;
  link: string;
  valid_until: string;
}

export interface ITECPayVerifyResponse {
  status: number;
  data: {
    transaction_id: string;
    amount: string;
    status: string;
  };
}

export interface ITECPayCallbackData {
  transaction_id?: string;
  amount?: string;
  status?: string;
}

export const itecPayService = {
  /**
   * Initialize a mobile money payment via ITEC Pay (api2/pay)
   * Supports MTN Mobile Money, Airtel Money, and Spenn
   */
  normalizePhone(phone: string): string {
    // Strip spaces, dashes, parentheses
    let p = phone.replace(/[\s\-().]/g, '');
    // Remove leading + 
    if (p.startsWith('+')) p = p.slice(1);
    // Convert international Rwanda prefix 250 -> local 0
    if (p.startsWith('250') && p.length === 12) {
      p = '0' + p.slice(3);
    }
    // Ensure starts with 07 or 08 (Rwanda MTN/Airtel)
    if (!p.startsWith('0') && p.length === 9) {
      p = '0' + p;
    }
    return p;
  },

  async initializeMobileMoneyPayment(
    amount: number,
    phone: string,
    provider: 'mtn' | 'airtel' | 'spenn' = 'mtn',
    reqRef?: string,
    note?: string,
    message?: string
  ): Promise<ITECPayPaymentResponse> {
    try {
      const apiKeyMap: Record<string, string> = {
        mtn: process.env.ITECPAY_API_KEY_MOBILE_MONEY || '',
        airtel: process.env.ITECPAY_API_KEY_AIRTEL_MONEY || '',
        spenn: process.env.ITECPAY_API_KEY_MOBILE_MONEY || '', // Using MTN key for Spenn if not provided
      };

      const apiKey = apiKeyMap[provider];

      if (!apiKey) {
        throw new Error(`ITEC Pay API key not configured for provider: ${provider}`);
      }

      const normalizedPhone = this.normalizePhone(phone);
      console.log(`ITEC Pay Mobile Money: provider=${provider}, phone=${normalizedPhone}, amount=${amount}, reqRef=${reqRef}`);

      const data: any = {
        amount: Number(amount),
        phone: normalizedPhone,
        key: apiKey,
        req_ref: reqRef || crypto.randomUUID(),
      };

      console.log('ITEC Pay request params:', JSON.stringify(data));

      const response = await axios.post(
        'https://pay.itecpay.rw/api2/pay',
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('ITEC Pay Mobile Money Error - Full response:', JSON.stringify(error.response?.data || error.message));
      console.error('ITEC Pay Mobile Money Error - Status:', error.response?.status);

      let errorMessage = error.response?.data?.message || error.response?.data?.data?.message || error.message || 'Failed to initialize ITEC Pay mobile money payment';

      if (error.response?.status === 400) {
        errorMessage = error.response?.data?.data?.message || 'ITEC Pay authentication failed. Please check your API key.';
      }

      const newError: any = new Error(errorMessage);
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Initialize a card payment via ITEC Pay (pesapal/generatecode)
   */
  async initializeCardPayment(
    amount: number,
    email: string,
    reqRef?: string
  ): Promise<ITECPayCardResponse> {
    try {
      const apiKey = process.env.ITECPAY_API_KEY_CARD;

      if (!apiKey) {
        console.error('ITEC Pay card API key is missing from environment variables');
        throw new Error('Card payment is not configured. Please contact support to enable card payments.');
      }

      if (!email || email === '' || email === 'undefined' || email === 'null') {
        console.error('ITEC Pay card payment: Invalid email provided:', email);
        throw new Error('Email is required for card payment. Please update your profile with a valid email address.');
      }

      const data: any = {
        amount: Number(amount),
        email: email.trim(),
        key: apiKey,
        req_ref: reqRef,       // include reference — required by some ITEC Pay versions
        currency: 'RWF',
      };

      // Add callback URL if configured
      const callbackUrl = process.env.ITECPAY_CALLBACK_URL;
      if (callbackUrl) {
        data.callback_url = callbackUrl;
      }

      console.log('ITEC Pay Card Request:', { amount, email: email?.trim(), hasApiKey: !!apiKey, reqRef, emailType: typeof email });

      const response = await axios.post(
        'https://pay.itecpay.rw/api/pay/apis/pesapal/generatecode',
        data,
        { headers: { 'Content-Type': 'application/json' } }
      );

      console.log('ITEC Pay Card Raw Response:', JSON.stringify(response.data, null, 2));

      // Surface any explicit failure message from the API body
      const bodyMsg: string = response.data?.message || response.data?.error || '';
      const bodyStatus = response.data?.status;
      const isFailure =
        (bodyMsg && /fail|error|invalid|denied|initiate failed/i.test(bodyMsg)) ||
        (bodyStatus !== undefined && Number(bodyStatus) !== 200 && bodyStatus !== true && bodyStatus !== 'success');

      if (isFailure) {
        console.error('ITEC Pay card API error:', response.data);
        // Provide user-friendly error message
        if (bodyStatus === 500 || bodyMsg.includes('Initiate failed')) {
          throw new Error('Card payment service is temporarily unavailable. Please try again later or use mobile money payment.');
        }
        throw new Error(bodyMsg || `Card payment gateway error (status: ${bodyStatus})`);
      }

      // Validate PCODE exists and is valid
      const pcode = response.data?.PCODE;
      if (!pcode || pcode === null || pcode === 'null' || pcode === '') {
        // This is the root cause - API returned success but no PCODE
        // Usually means invalid API key or account not configured for this payment type
        const apiKeyValue = process.env.ITECPAY_API_KEY_CARD ? 'configured' : 'missing';
        console.error('ITEC Pay returned null PCODE - API key status:', apiKeyValue, '- Full response:', response.data);
        throw new Error('Card payment is not available. Please use mobile money payment or contact support.');
      }

      // Validate link exists
      if (!response.data?.link) {
        console.error('ITEC Pay returned no link - Full response:', response.data);
        throw new Error('Invalid response from payment gateway - no payment link provided');
      }

      // Log the generated payment details
      console.log('ITEC Pay Payment Initialized:', {
        pcode: pcode,
        link: response.data.link,
        amount: response.data.amount,
        valid_until: response.data.valid_until
      });

      // Construct the correct payment URL from ITEC Pay documentation
      // The API returns: "link": "https://pay.itecpay.rw/api/pay/apis/pesapal/index?PCODE=..."
      const paymentUrl = response.data.link || `https://pay.itecpay.rw/api/pay/apis/pesapal/index?PCODE=${pcode}`;

      return {
        ...response.data,
        link: paymentUrl
      };
    } catch (error: any) {
      console.error('ITEC Pay Card Payment Error:', error.response?.data || error.message);

      // Provide user-friendly error messages
      if (error.response?.status === 500) {
        throw new Error('Card payment service is temporarily unavailable. Please try again later or use mobile money payment.');
      }

      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to initialize ITEC Pay card payment';
      const newError: any = new Error(errorMessage);
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Verify payment status via ITEC Pay
   */
  async verifyPayment(reqRef: string, provider: 'mtn' | 'airtel' | 'spenn' | 'card' = 'mtn'): Promise<ITECPayVerifyResponse> {
    try {
      const apiKeyMap: Record<string, string> = {
        mtn: process.env.ITECPAY_API_KEY_MOBILE_MONEY || '',
        airtel: process.env.ITECPAY_API_KEY_AIRTEL_MONEY || '',
        spenn: process.env.ITECPAY_API_KEY_MOBILE_MONEY || '',
        card: process.env.ITECPAY_API_KEY_CARD || '',
      };

      const apiKey = apiKeyMap[provider];

      if (!apiKey) {
        throw new Error(`ITEC Pay API key not configured for provider: ${provider}`);
      }

      const response = await axios.post(
        'https://pay.itecpay.rw/api2/verify',
        {
          action: 'status_check',
          req_ref: reqRef,
          key: apiKey,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('ITEC Pay Verify Response:', JSON.stringify(response.data));

      // Validate that payment is actually successful
      const res = response.data as any;
      const successfulStatuses = ['completed', 'success', 'paid', 'approved'];
      // Prefer explicit transaction/payment status fields. A bare "status" field is
      // often just the HTTP-style envelope code (e.g. 200) and does NOT confirm the
      // transaction itself succeeded — trusting it caused cancelled payments to be
      // approved, so it's only used as a last resort and never auto-treated as success.
      const status = String(
        res.transaction_status ||
        res.data?.transaction_status ||
        res.payment_status ||
        res.data?.payment_status ||
        res.data?.status ||
        res.status ||
        ''
      ).toLowerCase();

      console.log('Extracted payment status:', status);

      if (!successfulStatuses.includes(status)) {
        console.warn(`ITEC Pay Verify: Payment not successful - status: ${status || 'unknown'}`);
        throw new Error(`Payment not successful. Current status: ${status || 'unknown'}`);
      }

      return response.data;
    } catch (error: any) {
      console.error('ITEC Pay Verify Error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to verify ITEC Pay payment';
      const newError: any = new Error(errorMessage);
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Initialize an ITEC Pay transaction (unified interface for checkout)
   */
  async initializeTransaction(
    email: string,
    amount: number,
    orderId: string,
    currency: string = 'RWF',
    channels: string[] = ['card'],
    phone?: string
  ): Promise<{
    status: boolean;
    message: string;
    data: {
      authorization_url: string;
      reference: string;
    };
  }> {
    try {
      const paymentMethod = channels.length > 0 ? channels[0] : 'card';
      // ITEC Pay requires a UUID format for req_ref
      const reqRef = crypto.randomUUID();

      if (paymentMethod === 'card') {
        const response = await this.initializeCardPayment(amount, email, reqRef);
        
        // Note: initializeCardPayment already validates the response and throws if invalid

        // Ensure we have a valid link
        let paymentUrl = response.link;
        const pcode = response.PCODE;

        console.log('Processing ITEC Pay card response:', { paymentUrl, pcode });

        // Use the exact link from ITEC Pay if available
        // The API returns: "link": "https://pay.itecpay.rw/api/pay/apis/pesapal/index?PCODE=..."
        let finalPaymentUrl = paymentUrl;
        
        // If link is not provided or malformed, construct it using the correct format from docs
        if (!finalPaymentUrl || !finalPaymentUrl.includes('PCODE')) {
          finalPaymentUrl = `https://pay.itecpay.rw/api/pay/apis/pesapal/index?PCODE=${pcode}`;
        }
        
        // Additional validation - ensure URL is properly formatted
        try {
          const urlObj = new URL(finalPaymentUrl);
          // Check if URL points to ITEC Pay domain
          if (!urlObj.hostname.includes('itecpay')) {
            console.warn('Payment URL does not point to ITEC Pay domain, reconstructing...');
            finalPaymentUrl = `https://pay.itecpay.rw/api/pay/apis/pesapal/index?PCODE=${pcode}`;
          }
        } catch {
          // URL is malformed, reconstruct it
          console.warn('Malformed payment URL received, reconstructing...');
          finalPaymentUrl = `https://pay.itecpay.rw/api/pay/apis/pesapal/index?PCODE=${pcode}`;
        }

        // Validate the URL before returning
        if (!finalPaymentUrl || (!finalPaymentUrl.startsWith('http://') && !finalPaymentUrl.startsWith('https://'))) {
          throw new Error('Invalid payment redirection URL received from gateway');
        }

        return {
          status: true,
          message: 'Card payment initialized',
          data: {
            authorization_url: finalPaymentUrl,
            reference: reqRef,
          },
        };
      } else {
        // Mobile money (MTN, Airtel, or Spenn)
        const provider = paymentMethod === 'mobile_money' ? 'mtn' : paymentMethod as 'mtn' | 'airtel' | 'spenn';

        if (!phone) {
          throw new Error('Phone number is required for mobile money payments');
        }

        const response = await this.initializeMobileMoneyPayment(
          amount,
          phone,
          provider,
          reqRef
        );

        // ITEC Pay mobile money response shape varies: status may be 200, true, 'success', 'ok', or 1
        const res = response as any;
        console.log('ITEC Pay mobile money raw response:', JSON.stringify(res));
        const statusVal = String(res.status ?? '').toLowerCase();
        const ok = res.status === 200 || res.status === true || res.status === 1 ||
          statusVal === 'success' || statusVal === 'ok' || statusVal === '200';
        if (!ok) {
          const errMsg = res.data?.message || res.message || `Payment request failed (status: ${res.status})`;
          throw new Error(errMsg);
        }

        const txId = res.data?.transaction_id || res.transaction_id || reqRef;
        return {
          status: true,
          message: 'Mobile money payment initialized. Check your phone for a payment prompt.',
          data: {
            authorization_url: `https://pay.itecpay.rw/api2/verify?req_ref=${txId}`,
            reference: reqRef,
          },
        };
      }
    } catch (error: any) {
      console.error('ITEC Pay Initialization Error:', error.response?.data || error.message);

      const errorMessage = error.response?.data?.message || error.message || 'Failed to initialize ITEC Pay transaction';
      const newError: any = new Error(errorMessage);
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Verify ITEC Pay callback data
   */
  verifyCallback(callbackData: ITECPayCallbackData, secretKey: string): boolean {
    if (!callbackData.transaction_id || !callbackData.amount || !callbackData.status) {
      return false;
    }
    // Only accept successful payment statuses
    const successfulStatuses = ['completed', 'success', 'paid', 'approved'];
    const status = String(callbackData.status).toLowerCase();
    if (!successfulStatuses.includes(status)) {
      console.warn(`ITEC Pay Webhook: Payment not successful - status: ${callbackData.status}`);
      return false;
    }
    return true;
  },

  /**
   * Handle successful ITEC Pay payment
   */
  async handleSuccessfulPayment(orderIdsString: string, transID: string, amount: string, io?: any) {
    try {
      const allIds = orderIdsString.split(',').map(id => id.trim()).filter(id => id !== '');

      const subIds = allIds.filter(id => id.startsWith('SUB-'));
      const orderIds = allIds.filter(id => !id.startsWith('SUB-'));

      // --- Activate subscriptions ---
      for (const subEntry of subIds) {
        const subscriptionId = subEntry.replace(/^SUB-/, '');
        try {
          const subscription = await VendorSubscription.findById(subscriptionId);
          if (!subscription) {
            console.warn(`ITEC Pay Webhook: Subscription ${subscriptionId} not found`);
            continue;
          }

          if (subscription.status === 'active' && subscription.payment_reference === transID && !subscription.pending_plan) {
            console.log(`ITEC Pay Webhook: Subscription ${subscriptionId} already active`);
            continue;
          }

          if (subscription.pending_plan) {
            subscription.plan = subscription.pending_plan;
            subscription.billing_cycle = (subscription.pending_billing_cycle || subscription.billing_cycle) as 'monthly' | 'annual';
            subscription.pending_plan = undefined;
            subscription.pending_billing_cycle = undefined;
          }

          subscription.status = 'active';
          subscription.payment_reference = transID;
          subscription.last_payment_date = new Date();
          
          // Calculate amount from plan if not provided
          let paymentAmount = Number(amount) || 0;
          if (paymentAmount === 0 && subscription.pending_plan) {
            // Fetch plan prices from Settings
            const settings = await Settings.findOne();
            const plan = subscription.pending_plan as 'pro' | 'elite';
            const billingCycle = (subscription.pending_billing_cycle || subscription.billing_cycle) as 'monthly' | 'annual';
            
            if (settings?.plan_prices?.[plan]) {
              paymentAmount = billingCycle === 'annual' 
                ? settings.plan_prices[plan].annual 
                : settings.plan_prices[plan].monthly;
            } else {
              // Fallback to default prices
              const defaultPrices: Record<string, { monthly: number; annual: number }> = {
                pro: { monthly: 29000, annual: 23000 },
                elite: { monthly: 79000, annual: 63000 }
              };
              paymentAmount = defaultPrices[plan]?.[billingCycle] || 0;
            }
          }
          subscription.amount = paymentAmount;

          const now = new Date();
          subscription.expires_at = subscription.billing_cycle === 'annual'
            ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          await subscription.save();

          await Product.updateMany(
            { vendor_username: subscription.vendor_username },
            {
              vendor_plan: subscription.plan,
              plan_priority: PLAN_PRIORITY[subscription.plan as keyof typeof PLAN_PRIORITY] || 0,
            }
          );
        } catch (subErr) {
          console.error(`ITEC Pay Webhook: Failed to activate subscription ${subscriptionId}:`, subErr);
        }
      }

      // --- Mark orders as paid ---
      // Strip ORD- prefix from order IDs if present (we add it when creating transaction)
      const cleanOrderIds = orderIds.map(id => id.startsWith('ORD-') ? id.substring(4) : id);
      
      if (cleanOrderIds.length > 0) {
        const result = await Order.updateMany(
          { _id: { $in: cleanOrderIds }, payment_status: { $ne: 'paid' } },
          {
            $set: {
              payment_status: 'paid',
              payment_reference: transID,
              status: 'confirmed',
              updated_at: new Date()
            }
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`ITEC Pay: ${result.modifiedCount} order(s) marked as paid (Ref: ${transID})`);
        }

        await creditAffiliateConversions(cleanOrderIds, io);
      }
    } catch (error) {
      console.error('Error handling ITEC Pay successful payment:', error);
    }
  }
};