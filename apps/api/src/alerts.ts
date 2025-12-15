import nodemailer from "nodemailer";
import { env } from "./env";

export function canEmail() {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

export async function sendEmail(to: string, subject: string, text: string) {
  if (!canEmail()) return;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text
  });
}
