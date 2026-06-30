const { Resend } = require('resend');

const EMAIL_TIMEOUT_MS = 12000;

let resendClient = null;

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function getFrom() {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) return null;
  return `My Notion <${from}>`;
}

function withTimeout(promise, ms = EMAIL_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email delivery timed out')), ms);
    }),
  ]);
}

async function sendEmail({ to, subject, html }) {
  const client = getClient();
  const from = getFrom();

  if (!client) {
    console.warn('Resend not configured — email not sent to', to);
    return { sent: false, reason: 'not_configured' };
  }
  if (!from) {
    console.warn('RESEND_FROM_EMAIL not set — email not sent');
    return { sent: false, reason: 'from_not_configured' };
  }

  try {
    const { error } = await withTimeout(
      client.emails.send({
        from,
        to: [to],
        subject,
        html,
      })
    );

    if (error) {
      console.error('Resend email failed:', error.message);
      return { sent: false, reason: error.message };
    }

    return { sent: true };
  } catch (err) {
    console.error('Resend email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

async function sendVerificationEmail(to, name, code) {
  return sendEmail({
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

async function sendProjectInviteEmail(to, inviterName, projectTitle, projectId) {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const link = `${frontend}/projects/${projectId}?invite=pending`;
  return sendEmail({
    to,
    subject: `${inviterName} invited you to join "${projectTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2>Project invitation</h2>
        <p><strong>${inviterName}</strong> invited you to collaborate on <strong>${projectTitle}</strong> in My Notion.</p>
        <p>Open the project and accept the invitation to access tasks, tables, and team chat.</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View invitation</a></p>
        <p style="color:#888;font-size:12px">You must be a registered My Notion member to join.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendProjectInviteEmail };
