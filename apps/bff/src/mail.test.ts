import nodemailer from "nodemailer";
import { describe, expect, it, vi } from "vitest";
import { createMailer, smtpOptions } from "./mail";

const settings = {
  SMTP_HOST: "smtp.tem.scaleway.com",
  SMTP_USER: "project-id",
  SMTP_PASSWORD: "secret-key",
};

const mail = {
  to: "ada@example.test",
  subject: "Your booking",
  text: "See you on Monday.",
};

function fakeLog() {
  type Line = (message: string, fields?: Record<string, unknown>) => void;
  return { info: vi.fn<Line>(), warn: vi.fn<Line>() };
}

describe("smtpOptions", () => {
  it("uses TLS from the start on 465 and 2465", () => {
    for (const port of [465, 2465]) {
      const options = smtpOptions({ ...settings, SMTP_PORT: port });
      expect(options).toMatchObject({ secure: true, requireTLS: false });
    }
  });

  it("requires STARTTLS on the other ports", () => {
    for (const port of [25, 587, 2587]) {
      const options = smtpOptions({ ...settings, SMTP_PORT: port });
      expect(options).toMatchObject({ secure: false, requireTLS: true });
    }
  });

  it("signs in with the user and password", () => {
    expect(smtpOptions({ ...settings, SMTP_PORT: 465 }).auth).toEqual({
      user: "project-id",
      pass: "secret-key",
    });
  });
});

describe("createMailer", () => {
  it("sends through the transport, from MAIL_FROM", async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, "sendMail");
    const log = fakeLog();
    const mailer = createMailer({
      transport,
      from: "Acme <no-reply@acme.example>",
      production: true,
      log,
    });

    await mailer.send(mail);

    expect(sendMail).toHaveBeenCalledWith({
      from: "Acme <no-reply@acme.example>",
      ...mail,
    });
    // Neither the recipient nor the subject: both can be personal data.
    expect(log.info).toHaveBeenCalledWith("Mail sent", {
      messageId: expect.any(String),
    });
  });

  it("only logs the mail when no SMTP server is set", async () => {
    const log = fakeLog();
    const mailer = createMailer({
      transport: undefined,
      from: "",
      production: false,
      log,
    });

    await mailer.send(mail);

    expect(log.info).toHaveBeenCalledWith("Mail not sent: SMTP_HOST is unset", {
      to: mail.to,
      subject: mail.subject,
    });
  });

  it("warns in production when mail is dropped, without the recipient or subject", async () => {
    const log = fakeLog();
    const mailer = createMailer({
      transport: undefined,
      from: "",
      production: true,
      log,
    });

    await mailer.send(mail);

    expect(log.warn).toHaveBeenCalledWith("Mail not sent: SMTP_HOST is unset");
  });

  it("passes on the server's refusal without its reply, which quotes the recipient", async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    vi.spyOn(transport, "sendMail").mockRejectedValue(
      Object.assign(
        new Error(
          "Can't send mail - all recipients were rejected: 550 5.1.1 <ada@example.test>: Recipient address rejected",
        ),
        { code: "EENVELOPE", responseCode: 550 },
      ),
    );
    const mailer = createMailer({
      transport,
      from: "no-reply@acme.example",
      production: true,
      log: fakeLog(),
    });

    const error = await mailer.send(mail).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code: "EENVELOPE", responseCode: 550 });
    expect((error as Error).message).toBe("Mail not sent: EENVELOPE 550");
  });
});
