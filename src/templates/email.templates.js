export const emailTemplates = {
  REGISTRATION: {
    subject: "🎾 Chào mừng bạn đến với Vic Sports - Xác minh Email",
    getContent: ({ name, verificationLink }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">⚽🎾🏀</div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Chào mừng đến Vic Sports!</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Nền tảng đặt sân thể thao số 1</p>
        </div>
        <div style="background: white; padding: 40px 30px;">
          <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name}! 👋</p>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Cảm ơn bạn đã đăng ký với Vic Sports. Để hoàn tất đăng ký và truy cập tất cả các tính năng, vui lòng xác minh địa chỉ email của bạn bằng cách nhấp vào nút dưới đây:</p>
          <div style="text-align: center; margin: 35px 0;">
            <a href="${verificationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: 700; font-size: 16px; transition: transform 0.3s;">Xác minh Email</a>
          </div>
          <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
            <p style="color: #667eea; margin: 0; font-size: 14px; font-weight: 600;">💡 Mẹo:</p>
            <p style="color: #666; margin: 8px 0 0 0; font-size: 14px;">Sau khi xác minh, bạn có thể khám phá hàng trăm sân thể thao và đặt sân yêu thích ngay lập tức!</p>
          </div>
          <p style="color: #999; margin: 20px 0 0 0; font-size: 13px; line-height: 1.6;">Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này.<br>Liên kết xác minh này sẽ hết hạn trong <strong>1 giờ</strong>.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Vic Sports. Tất cả các quyền được bảo lưu.</p>
          <p style="margin: 8px 0 0 0;">Đặt sân thể thao dễ dàng hơn bao giờ hết!</p>
        </div>
      </div>
    `,
  },

  VERIFICATION: {
    subject: "✅ Xác minh Email của bạn - Vic Sports",
    getContent: ({ name, verificationLink }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Xác minh Email</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Bước cuối cùng để kích hoạt tài khoản</p>
        </div>
        <div style="background: white; padding: 40px 30px;">
          <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name},</p>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Nhấp vào nút bên dưới để xác minh địa chỉ email của bạn và bắt đầu khám phá những sân thể thao tuyệt vời:</p>
          <div style="text-align: center; margin: 35px 0;">
            <a href="${verificationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: 700; font-size: 16px;">Xác minh Ngay</a>
          </div>
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <p style="color: #856404; margin: 0; font-size: 13px;">⏰ Liên kết này sẽ hết hạn trong <strong>1 giờ</strong></p>
          </div>
          <p style="color: #999; margin: 20px 0 0 0; font-size: 13px;">Nếu bạn không yêu cầu xác minh này, vui lòng bỏ qua email.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Vic Sports - Đặt sân thể thao trực tuyến</p>
        </div>
      </div>
    `,
  },

  PASSWORD_RESET: {
    subject: "🔐 Đặt lại mật khẩu - Vic Sports",
    getContent: ({ name, resetLink }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">🔐</div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Đặt lại Mật khẩu</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Bảo vệ tài khoản của bạn</p>
        </div>
        <div style="background: white; padding: 40px 30px;">
          <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name},</p>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Vic Sports của bạn. Nhấp vào nút bên dưới để tạo mật khẩu mới:</p>
          <div style="text-align: center; margin: 35px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: 700; font-size: 16px;">Đặt lại Mật khẩu</a>
          </div>
          <div style="background: #fee; padding: 15px; border-radius: 8px; border-left: 4px solid #f5576c;">
            <p style="color: #721c24; margin: 0; font-size: 13px; font-weight: 600;">⚠️ Nếu bạn không yêu cầu điều này</p>
            <p style="color: #721c24; margin: 5px 0 0 0; font-size: 13px;">Vui lòng bỏ qua email này. Mật khẩu của bạn vẫn an toàn.</p>
          </div>
          <p style="color: #999; margin: 20px 0 0 0; font-size: 13px;">Liên kết này sẽ hết hạn trong <strong>1 giờ</strong>.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Vic Sports - Bảo mật hàng đầu</p>
        </div>
      </div>
    `,
  },

  ORDER_CONFIRMATION: {
    subject: "🎉 Xác nhận Đơn hàng - Vic Sports",
    getContent: ({ name, orderNumber, orderDetails }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px 20px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Đặt sân thành công!</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Số đơn hàng: #${orderNumber}</p>
        </div>
        <div style="background: white; padding: 40px 30px;">
          <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name}! 🙌</p>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Cảm ơn bạn đã đặt sân thể thao tại Vic Sports. Dưới đây là chi tiết đơn hàng của bạn:</p>
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #38ef7d;">
            <h2 style="color: #11998e; margin: 0 0 15px 0; font-size: 18px;">📋 Chi tiết Đơn hàng:</h2>
            ${orderDetails}
          </div>
          <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #38ef7d; margin-bottom: 20px;">
            <p style="color: #2e7d32; margin: 0; font-size: 14px; font-weight: 600;">✅ Đơn hàng đã được xác nhận</p>
            <p style="color: #558b2f; margin: 8px 0 0 0; font-size: 13px;">Chúng tôi sẽ gửi thông báo chi tiết sân cho bạn trong 24 giờ.</p>
          </div>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 14px; line-height: 1.6;">📱 Bạn có thể theo dõi đơn hàng của mình trong ứng dụng Vic Sports.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Vic Sports - Đặt sân dễ dàng, vui chơi hết mình</p>
        </div>
      </div>
    `,
  },

  ORDER_SHIPPED: {
    subject: "📦 Đơn hàng của bạn đã được xác nhận - Vic Sports",
    getContent: ({ name, orderNumber, trackingNumber }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px 20px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">📦</div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Đã Xác Nhận!</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Đơn hàng của bạn đã được xử lý</p>
        </div>
        <div style="background: white; padding: 40px 30px;">
          <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name},</p>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Tin tuyệt vời! Đơn hàng #${orderNumber} của bạn đã được xác nhận và sẽ sớm được xử lý.</p>
          <div style="background: #e0f7ff; padding: 20px; border-radius: 8px; margin: 25px 0; border: 2px solid #00f2fe;">
            <p style="color: #0277bd; margin: 0; font-size: 14px; font-weight: 600;">🔍 Mã theo dõi: <span style="font-size: 16px; font-weight: 700;">${trackingNumber}</span></p>
            <p style="color: #01579b; margin: 10px 0 0 0; font-size: 13px;">Sử dụng mã này để theo dõi đơn hàng của bạn</p>
          </div>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 14px; line-height: 1.6;">📍 Bạn có thể theo dõi chi tiết đơn hàng trong ứng dụng hoặc website Vic Sports bất cứ lúc nào.</p>
          <p style="color: #999; margin: 20px 0 0 0; font-size: 13px;">Nếu có bất kỳ câu hỏi nào, liên hệ với chúng tôi qua support@vicsports.com</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Vic Sports - Hỗ trợ 24/7</p>
        </div>
      </div>
    `,
  },

  ACCOUNT_BANNED: {
    subject: "⚠️ Tài khoản của bạn bị tạm khóa - Vic Sports",
    getContent: ({ name }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 40px 20px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Tài khoản bị tạm khóa</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Cần hành động từ bạn</p>
        </div>
        <div style="background: white; padding: 40px 30px;">
          <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name},</p>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Tài khoản Vic Sports của bạn đã bị tạm khóa do vi phạm các điều khoản dịch vụ hoặc hoạt động đáng ngờ.</p>
          <div style="background: #fff3e0; padding: 20px; border-radius: 8px; border-left: 4px solid #ff9800; margin: 25px 0;">
            <p style="color: #e65100; margin: 0; font-size: 14px; font-weight: 600;">📞 Liên hệ hỗ trợ</p>
            <p style="color: #bf360c; margin: 8px 0 0 0; font-size: 13px;">Nếu bạn tin đây là lỗi, vui lòng liên hệ với đội hỗ trợ của chúng tôi: support@vicsports.com</p>
            <p style="color: #bf360c; margin: 8px 0 0 0; font-size: 13px;">Chúng tôi sẽ kiểm tra và xem xét lại trường hợp của bạn trong 24-48 giờ.</p>
          </div>
          <p style="color: #999; margin: 15px 0 0 0; font-size: 13px; line-height: 1.6;">Mục đích của chúng tôi là duy trì một cộng đồng an toàn và công bằng cho tất cả người dùng.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Vic Sports - Cộng đồng thể thao sạch sẽ</p>
        </div>
      </div>
    `,
  },

  ACCOUNT_UNBANNED: {
    subject: "✨ Tài khoản của bạn đã được khôi phục - Vic Sports",
    getContent: ({ name }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">✨</div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Tài khoản Khôi phục!</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Bạn có thể sử dụng lại các dịch vụ của chúng tôi</p>
        </div>
        <div style="background: white; padding: 40px 30px;">
          <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name}! 🎉</p>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Tin tốt! Tài khoản Vic Sports của bạn đã được kiểm tra lại và khôi phục hoàn toàn.</p>
          <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; border: 2px solid #4caf50; margin: 25px 0;">
            <p style="color: #2e7d32; margin: 0; font-size: 16px; font-weight: 700;">✅ Tài khoản: HOẠT ĐỘNG</p>
            <p style="color: #558b2f; margin: 8px 0 0 0; font-size: 14px;">Bạn có thể bắt đầu đặt sân và tham gia cộng đồng Vic Sports ngay bây giờ!</p>
          </div>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 14px; line-height: 1.6;">🎯 Hãy truy cập ứng dụng Vic Sports và khám phá những sân thể thao tuyệt vời để đặt ngay!</p>
          <p style="color: #999; margin: 20px 0 0 0; font-size: 13px;">Nếu bạn có bất kỳ câu hỏi nào, đội hỗ trợ của chúng tôi luôn sẵn sàng giúp đỡ.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Vic Sports - Cùng vui chơi, cùng trao đổi</p>
        </div>
      </div>
    `,
  },

  BOOKING_CONFIRMATION: {
    subject: "🎾 Đặt sân thành công - Vic Sports",
    getContent: ({
      name,
      bookingCode,
      venueName,
      date,
      timeSlots,
      totalPrice,
    }) => {
      // Helper to format time
      const formatTime = (time) => {
        if (!time) return "";
        return typeof time === "string" ? time : "";
      };

      // Format time slots display
      const timeSlotDisplay = timeSlots
        .map(
          (slot) =>
            `${formatTime(slot.start || slot.startTime)} - ${formatTime(
              slot.end || slot.endTime
            )}`
        )
        .join(", ");

      // Format date
      const bookingDate = new Date(date);
      const dateStr = bookingDate.toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const priceDisplay = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(totalPrice);

      return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
          <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px 20px; text-align: center; color: white;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎾</div>
            <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Đặt sân thành công!</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Mã đặt sân: #${bookingCode}</p>
          </div>
          <div style="background: white; padding: 40px 30px;">
            <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name}! 🎉</p>
            <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Cảm ơn bạn đã đặt sân tại Vic Sports. Dưới đây là chi tiết đặt sân của bạn:</p>
            <div style="background: #f0fdf4; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #38ef7d;">
              <h2 style="color: #11998e; margin: 0 0 15px 0; font-size: 18px;">📋 Chi tiết Đặt sân:</h2>
              <div style="margin-bottom: 12px;">
                <p style="color: #666; margin: 0; font-size: 14px; font-weight: 600;">📍 Địa điểm:</p>
                <p style="color: #333; margin: 5px 0 0 0; font-size: 15px; font-weight: 700;">${venueName}</p>
              </div>
              <div style="margin-bottom: 12px;">
                <p style="color: #666; margin: 0; font-size: 14px; font-weight: 600;">📅 Ngày:</p>
                <p style="color: #333; margin: 5px 0 0 0; font-size: 15px;">${dateStr}</p>
              </div>
              <div style="margin-bottom: 12px;">
                <p style="color: #666; margin: 0; font-size: 14px; font-weight: 600;">⏰ Thời gian:</p>
                <p style="color: #333; margin: 5px 0 0 0; font-size: 15px;">${timeSlotDisplay}</p>
              </div>
              <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
                <p style="color: #666; margin: 0; font-size: 14px; font-weight: 600;">💰 Tổng tiền:</p>
                <p style="color: #11998e; margin: 5px 0 0 0; font-size: 18px; font-weight: 700;">${priceDisplay}</p>
              </div>
            </div>
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #38ef7d; margin-bottom: 20px;">
              <p style="color: #2e7d32; margin: 0; font-size: 14px; font-weight: 600;">✅ Đặt sân đã được xác nhận</p>
              <p style="color: #558b2f; margin: 8px 0 0 0; font-size: 13px;">Bạn có thể theo dõi đơn đặt sân này trong ứng dụng Vic Sports của mình.</p>
            </div>
            <p style="color: #666; margin: 15px 0 0 0; font-size: 14px; line-height: 1.6;">Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua support@vicsports.com</p>
          </div>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
            <p style="margin: 0;">© 2025 Vic Sports - Đặt sân dễ dàng, vui chơi hết mình</p>
          </div>
        </div>
      `;
    },
  },

  BOOKING_CONFIRMATION_OWNER: {
    subject: "📬 Có một đơn đặt sân mới - Vic Sports",
    getContent: ({
      name,
      bookingCode,
      venueName,
      date,
      timeSlots,
      totalPrice,
      customerName,
      customerEmail,
      customerPhone,
    }) => {
      // Helper to format time
      const formatTime = (time) => {
        if (!time) return "";
        return typeof time === "string" ? time : "";
      };

      // Format time slots display
      const timeSlotDisplay = timeSlots
        .map(
          (slot) =>
            `${formatTime(slot.start || slot.startTime)} - ${formatTime(
              slot.end || slot.endTime
            )}`
        )
        .join(", ");

      // Format date
      const bookingDate = new Date(date);
      const dateStr = bookingDate.toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const priceDisplay = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(totalPrice);

      return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
  <div style="background:#667eea;color:white;padding:30px;text-align:center;">
    <h1 style="margin:0;font-size:28px;">📬 Có một đơn đặt sân mới!</h1>
    <p style="margin:5px 0 0;font-size:14px;">Mã: #${bookingCode}</p>
  </div>
  
  <div style="padding:25px;background:white;">
    <p style="margin:0 0 20px;font-size:15px;">Xin chào <strong>${name}</strong>!</p>
    <p style="margin:0 0 20px;color:#666;font-size:14px;">Bạn có một đơn đặt sân mới tại <strong>${venueName}</strong>.</p>

    <!-- THÔNG TIN KHÁCH HÀNG -->
    <div style="background:#f0f0f0;padding:15px;border-left:4px solid #667eea;margin:20px 0;">
      <p style="margin:0 0 10px;font-weight:bold;font-size:13px;">👤 THÔNG TIN KHÁCH HÀNG</p>
      <p style="margin:3px 0;font-size:13px;color:#333;"><strong>Tên:</strong> ${customerName}</p>
      <p style="margin:3px 0;font-size:13px;color:#333;"><strong>Email:</strong> ${customerEmail}</p>
      <p style="margin:3px 0;font-size:13px;color:#333;"><strong>Điện thoại:</strong> ${customerPhone}</p>
    </div>

    <!-- CHI TIẾT ĐẶT SÂN -->
    <div style="background:#f9f9f9;padding:15px;border-left:4px solid #11998e;margin:20px 0;">
      <p style="margin:0 0 10px;font-weight:bold;font-size:13px;">📋 CHI TIẾT ĐẶT SÂN</p>
      <p style="margin:5px 0;font-size:13px;"><strong>Địa điểm:</strong> ${venueName}</p>
      <p style="margin:5px 0;font-size:13px;"><strong>Ngày:</strong> ${dateStr}</p>
      <p style="margin:5px 0;font-size:13px;"><strong>Thời gian:</strong> ${timeSlotDisplay}</p>
      <p style="margin:10px 0 0;font-size:14px;color:#11998e;"><strong>Tổng tiền:</strong> <span style="font-size:16px;">${priceDisplay}</span></p>
    </div>

    <!-- HÀNH ĐỘNG -->
    <div style="background:#e3f2fd;padding:12px;border-left:4px solid #2196F3;margin:20px 0;">
      <p style="margin:0;font-weight:bold;color:#1565c0;font-size:13px;">⚡ HÀNH ĐỘNG CẦN THIẾT</p>
      <p style="margin:5px 0 0;font-size:12px;color:#1565c0;">Vui lòng xác nhận hoặc từ chối đơn đặt sân này trong trang quản lý chủ sân.</p>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:15px;">Nếu bạn cần hỗ trợ, liên hệ: support@vicsports.com</p>
  </div>

  <div style="background:#f8f9fa;padding:15px;text-align:center;color:#999;font-size:12px;">
    <p style="margin:0;">© 2025 Vic Sports - Quản lý sân dễ dàng</p>
  </div>
</div>
      `;
    },
  },

  BOOKING_REJECTION: {
    subject: "❌ Đơn đặt sân của bạn đã bị từ chối - Vic Sports",
    getContent: ({ name, bookingCode, venueName, reason }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 40px 20px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Đơn đặt sân bị từ chối</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Mã đặt sân: #${bookingCode}</p>
        </div>
        <div style="background: white; padding: 40px 30px;">
          <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name},</p>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Rất tiếc, đơn đặt sân của bạn tại <strong>${venueName}</strong> đã bị từ chối.</p>
          <div style="background: #fff3e0; padding: 20px; border-radius: 8px; border-left: 4px solid #ff9800; margin: 25px 0;">
            <p style="color: #e65100; margin: 0; font-size: 14px; font-weight: 600;">📋 Lý do từ chối:</p>
            <p style="color: #bf360c; margin: 8px 0 0 0; font-size: 14px;">${reason}</p>
          </div>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 14px; line-height: 1.6;">Bạn có thể liên hệ với chủ sân hoặc đặt lại vào thời gian khác. Nếu có bất kỳ câu hỏi nào, vui lòng liên hệ support@vicsports.com</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Vic Sports - Hỗ trợ 24/7</p>
        </div>
      </div>
    `,
  },

  BOOKING_CHECKIN: {
    subject: "✅ Bạn đã check-in sân thể thao - Vic Sports",
    getContent: ({ name, bookingCode, venueName }) => `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px 20px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
          <h1 style="margin: 0; font-size: 32px; font-weight: 700;">Bạn đã Check-in!</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Mã đặt sân: #${bookingCode}</p>
        </div>
        <div style="background: white; padding: 40px 30px;">
          <p style="color: #333; margin: 0; font-size: 16px; font-weight: 600;">Xin chào ${name}! 🎉</p>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 15px; line-height: 1.6;">Chúng tôi xác nhận rằng bạn đã check-in tại <strong>${venueName}</strong>.</p>
          <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; border: 2px solid #4caf50; margin: 25px 0;">
            <p style="color: #2e7d32; margin: 0; font-size: 16px; font-weight: 700;">⏱️ Bắt đầu</p>
            <p style="color: #558b2f; margin: 8px 0 0 0; font-size: 14px;">Vui vẻ và hưởng thụ hoạt động thể thao của bạn!</p>
          </div>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 14px; line-height: 1.6;">Nếu bạn có bất kỳ vấn đề nào trong quá trình sử dụng, vui lòng liên hệ với chủ sân hoặc support@vicsports.com</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 13px;">
          <p style="margin: 0;">© 2025 Vic Sports - Hỗ trợ 24/7</p>
        </div>
      </div>
    `,
  },
};
