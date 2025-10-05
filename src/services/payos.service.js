import axios from "axios";
import crypto from "crypto";
import { PayOS, APIError } from "@payos/node";

// Lấy các biến môi trường
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = process.env.PAYOS_API_KEY;
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

// URL cơ sở cho API
const PAYOS_API_BASE_URL = "https://api-merchant.payos.vn/v2/payment-requests";

// Lazily initialize SDK client to avoid env-required throw at import time
let payosSdkClient = null;
function getEnvSdkClient() {
  if (payosSdkClient) return payosSdkClient;
  if (PAYOS_CLIENT_ID && PAYOS_API_KEY && PAYOS_CHECKSUM_KEY) {
    payosSdkClient = new PayOS({
      clientId: PAYOS_CLIENT_ID,
      apiKey: PAYOS_API_KEY,
      checksumKey: PAYOS_CHECKSUM_KEY,
      logLevel: "debug",
    });
    return payosSdkClient;
  }
  return null;
}

/**
 * Hàm đệ quy để chuyển đổi object/array thành một mảng các chuỗi "key=value".
 * Hàm này sẽ "làm phẳng" (flatten) cấu trúc dữ liệu lồng nhau.
 * @param {object} obj - Dữ liệu đầu vào.
 * @param {string} prefix - Tiền tố cho các key (dùng cho đệ quy).
 * @returns {Array<string>} Mảng các chuỗi "key=value".
 */
function objectToQueryString(obj, prefix = "") {
  const result = [];
  const sortedKeys = Object.keys(obj).sort();

  for (const key of sortedKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;
      const value = obj[key];
      if (value === null || value === undefined) {
        continue;
      }
      if (typeof value === "object" && !Array.isArray(value)) {
        result.push(...objectToQueryString(value, fullKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          result.push(...objectToQueryString(item, `${fullKey}[${index}]`));
        });
      } else {
        result.push(`${fullKey}=${String(value)}`);
      }
    }
  }
  return result;
}

/**
 * Tạo chữ ký HMAC SHA256 cho dữ liệu theo đúng chuẩn của PayOS.
 * @param {object} data Dữ liệu cần tạo chữ ký.
 * @returns {string} Chữ ký đã được tạo.
 */
function createSignature(data) {
  const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;
  const dataQueries = objectToQueryString(data);
  const sortedQueries = dataQueries.sort();
  const dataString = sortedQueries.join("&");
  // Removed verbose debug logs to reduce noise in production
  return crypto
    .createHmac("sha256", PAYOS_CHECKSUM_KEY)
    .update(dataString)
    .digest("hex");
}

export default {
  /**
   * Tạo một link thanh toán mới.
   * @param {object} paymentData Dữ liệu cho việc tạo thanh toán.
   * @returns {Promise<object>} Kết quả từ API PayOS.
   */
  /**
   * Tạo một link thanh toán mới (PayOS) - Đã comment lại để tạm thời bỏ qua chuyển hướng thanh toán
   * Giữ lại code gốc để tham khảo, chỉ comment lại bằng //
   * @param {object} paymentData Dữ liệu cho việc tạo thanh toán.
   * @returns {Promise<object>} Kết quả giả lập thanh toán thành công.
   */
  async createPaymentLink(paymentData) {
    // --- CODE GỐC PAYOS ---
    // try {
    //   const payload = {
    //     orderCode: paymentData.orderCode,
    //     amount: paymentData.amount,
    //     description: paymentData.description,
    //     items: paymentData.items,
    //     cancelUrl: paymentData.cancelUrl,
    //     returnUrl: paymentData.returnUrl,
    //     buyerName: paymentData.buyerName,
    //     buyerEmail: paymentData.buyerEmail,
    //     buyerPhone: paymentData.buyerPhone,
    //     buyerAddress: paymentData.buyerAddress,
    //     expiredAt: paymentData.expiredAt,
    //   };
    //   const cleanPayload = JSON.parse(JSON.stringify(payload));
    //   const signature = createSignature(cleanPayload);
    //   payload.signature = signature;
    //   const res = await axios.post(PAYOS_API_BASE_URL, payload, {
    //     headers: {
    //       "x-client-id": PAYOS_CLIENT_ID,
    //       "x-api-key": PAYOS_API_KEY,
    //       "Content-Type": "application/json",
    //     },
    //   });
    //   return { success: true, data: res.data };
    // } catch (error) {
    //   console.error("PayOS Create Link Error:", error.response?.data);
    //   return {
    //     success: false,
    //     error: error.message,
    //     details: error.response?.data,
    //   };
    // }
    // --- KẾT THÚC CODE GỐC ---

    // Tạm thời giả lập thanh toán thành công
    // TODO: Save payment info to DB here
    // Example: await PaymentModel.create({ ...paymentData, status: 'paid' });
    return {
      success: true,
      data: {
        orderCode: paymentData.orderCode,
        amount: paymentData.amount,
        description: paymentData.description,
        items: paymentData.items,
        buyerName: paymentData.buyerName,
        buyerEmail: paymentData.buyerEmail,
        buyerPhone: paymentData.buyerPhone,
        buyerAddress: paymentData.buyerAddress,
        status: "paid",
        // Add other fields as needed
      },
      message: "Thanh toán thành công (giả lập)",
    };
  },

  /**
   * Tạo payment link sử dụng PayOS SDK theo ví dụ cung cấp
   * @param {object} paymentData
   * @returns {Promise<object>}
   */
  async createPaymentLinkSDK(paymentData, clientOptions = undefined) {
    try {
      const sdkClient = clientOptions
        ? new PayOS({
            clientId: clientOptions.clientId,
            apiKey: clientOptions.apiKey,
            checksumKey: clientOptions.checksumKey,
            logLevel: clientOptions.logLevel || "debug",
          })
        : getEnvSdkClient();
      if (!sdkClient) {
        throw new Error(
          "PayOS SDK client is not configured. Provide clientOptions or set PAYOS_* envs."
        );
      }
      const requestBody = {
        amount: paymentData.amount,
        orderCode: paymentData.orderCode,
        description: paymentData.description,
        returnUrl: paymentData.returnUrl,
        cancelUrl: paymentData.cancelUrl,
        // Các trường tùy chọn nếu có
        items: paymentData.items,
        buyerName: paymentData.buyerName,
        buyerEmail: paymentData.buyerEmail,
        buyerPhone: paymentData.buyerPhone,
        buyerAddress: paymentData.buyerAddress,
        expiredAt: paymentData.expiredAt,
      };

      const response = await sdkClient.paymentRequests.create(requestBody);
      return { success: true, data: response };
    } catch (err) {
      if (err instanceof APIError) {
        return { success: false, error: err.message, details: err.error };
      }
      return { success: false, error: err.message };
    }
  },

  /**
   * Lấy thông tin của một đơn hàng thanh toán.
   * @param {number} orderCode Mã đơn hàng.
   * @returns {Promise<object>} Thông tin đơn hàng.
   */
  async getPaymentInfo(orderCode) {
    try {
      const url = `${PAYOS_API_BASE_URL}/${orderCode}`;

      const res = await axios.get(url, {
        headers: {
          "x-client-id": PAYOS_CLIENT_ID,
          "x-api-key": PAYOS_API_KEY,
        },
      });

      return { success: true, data: res.data.data };
    } catch (error) {
      console.error("PayOS Get Info Error:", error.response?.data);
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
      };
    }
  },

  /**
   * Test chữ ký PayOS với payload tối giản
   * @returns {Promise<object>} Kết quả từ API PayOS
   */
  async testMinimalSignature() {
    const payload = {
      amount: 10000,
      orderCode: Math.floor(Date.now() / 1000),
      description: "Test signature only",
      returnUrl: "http://localhost:5173/booking/payos-return",
      cancelUrl: "http://localhost:5173/booking",
    };
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    const signature = createSignature(cleanPayload);
    payload.signature = signature;
    // Removed verbose payload log
    try {
      const res = await axios.post(PAYOS_API_BASE_URL, payload, {
        headers: {
          "x-client-id": PAYOS_CLIENT_ID,
          "x-api-key": PAYOS_API_KEY,
          "Content-Type": "application/json",
          // Thêm checksum vào header để phục vụ kiểm tra
          "x-checksum": signature,
        },
      });
      return { success: true, data: res.data };
    } catch (error) {
      console.log("Lỗi trả về:", error.response?.data);
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
      };
    }
  },
  /**
   * Hủy một link thanh toán.
   * @param {number} orderCode Mã đơn hàng.
   * @param {string} [cancellationReason] Lý do hủy (không bắt buộc).
   * @returns {Promise<object>} Kết quả hủy.
   */
  async cancelPaymentLink(orderCode, cancellationReason = "") {
    try {
      const url = `${PAYOS_API_BASE_URL}/${orderCode}/cancel`;

      // Luôn gửi một object JSON hợp lệ, không bao giờ null
      const body = cancellationReason
        ? { cancellationReason }
        : { cancellationReason: "Cancelled by user" };

      // Tính checksum dựa trên body
      const headerChecksum = createSignature(body);

      // Removed verbose request/ checksum logs
      const res = await axios.post(url, body, {
        headers: {
          "x-client-id": PAYOS_CLIENT_ID,
          "x-api-key": PAYOS_API_KEY,
          "Content-Type": "application/json",
          // Thêm checksum vào header để phục vụ kiểm tra
          "x-checksum": headerChecksum,
        },
      });

      return { success: true, data: res.data };
    } catch (error) {
      console.error("PayOS Cancel Link Error:", error.response?.data);
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
      };
    }
  },

  /**
   * Xác thực chữ ký từ Webhook của PayOS v2.
   * @param {object} webhookBody Toàn bộ body nhận được từ webhook.
   * @param {string} receivedSignature Signature từ header.
   * @returns {boolean} True nếu chữ ký hợp lệ.
   */
  verifyWebhookSignature(webhookBody, receivedSignature) {
    try {
      if (!receivedSignature) {
        console.error("Webhook Error: Signature is missing from header.");
        return false;
      }

      // PayOS v2: try SDK verify if available
      const sdkClient = getEnvSdkClient();
      if (
        sdkClient &&
        typeof sdkClient.verifyPaymentWebhookData === "function"
      ) {
        try {
          const isValid = sdkClient.verifyPaymentWebhookData(
            webhookBody,
            receivedSignature
          );
          return isValid;
        } catch (err) {
          console.error("PayOS SDK webhook verification error:", err);
          // fall through to manual verification fallback
        }
      }

      // Fallback: manual verification (minimal logs)
      // Per PayOS docs the signature is created over the `data` object inside the webhook payload.
      // Example payload: { code, desc, success, data: { ... }, signature }
      const payloadData =
        webhookBody && webhookBody.data ? webhookBody.data : {};

      // Ensure nested objects are consistently ordered when stringified for arrays/objects
      const sortedPayloadData = sortObjectForSignature(payloadData);
      const expectedSignature = createSignature(sortedPayloadData);

      // Optional debug logging
      if (process.env.ENABLE_REQUEST_LOGS === "true") {
        console.log(
          "[PAYOS SIG DEBUG] received:",
          String(signature).toLowerCase()
        );
        console.log(
          "[PAYOS SIG DEBUG] expected:",
          String(expectedSignature).toLowerCase()
        );
      }

      return expectedSignature === receivedSignature;
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return false;
    }
  },
};
