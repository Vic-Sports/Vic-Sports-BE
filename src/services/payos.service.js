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
      // PayOS expects null/undefined values to be treated as empty strings
      if (value === null || value === undefined) {
        result.push(`${fullKey}=`);
        continue;
      }

      if (Array.isArray(value)) {
        // Preserve array order. For object elements, stringify them with sorted keys
        value.forEach((item, index) => {
          if (item === null || item === undefined) {
            result.push(`${fullKey}[${index}]=`);
          } else if (typeof item === "object") {
            const sorted = sortObjectForSignature(item);
            result.push(`${fullKey}[${index}]=${JSON.stringify(sorted)}`);
          } else {
            result.push(`${fullKey}[${index}]=${String(item)}`);
          }
        });
      } else if (typeof value === "object") {
        // Nested object -> flatten
        result.push(...objectToQueryString(value, fullKey));
      } else {
        result.push(`${fullKey}=${String(value)}`);
      }
    }
  }
  return result;
}

/**
 * Return a new object with keys sorted recursively so JSON.stringify produces stable output.
 * This follows PayOS examples which JSON-encode nested objects/arrays with stable key order.
 */
function sortObjectForSignature(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((it) => sortObjectForSignature(it));
  if (typeof obj !== "object") return obj;

  const keys = Object.keys(obj).sort();
  const out = {};
  for (const k of keys) {
    out[k] = sortObjectForSignature(obj[k]);
  }
  return out;
}

/**
 * Tạo chữ ký HMAC SHA256 cho dữ liệu theo đúng chuẩn của PayOS.
 * @param {object} data Dữ liệu cần tạo chữ ký.
 * @returns {string} Chữ ký đã được tạo.
 */
function createSignature(data) {
  const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;
  // Build canonical query array, sort globally and join by &
  const dataQueries = objectToQueryString(data);
  const sortedQueries = dataQueries.sort();
  const dataString = sortedQueries.join("&");
  // Create HMAC SHA256 hex digest
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
    // Note: original PayOS direct HTTP code removed for clarity; SDK usage is preferred.
    // Currently this method returns a simulated successful payment response.
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
      // Accept signature either from header (receivedSignature) or from payload body.signature
      const signature =
        receivedSignature || (webhookBody && webhookBody.signature);
      if (!signature) {
        console.error(
          "Webhook Error: Signature is missing (header and body.signature are empty)."
        );
        return false;
      }

      // PayOS v2: sử dụng SDK để verify
      const sdkClient = getEnvSdkClient();
      if (sdkClient) {
        try {
          // PayOS v2 SDK có method verifyPaymentWebhookData
          // pass the resolved signature (header or body) to SDK
          const isValid = sdkClient.verifyPaymentWebhookData(
            webhookBody,
            signature
          );
          // Intentionally not logging success to reduce noise
          return isValid;
        } catch (err) {
          console.error("PayOS SDK webhook verification error:", err);
          return false;
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

      return (
        String(expectedSignature).toLowerCase() ===
        String(signature).toLowerCase()
      );
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return false;
    }
  },
};
