interface QiCardConfig {
  merchantId: string;
  apiKey: string;
  secretKey: string;
  isTest: boolean;
}

interface PaymentInitData {
  amount: number;
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description: string;
  redirectUrl: string;
  callbackUrl: string;
}

interface PaymentInitResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  error?: string;
}

interface PaymentStatusResponse {
  success: boolean;
  status?: string;
  transactionId?: string;
  orderId?: string;
  amount?: number;
  error?: string;
}

interface CallbackData {
  transactionId: string;
  orderId: string;
  status: string;
  amount: number;
  message?: string;
}

class QiCardService {
  private config: QiCardConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      merchantId: process.env.QICARD_MERCHANT_ID || '',
      apiKey: process.env.QICARD_API_KEY || '',
      secretKey: process.env.QICARD_SECRET_KEY || '',
      isTest: process.env.QICARD_TEST_MODE !== 'false',
    };
    
    this.baseUrl = this.config.isTest 
      ? 'https://api-test.qi.iq/v1' 
      : 'https://api.qi.iq/v1';
  }

  isConfigured(): boolean {
    return !!(this.config.merchantId && this.config.apiKey && this.config.secretKey);
  }

  getConfig(): { isTest: boolean; isConfigured: boolean } {
    return {
      isTest: this.config.isTest,
      isConfigured: this.isConfigured(),
    };
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: this.config.merchantId,
          apiKey: this.config.apiKey,
          secretKey: this.config.secretKey,
        }),
      });

      if (!response.ok) {
        console.error('QiCard auth error:', await response.text());
        return null;
      }

      const result = await response.json();
      return result.token || result.access_token;
    } catch (error) {
      console.error('QiCard auth error:', error);
      return null;
    }
  }

  async initPayment(data: PaymentInitData): Promise<PaymentInitResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'QiCard is not configured. Please set QICARD_MERCHANT_ID, QICARD_API_KEY, and QICARD_SECRET_KEY.',
      };
    }

    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'Failed to authenticate with QiCard',
        };
      }

      const response = await fetch(`${this.baseUrl}/payment/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          merchantId: this.config.merchantId,
          amount: data.amount,
          currency: 'IQD',
          orderId: data.orderId,
          description: data.description,
          customer: {
            name: data.customerName,
            email: data.customerEmail,
            phone: data.customerPhone,
          },
          redirectUrl: data.redirectUrl,
          callbackUrl: data.callbackUrl,
          language: 'ar',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('QiCard init error:', result);
        return {
          success: false,
          error: result.message || result.error || 'Failed to initialize payment',
        };
      }

      if (result.transactionId && result.paymentUrl) {
        return {
          success: true,
          transactionId: result.transactionId,
          paymentUrl: result.paymentUrl,
        };
      }

      return {
        success: false,
        error: result.message || 'Unknown error initializing payment',
      };
    } catch (error) {
      console.error('QiCard init error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize payment',
      };
    }
  }

  async verifyPayment(transactionId: string): Promise<PaymentStatusResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'QiCard is not configured',
      };
    }

    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'Failed to authenticate with QiCard',
        };
      }

      const response = await fetch(`${this.baseUrl}/payment/status/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('QiCard verify error:', result);
        return {
          success: false,
          error: result.message || 'Failed to verify payment',
        };
      }

      return {
        success: true,
        status: result.status,
        transactionId: result.transactionId,
        orderId: result.orderId,
        amount: result.amount,
      };
    } catch (error) {
      console.error('QiCard verify error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify payment',
      };
    }
  }

  parseCallback(body: any): CallbackData | null {
    try {
      if (!body.transactionId || !body.orderId || !body.status) {
        console.error('Invalid QiCard callback data:', body);
        return null;
      }

      return {
        transactionId: body.transactionId,
        orderId: body.orderId,
        status: body.status,
        amount: body.amount || 0,
        message: body.message,
      };
    } catch (error) {
      console.error('QiCard callback parse error:', error);
      return null;
    }
  }

  mapStatusToPaymentStatus(qiCardStatus: string): 'success' | 'failed' | 'pending' {
    const statusMap: Record<string, 'success' | 'failed' | 'pending'> = {
      'completed': 'success',
      'success': 'success',
      'paid': 'success',
      'approved': 'success',
      'failed': 'failed',
      'declined': 'failed',
      'cancelled': 'failed',
      'expired': 'failed',
      'pending': 'pending',
      'processing': 'pending',
    };

    return statusMap[qiCardStatus.toLowerCase()] || 'pending';
  }
}

export const qicard = new QiCardService();
