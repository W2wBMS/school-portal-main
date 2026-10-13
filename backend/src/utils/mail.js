const nodemailer = require('nodemailer');

async function sendPasswordResetEmail({ to, token }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, FRONTEND_URL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    console.warn('Password reset email not sent: SMTP is not configured');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_PORT) === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  const resetUrl = `${FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(token)}`;
  await transporter.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to,
    subject: 'Student Portal password reset',
    text: `Use this link to reset your password. It expires in 15 minutes: ${resetUrl}`,
  });
  return true;
}

module.exports = { sendPasswordResetEmail };
