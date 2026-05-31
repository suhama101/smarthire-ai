import { Resend } from 'resend';

export async function sendPasswordResetEmail(toEmail, resetLink) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: 'SmartHire AI <onboarding@resend.dev>',
    to: toEmail,
    subject: 'Reset Your SmartHire AI Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">SmartHire AI</h2>
        <h3>Reset Your Password</h3>
        <p>You requested a password reset. Click the button below:</p>
        <a href="${resetLink}" 
           style="background: #6366f1; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
        <p style="color: #666; margin-top: 20px;">
          This link expires in 1 hour. If you did not request this, ignore this email.
        </p>
      </div>
    `
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error('Failed to send email: ' + error.message);
  }

  return data;
}