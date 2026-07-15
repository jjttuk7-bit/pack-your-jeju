import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIR = path.join(ROOT, "docs", "manual_assets");
const DEBUG_URL = process.env.EDGE_DEBUG_URL || "http://127.0.0.1:9223";
const SERVICE_URL = "https://pack-your-jeju.vercel.app/";
const STATE_KEY = "pack_your_jeju_state_v1";
const GATE_KEY = "pack_your_jeju_gate_v1";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getPageSocket() {
  const targets = await fetch(`${DEBUG_URL}/json`).then((response) => response.json());
  let page = targets.find((target) => target.type === "page" && target.url.startsWith(SERVICE_URL));
  if (!page) {
    const created = await fetch(`${DEBUG_URL}/json/new?${encodeURIComponent(SERVICE_URL)}`, { method: "PUT" });
    page = await created.json();
  }
  return page.webSocketDebuggerUrl;
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression, awaitPromise = true) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
    return result.result.value;
  }

  async screenshot(name) {
    await fs.mkdir(ASSET_DIR, { recursive: true });
    const data = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true,
    });
    const output = path.join(ASSET_DIR, name);
    await fs.writeFile(output, Buffer.from(data.data, "base64"));
    return output;
  }

  close() {
    this.socket.close();
  }
}

async function waitFor(cdp, expression, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await cdp.eval(expression);
    if (value) return value;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function clickText(cdp, text) {
  const clicked = await cdp.eval(`(() => {
    const needle = ${JSON.stringify(text)};
    const controls = [...document.querySelectorAll('button, a, [role="button"]')];
    const el = controls.find((node) => (node.innerText || node.textContent || '').includes(needle));
    if (!el) return false;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    el.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Control not found: ${text}`);
  await sleep(900);
}

async function clickAnyText(cdp, text) {
  const clicked = await cdp.eval(`(() => {
    const needle = ${JSON.stringify(text)};
    const nodes = [...document.querySelectorAll('button, a, [role="button"], svg text, path, div, span, p, h1, h2, h3, label')]
      .filter((node) => {
        const value = (node.innerText || node.textContent || node.getAttribute('aria-label') || '').trim();
        if (!value.includes(needle)) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (ar.width * ar.height) - (br.width * br.height);
      });
    const el = nodes[0];
    if (!el) return false;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = el.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) || el;
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    return true;
  })()`);
  if (!clicked) throw new Error(`Visible text not found: ${text}`);
  await sleep(1000);
}

async function scrollToText(cdp, text, block = "center") {
  return cdp.eval(`(() => {
    const needle = ${JSON.stringify(text)};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const value = (node.innerText || node.textContent || '').trim();
      if (value.includes(needle)) {
        node.scrollIntoView({ block: ${JSON.stringify(block)}, inline: 'center' });
        return true;
      }
    }
    return false;
  })()`);
}

async function setDashboardState(cdp) {
  const state = {
    info: {
      regions: ["aewol", "hallim"],
      startDate: "2026-07-24",
      durationDays: 2,
      companion: "parents",
      purpose: "healing",
      specialNotes: "부모님과 무리 없이 걷고, 주차와 날씨를 함께 확인하고 싶어요.",
    },
    selectedMomentIds: ["oreum", "beach_walk", "quiet_cafe", "local_food"],
    checkedItemIds: [],
    checkedMemoryIds: [],
    customBasicItems: [],
    customMomentItems: {},
    step: "dashboard",
    customMemories: [],
    selectedPlanItems: [],
    visitChecks: {},
  };
  await cdp.eval(`(() => {
    localStorage.setItem(${JSON.stringify(GATE_KEY)}, 'true');
    localStorage.setItem(${JSON.stringify(STATE_KEY)}, ${JSON.stringify(JSON.stringify(state))});
  })()`);
}

async function main() {
  const mode = process.argv[2] || "inspect";
  const cdp = new Cdp(await getPageSocket());
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: SERVICE_URL });
  await sleep(7000);

  if (mode === "inspect") {
    const state = await cdp.eval(`(() => ({
      title: document.title,
      url: location.href,
      text: document.body.innerText.slice(0, 12000),
      controls: [...document.querySelectorAll('button, a, input, select')].slice(0, 300).map((el, index) => ({
        index,
        tag: el.tagName,
        text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim(),
        type: el.getAttribute('type'),
        href: el.getAttribute('href'),
        disabled: Boolean(el.disabled),
      })),
    }))()`);
    process.stdout.write(JSON.stringify(state, null, 2));
    cdp.close();
    return;
  }

  if (mode === "inspect-setup") {
    await clickText(cdp, "여행 시작하기");
    await sleep(2500);
    const state = await cdp.eval(`(() => ({
      title: document.title,
      url: location.href,
      text: document.body.innerText.slice(0, 14000),
      controls: [...document.querySelectorAll('button, a, input, textarea, select')].slice(0, 400).map((el, index) => ({
        index,
        tag: el.tagName,
        text: (el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim(),
        type: el.getAttribute('type'),
        disabled: Boolean(el.disabled),
      })),
    }))()`);
    process.stdout.write(JSON.stringify(state, null, 2));
    cdp.close();
    return;
  }

  if (mode === "inspect-region") {
    await clickText(cdp, "여행 시작하기");
    await sleep(1500);
    await clickAnyText(cdp, "애월");
    await sleep(1800);
    const state = await cdp.eval(`(() => ({
      text: document.body.innerText.slice(0, 16000),
      controls: [...document.querySelectorAll('button, a, input, textarea, select')].slice(0, 500).map((el, index) => ({
        index,
        tag: el.tagName,
        text: (el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim(),
        type: el.getAttribute('type'),
        disabled: Boolean(el.disabled),
      })),
    }))()`);
    process.stdout.write(JSON.stringify(state, null, 2));
    cdp.close();
    return;
  }

  if (mode === "inspect-selected") {
    await clickText(cdp, "여행 시작하기");
    await sleep(1500);
    await clickAnyText(cdp, "애월");
    await clickText(cdp, "플랜 후보에 담기");
    await clickText(cdp, "오름에 올라 바람 맞기");
    await clickText(cdp, "바다 산책하기");
    await sleep(1200);
    const state = await cdp.eval(`(() => ({
      text: document.body.innerText.slice(0, 18000),
      controls: [...document.querySelectorAll('button, a, input, textarea, select')].slice(0, 600).map((el, index) => ({
        index,
        tag: el.tagName,
        text: (el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim(),
        type: el.getAttribute('type'),
        disabled: Boolean(el.disabled),
      })),
    }))()`);
    process.stdout.write(JSON.stringify(state, null, 2));
    cdp.close();
    return;
  }

  if (mode === "capture-current") {
    await cdp.screenshot("01_landing.png");
    await clickText(cdp, "여행 시작하기");
    await sleep(2500);
    await clickAnyText(cdp, "애월");
    await clickText(cdp, "플랜 후보에 담기");
    await clickText(cdp, "오름에 올라 바람 맞기");
    await clickText(cdp, "바다 산책하기");
    await scrollToText(cdp, "여행 조건", "start");
    await sleep(500);
    const setup = await cdp.screenshot("02_region_and_moment.png");

    await cdp.eval(`(() => {
      const date = document.querySelector('input[type="date"]');
      if (date) {
        date.value = '2026-07-24';
        date.dispatchEvent(new Event('input', { bubbles: true }));
        date.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const selects = [...document.querySelectorAll('select')];
      if (selects[0]) {
        selects[0].value = 'parents';
        selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (selects[1]) {
        selects[1].value = 'healing';
        selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
      const note = document.querySelector('textarea');
      if (note) {
        note.value = '부모님과 무리 없이 걷고, 주차와 날씨를 함께 확인하고 싶어요.';
        note.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await sleep(600);
    await clickText(cdp, "제주팩 받기");
    await waitFor(cdp, `document.body.innerText.includes('이번 여행 지도') || document.body.innerText.includes('후보를 고르고')`, 30000);
    await sleep(7000);
    await scrollToText(cdp, "후보를 고르고", "start");
    const overview = await cdp.screenshot("03_pack_overview.png");

    const added = await cdp.eval(`(() => {
      const buttons = [...document.querySelectorAll('button')].filter((button) => (button.innerText || '').includes('플랜에 담기'));
      buttons.slice(0, 2).forEach((button) => button.click());
      return buttons.length;
    })()`);
    await sleep(1200);
    await scrollToText(cdp, "이번 여행 지도", "center");
    const map = await cdp.screenshot("05_plan_map.png");

    await scrollToText(cdp, "다른 후보 5곳 보기", "center");
    await sleep(500);
    const hasMore = await cdp.eval(`document.body.innerText.includes('다른 후보 5곳 보기')`);
    if (hasMore) {
      await clickText(cdp, "다른 후보 5곳 보기");
      await sleep(2500);
    }
    await scrollToText(cdp, "전체", "center");
    const more = await cdp.screenshot("04_more_candidates.png");

    await cdp.eval(`(() => {
      const button = document.querySelector('[aria-label="하루방 에이전트 열기"]');
      if (button) button.click();
      return Boolean(button);
    })()`);
    await sleep(1400);
    await scrollToText(cdp, "하루방 에이전트", "center");
    const haruban = await cdp.screenshot("06_haruban_research.png");

    process.stdout.write(JSON.stringify({ setup, overview, added, map, more, haruban }, null, 2));
    cdp.close();
    return;
  }

  if (mode === "screenshot-pdf") {
    const pdfPath = path.join(ROOT, "docs", "제주를_담다_사용자_매뉴얼_v1.2.pdf");
    const pdfUrl = `file:///${pdfPath.replace(/\\/g, "/").replace(/ /g, "%20")}`;
    await cdp.send("Page.navigate", { url: pdfUrl });
    await sleep(4000);
    await fs.mkdir(path.join(ROOT, "docs", "manual_render_check"), { recursive: true });
    const shots = [];
    for (const [index, y] of [0, 1250, 2500, 3750].entries()) {
      await cdp.eval(`window.scrollTo(0, ${y})`);
      await sleep(900);
      const data = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
        fromSurface: true,
      });
      const output = path.join(ROOT, "docs", "manual_render_check", `viewer_${index + 1}.png`);
      await fs.writeFile(output, Buffer.from(data.data, "base64"));
      shots.push(output);
    }
    process.stdout.write(JSON.stringify(shots, null, 2));
    cdp.close();
    return;
  }

  await fs.mkdir(ASSET_DIR, { recursive: true });
  const data = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  const output = path.join(ASSET_DIR, "01_landing.png");
  await fs.writeFile(output, Buffer.from(data.data, "base64"));
  process.stdout.write(`${output}\n`);
  cdp.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
