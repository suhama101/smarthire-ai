const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getEmailCredentials() {
  const user = String(process.env.EMAIL_USER || '').trim();
  const pass = String(process.env.EMAIL_PASS || '').trim();

  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be configured.');
  }

  return { user, pass };
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const { user, pass } = getEmailCredentials();

  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

async function sendPasswordResetEmail(email, resetLink) {
  const { user } = getEmailCredentials();
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `SmartHire AI <${user}>`,
    to: email,
    subject: 'Reset your SmartHire AI password',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 16px;">Reset your password</h2>
        <p>We received a request to reset your SmartHire AI password.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;">
            Reset password
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p>${resetLink}</p>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
    text: `Reset your SmartHire AI password: ${resetLink}\n\nThis link expires in 1 hour.`,
  });
}

module.exports = { sendPasswordResetEmail };