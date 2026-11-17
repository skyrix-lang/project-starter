import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env, type Env } from "./env";
import { log as defaultLog } from "./log";

// Sends mail through the SMTP server in SMTP_HOST, such as Scaleway
// Transactional Email (smtp.tem.scaleway.com). Without SMTP_HOST nothing is
// sent: the mail is logged instead. Tests never set it (playwright.config.ts
// clears it), so they can't reach a real inbox.
//
// Anything that sends mail because of a request must be rate limited with
// hit() from ./rate-limit.ts, keyed by user or client address.

export interface Mail {
  to: string;
  subject: string;
  /** The plain-text body. Always required: it's what some clients show. */
  text: string;
  html?: string;
  replyTo?: string;
}

type Log = Pick<typeof defaultLog, "info" | "warn">;

/** The SMTP connection for `settings`, refusing to send credentials unencrypted. */
export function smtpOptions(
  settings: Pick<
    Env,
    "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASSWORD"
  >,
): SMTPTransport.Options {
  const implicitTls = settings.SMTP_PORT === 465 || settings.SMTP_PORT === 2465;
  return {
    host: settings.SMTP_HOST,
    port: settings.SMTP_PORT,
    // 465 and 2465 speak TLS from the first byte; the other ports must
    // upgrade with STARTTLS, or the mail isn't sent.
    secure: implicitTls,
    requireTLS: !implicitTls,
    auth: { user: settings.SMTP_USER, pass: settings.SMTP_PASSWORD },
    // A slow server fails the send instead of holding the request for minutes.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  };
}

/**
 * The error without the server's reply, which Nodemailer adds to the message
 * and which often quotes the recipient ("550 <ada@example.com> rejected").
 * Only the codes are kept: they say what went wrong.
 */
function refusal(error: unknown): Error {
  const fields: { code?: unknown; responseCode?: unknown } =
    error instanceof Error ? (error as { code?: unknown }) : {};
  const code = typeof fields.code === "string" ? fields.code : undefined;
  const responseCode =
    typeof fields.responseCode === "number" ? fields.responseCode : undefined;
  const reason = [code, responseCode].filter(Boolean).join(" ") || "unknown";
  return Object.assign(new Error(`Mail not sent: ${reason}`), {
    ...(code ? { code } : {}),
    ...(responseCode ? { responseCode } : {}),
  });
}

export function createMailer(options: {
  /** Undefined: mail is logged, not sent. */
  transport: Transporter | undefined;
  from: string;
  /** Production warns when mail is dropped, and doesn't log recipients. */
  production: boolean;
  log?: Log;
}) {
  const { transport, from, production, log = defaultLog } = options;
  return {
    /** Sends `mail`, or logs it when no SMTP server is set. Throws when the server refuses it. */
    async send(mail: Mail): Promise<void> {
      // In production, neither the recipient nor the subject is logged: both
      // can be personal data, and the message id finds the mail in the
      // provider's logs.
      if (!transport) {
        if (production) log.warn("Mail not sent: SMTP_HOST is unset");
        else {
          log.info("Mail not sent: SMTP_HOST is unset", {
            to: mail.to,
            subject: mail.subject,
          });
        }
        return;
      }
      let info;
      try {
        info = await transport.sendMail({ from, ...mail });
      } catch (error) {
        throw refusal(error);
      }
      log.info("Mail sent", { messageId: info.messageId });
    },
  };
}

export type Mailer = ReturnType<typeof createMailer>;
let cached: Mailer | undefined;

/** The mailer configured from the environment, created on first use. */
export function mailer(): Mailer {
  if (cached) return cached;
  const settings = env();
  cached = createMailer({
    transport: settings.SMTP_HOST
      ? nodemailer.createTransport(smtpOptions(settings))
      : undefined,
    from: settings.MAIL_FROM ?? "",
    production: settings.NODE_ENV === "production",
  });
  return cached;
}
