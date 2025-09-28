export const emailTemplates = {
  REGISTRATION: {
    subject: 'Welcome to Vic Sports - Verify Your Email',
    getContent: ({ name, verificationLink }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin: 0;">Welcome to Vic Sports!</h1>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <p style="color: #34495e; margin: 0;">Hi ${name},</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">Thank you for registering with Vic Sports. To complete your registration and access all features, please verify your email address by clicking the button below:</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 14px;">
          <p style="margin: 0;">If you didn't request this, please ignore this email.</p>
          <p style="margin: 10px 0 0 0;">This verification link will expire in 1 hour.</p>
          <p style="margin: 10px 0 0 0;">Best regards,<br>Vic Sports Team</p>
        </div>
      </div>
    `,
  },

  VERIFICATION: {
    subject: 'Verify Your Email - Vic Sports',
    getContent: ({ name, verificationLink }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin: 0;">Verify Your Email Address</h1>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <p style="color: #34495e; margin: 0;">Hi ${name},</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">Please verify your email address by clicking the button below to access your Vic Sports account:</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 14px;">
          <p style="margin: 0;">If you didn't request this, please ignore this email.</p>
          <p style="margin: 10px 0 0 0;">This verification link will expire in 1 hour.</p>
          <p style="margin: 10px 0 0 0;">Best regards,<br>Vic Sports Team</p>
        </div>
      </div>
    `,
  },

  PASSWORD_RESET: {
    subject: 'Reset Your Password - Vic Sports',
    getContent: ({ name, resetLink }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin: 0;">Password Reset Request</h1>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <p style="color: #34495e; margin: 0;">Hi ${name},</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">We received a request to reset your password for your Vic Sports account.</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">Click the button below to reset your password:</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 14px;">
          <p style="margin: 0;">If you didn't request this, please ignore this email.</p>
          <p style="margin: 10px 0 0 0;">This link will expire in 1 hour.</p>
          <p style="margin: 10px 0 0 0;">Best regards,<br>Vic Sports Team</p>
        </div>
      </div>
    `,
  },

  ORDER_CONFIRMATION: {
    subject: 'Order Confirmation - Vic Sports',
    getContent: ({ name, orderNumber, orderDetails }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin: 0;">Order Confirmation</h1>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <p style="color: #34495e; margin: 0;">Hi ${name},</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">Thank you for your order! Your order number is: ${orderNumber}</p>
          <h2 style="color: #2c3e50; margin: 20px 0 10px 0;">Order Details:</h2>
          ${orderDetails}
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 14px;">
          <p style="margin: 0;">We'll notify you when your order ships.</p>
          <p style="margin: 10px 0 0 0;">Best regards,<br>Vic Sports Team</p>
        </div>
      </div>
    `,
  },

  ORDER_SHIPPED: {
    subject: 'Your Order Has Shipped - Vic Sports',
    getContent: ({ name, orderNumber, trackingNumber }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c3e50; margin: 0;">Order Shipped</h1>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <p style="color: #34495e; margin: 0;">Hi ${name},</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">Great news! Your order #${orderNumber} has been shipped.</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">Tracking Number: ${trackingNumber}</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">You can track your package using the tracking number above.</p>
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 14px;">
          <p style="margin: 0;">Best regards,<br>Vic Sports Team</p>
        </div>
      </div>
    `,
  },

  ACCOUNT_BANNED: {
    subject: 'Your Account Has Been Banned - Vic Sports',
    getContent: ({ name }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #c0392b; margin: 0;">Account Banned</h1>
        </div>
        <div style="background-color: #fdf2f2; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <p style="color: #34495e; margin: 0;">Hi ${name},</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">Your Vic Sports account has been banned due to policy violations or suspicious activities.</p>
          <p style="color: #34495e; margin: 10px 0 0 0;">If you believe this is a mistake, please contact our support team.</p>
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 14px;">
          <p style="margin: 0;">Best regards,<br>Vic Sports Team</p>
        </div>
      </div>
    `,
  },

  ACCOUNT_UNBANNED: {
    subject: 'Your Account Has Been Restored - Vic Sports',
    getContent: ({ name }) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #27ae60; margin: 0;">Account Restored</h1>
        </div>
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <p style="color: #34495e; margin: 0;">Hi ${name},</p>
          <p style="color: #34495e; margin: 15px 0 0 0;">Good news! Your Vic Sports account has been unbanned and restored to ACTIVE status.</p>
          <p style="color: #34495e; margin: 10px 0 0 0;">You can now continue using our services.</p>
        </div>
        <div style="text-align: center; color: #7f8c8d; font-size: 14px;">
          <p style="margin: 0;">Best regards,<br>Vic Sports Team</p>
        </div>
      </div>
    `,
  },
};
