const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendVerificationEmail(to, name, code) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('Gmail not configured — verification code:', code);
    return;
  }
  await transporter.sendMail({
    from: `"My Notion" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Your My Notion confirmation code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Welcome, ${name}!</h2>
        <p>Your confirmation code is:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#6366f1">${code}</p>
        <p>This code expires in 15 minutes.</p>
        <p style="color:#888;font-size:12px">If you didn't sign up, ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail };
