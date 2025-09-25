const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const puppeteer = require("puppeteer");

function crearCliente() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./session" }),
    puppeteer: {
      executablePath: puppeteer.executablePath(), // usa Chrome/Chromium de Puppeteer
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    },
  });

  client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("✅ Cliente de WhatsApp listo y conectado.");
  });

  return client;
}

module.exports = { crearCliente };
