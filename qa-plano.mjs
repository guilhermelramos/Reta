import { chromium } from "playwright";

const base = "http://127.0.0.1:8090";
const out = "/workspace/screenshots";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${base}/plano`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Plano" }).waitFor();
await page.getByRole("button", { name: "Editar" }).first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/plano-editor.png`, fullPage: true });

const topic = "TÓPICO EDITADO NO CELULAR QA";
const firstBlock = page.locator("fieldset").first();
await firstBlock.getByRole("textbox").last().fill(topic);
await firstBlock.getByPlaceholder("45 · 1h30").fill("1h25");
await page.getByRole("button", { name: "Salvar dia" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/plano-salvo.png`, fullPage: true });
const body = await page.locator("body").innerText();
console.log("EDIT SAVED:", body.includes(topic), "/ 1h25:", body.includes("1h25"));

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);
const body2 = await page.locator("body").innerText();
console.log("PERSISTED AFTER RELOAD:", body2.includes(topic));

// novo dia
await page.getByRole("button", { name: "Novo dia" }).click();
await page.waitForTimeout(200);
await page.getByLabel("Data").fill("2026-12-15");
await page.getByLabel("Fase / nome do dia").fill("Dia QA manual");
await page.locator("fieldset").first().getByRole("textbox").last().fill("Física: eletrodinâmica QA");
await page.locator("fieldset").first().getByPlaceholder("45 · 1h30").fill("50");
await page.screenshot({ path: `${out}/plano-novo-dia.png`, fullPage: true });
await page.getByRole("button", { name: "Salvar dia" }).click();
await page.waitForTimeout(600);
const after = await page.locator("body").innerText();
console.log("NEW DAY SAVED:", after.includes("15 de dez.") || after.includes("Dia QA manual"));
await page.getByRole("button", { name: /15 de dez/ }).first().click();
await page.waitForTimeout(300);
const detail = await page.locator("body").innerText();
console.log("NEW DAY DETAIL:", detail.includes("Dia QA manual"), detail.includes("Física: eletrodinâmica QA"));
console.log("NEW DAY SNIPPET:", JSON.stringify(detail.split("Dia QA manual")[1]?.slice(0, 220)));
console.log("LIST 15 DEZ:", JSON.stringify((await page.getByRole("button", { name: /15 de dez/ }).first().innerText())));
await page.screenshot({ path: `${out}/plano-novo-dia-salvo.png`, fullPage: true });

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);
const body3 = await page.locator("body").innerText();
console.log("NEW DAY PERSISTED:", body3.includes("Dia QA manual") || body3.includes("15 de dez"));

await ctx.close();

// mobile
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
const merrors = [];
mp.on("console", (m) => { if (m.type() === "error") merrors.push(m.text()); });
mp.on("pageerror", (e) => merrors.push(`pageerror: ${e.message}`));
await mp.goto(`${base}/plano`, { waitUntil: "networkidle" });
await mp.getByRole("heading", { name: "Plano" }).waitFor();
await mp.screenshot({ path: `${out}/plano-mobile.png`, fullPage: true });
await mp.getByRole("button", { name: "Novo dia" }).click();
await mp.waitForTimeout(300);
await mp.screenshot({ path: `${out}/plano-mobile-editor.png`, fullPage: true });
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log("MOBILE HORIZONTAL OVERFLOW:", overflow);
console.log("CONSOLE ERRORS:", JSON.stringify({ desktop: errors, mobile: merrors }, null, 2));

await mctx.close();
await browser.close();
