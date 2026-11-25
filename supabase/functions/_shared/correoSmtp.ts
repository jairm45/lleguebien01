// @deno-types="npm:@types/nodemailer@6.4.17"
import nodemailer from "npm:nodemailer@6.9.16";

export function correoValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length <= 254 &&
    /^[^\s,;<>"@\\]+@(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(valor);
}

export function escaparHtml(valor: string) {
  return valor.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export class CorreoSinEnviar extends Error {}

export async function enviarCorreo(to: string, subject: string, text: string, html: string) {
  const host = Deno.env.get("SMTP_HOST");
  const port = Number(Deno.env.get("SMTP_PORT"));
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM");
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) {
    throw new CorreoSinEnviar("Configuración SMTP incompleta.");
  }
  if (!correoValido(to)) throw new CorreoSinEnviar("Destinatario inválido.");
  const transporte = nodemailer.createTransport({
    host, port, secure: port === 465, requireTLS: true, auth: { user, pass },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  await transporte.sendMail({ from, to: { name: "", address: to }, subject, text, html });
}
