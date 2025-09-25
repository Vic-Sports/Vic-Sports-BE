import axios from "axios";
import crypto from "crypto";

// Lấy các biến môi trường
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = process.env.PAYOS_API_KEY;

// URL cơ sở cho API
const PAYOS_API_BASE_URL = "https://api-merchant.payos.vn/v2/payment-requests";

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
  console.log("--- PAYOS SIGNATURE DEBUG ---");
  console.log("Data String to be Signed:", dataString);
  console.log(
    "Checksum Key Used (first 5 chars):",
    PAYOS_CHECKSUM_KEY ? PAYOS_CHECKSUM_KEY.substring(0, 5) : "NOT FOUND"
  );
  console.log("-----------------------------");
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
    console.log("Payload gửi đi:", JSON.stringify(payload, null, 2));
    try {
      const res = await axios.post(PAYOS_API_BASE_URL, payload, {
        headers: {
          "x-client-id": PAYOS_CLIENT_ID,
          "x-api-key": PAYOS_API_KEY,
          "Content-Type": "application/json",
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
      const body = cancellationReason ? { cancellationReason } : null;

      const res = await axios.post(url, body, {
        headers: {
          "x-client-id": PAYOS_CLIENT_ID,
          "x-api-key": PAYOS_API_KEY,
          "Content-Type": "application/json",
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
   * Xác thực chữ ký từ Webhook của PayOS.
   * @param {object} webhookBody Toàn bộ body nhận được từ webhook.
   * @returns {boolean} True nếu chữ ký hợp lệ.
   */
  verifyWebhookSignature(webhookBody) {
    try {
      const { signature } = webhookBody;
      if (!signature) {
        console.error("Webhook Error: Signature is missing from the body.");
        return false;
      }

      const dataToSign = { ...webhookBody };
      delete dataToSign.signature;

      const expectedSignature = createSignature(dataToSign);

      return expectedSignature === signature;
    } catch (error) {
      console.error("Webhook signature verification failed with error:", error);
      return false;
    }
  },
};

console.log("PAYOS_CLIENT_ID:", process.env.PAYOS_CLIENT_ID);
console.log("PAYOS_API_KEY:", process.env.PAYOS_API_KEY);
