const brevo = require('@getbrevo/brevo');

const EMAIL_TIMEOUT_MS = 12000;

let emailApi = null;

function getClient() {
  if (!process.env.BREVO_API_KEY) return null;
  if (!emailApi) {
    emailApi = new brevo.TransactionalEmailsApi();
    emailApi.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );
  }
  return emailApi;
}

function getFromEmail() {
  return process.env.BREVO_FROM_EMAIL?.trim() || null;
}

function withTimeout(promise, ms = EMAIL_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email delivery timed out')), ms);
    }),
  ]);
}

function getErrorMessage(err) {
  if (err?.body?.message) return err.body.message;
  if (typeof err?.body === 'string') return err.body;
  return err?.message || 'Unknown error';
}

async function sendEmail({ to, subject, html }) {
  const client = getClient();
  const fromEmail = getFromEmail();

  if (!client) {
    console.warn('Brevo not configured — email not sent to', to);
    return { sent: false, reason: 'not_configured' };
  }
  if (!fromEmail) {
    console.warn('BREVO_FROM_EMAIL not set — email not sent');
    return { sent: false, reason: 'from_not_configured' };
  }

  try {
    await withTimeout(
      client.sendTransacEmail({
        subject,
        htmlContent: html,
        sender: { name: 'SortLife', email: fromEmail },
        to: [{ email: to }],
      })
    );
    return { sent: true };
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error('Brevo email failed:', msg);
    return { sent: false, reason: msg };
  }
}

async function sendVerificationEmail(to, name, code) {
  return sendEmail({
    to,
    subject: 'Your SortLife confirmation code',
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
        <p><strong>${inviterName}</strong> invited you to collaborate on <strong>${projectTitle}</strong> in SortLife.</p>
        <p>Open the project and accept the invitation to access tasks, tables, and team chat.</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View invitation</a></p>
        <p style="color:#888;font-size:12px">You must be a registered SortLife member to join.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendProjectInviteEmail };
