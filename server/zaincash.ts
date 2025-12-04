import jwt from 'jsonwebtoken';

interface ZainCashConfig {
  merchantId: string;
  msisdn: string;
  secret: string;
  isTest: boolean;
}

interface TransactionInitData {
  amount: number;
  orderId: string;
  serviceType: string;
  redirectUrl: string;
}

interface TransactionInitResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  error?: string;
}

interface PaymentCallbackData {
  status: string;
  orderId: string;
  transactionId: string;
  msg?: string;
}

class ZainCashService {
  private config: ZainCashConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      merchantId: process.env.ZAINCASH_MERCHANT_ID || '',
      msisdn: process.env.ZAINCASH_MSISDN || '',
      secret: process.env.ZAINCASH_SECRET || '',
      isTest: process.env.ZAINCASH_TEST_MODE === 'true',
    };
    
    this.baseUrl = this.config.isTest 
      ? 'https://test.zaincash.iq' 
      : 'https://api.zaincash.iq';
  }

  isConfigured(): boolean {
    return !!(this.config.merchantId && this.config.msisdn && this.config.secret);
  }

  getConfig(): { isTest: boolean; isConfigured: boolean } {
    return {
      isTest: this.config.isTest,
      isConfigured: this.isConfigured(),
    };
  }

  async initTransaction(data: TransactionInitData): Promise<TransactionInitResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Zain Cash is not configured. Please set ZAINCASH_MERCHANT_ID, ZAINCASH_MSISDN, and ZAINCASH_SECRET.',
      };
    }

    try {
      const payload = {
        amount: data.amount,
        serviceType: data.serviceType,
        msisdn: this.config.msisdn,
        orderId: data.orderId,
        redirectUrl: data.redirectUrl,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 4), // 4 hours expiry
      };

      const token = jwt.sign(payload, this.config.secret);

      const response = await fetch(`${this.baseUrl}/transaction/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: token,
          merchantId: this.config.merchantId,
          lang: 'ar',
        }),
      });

      const result = await response.json();

      if (result.err) {
        console.error('Zain Cash init error:', result);
        return {
          success: false,
          error: result.err.msg || 'Failed to initialize payment',
        };
      }

      if (result.id) {
        return {
          success: true,
          transactionId: result.id,
          paymentUrl: `${this.baseUrl}/transaction/pay?id=${result.id}`,
        };
      }

      return {
        success: false,
        error: 'Unknown error initializing payment',
      };
    } catch (error) {
      console.error('Zain Cash init error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize payment',
      };
    }
  }

  verifyCallback(token: string): PaymentCallbackData | null {
    if (!this.isConfigured()) {
      console.error('Zain Cash not configured for callback verification');
      return null;
    }

    try {
      const decoded = jwt.verify(token, this.config.secret) as any;
      
      return {
        status: decoded.status,
        orderId: decoded.orderid || decoded.orderId,
        transactionId: decoded.id,
        msg: decoded.msg,
      };
    } catch (error) {
      console.error('Zain Cash callback verification error:', error);
      return null;
    }
  }

  async checkTransactionStatus(transactionId: string): Promise<{ status: string; msg?: string } | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const payload = {
        id: transactionId,
        msisdn: this.config.msisdn,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 4),
      };

      const token = jwt.sign(payload, this.config.secret);

      const response = await fetch(`${this.baseUrl}/transaction/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: token,
          merchantId: this.config.merchantId,
        }),
      });

      const result = await response.json();
      
      if (result.status) {
        return {
          status: result.status,
          msg: result.msg,
        };
      }

      return null;
    } catch (error) {
      console.error('Zain Cash status check error:', error);
      return null;
    }
  }
}

export const zaincash = new ZainCashService();
