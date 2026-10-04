const nodemailer = require('nodemailer');

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

module.exports = async function sendMail({ to, subject, html }) {
  try {
    if (!transporter) return console.log(`[email stub] to=${to} subject=${subject}`);
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
  } catch (err) {
    console.error('Email failed:', err.message); // never break the request over email
  }
};
