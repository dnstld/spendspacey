import { chromium } from '@playwright/test';
// Vector recreation of the existing s-dot mark. No remote font/image input.
const browser = await chromium.launch();
try {
  for (const [name, size, inset] of [
    ['app-192', 192, 20],
    ['app-512', 512, 20],
    ['maskable-512', 512, 28],
    ['apple-touch-icon', 180, 20],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>body{margin:0;background:#184d3f}svg{display:block;width:100vw;height:100vh}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="translate(${inset} ${inset}) scale(${(100 - 2 * inset) / 100})"><path d="M70 24C60 12 24 14 24 35c0 26 47 12 47 32 0 20-37 22-49 7" fill="none" stroke="white" stroke-width="13" stroke-linecap="round"/><circle cx="90" cy="85" r="9" fill="#b5d994"/></g></svg>`,
    );
    await page.screenshot({ path: `public/icons/${name}.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
