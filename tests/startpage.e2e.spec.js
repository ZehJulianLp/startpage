const { test, expect } = require('@playwright/test');

async function seedStartpage(page, values={}){
  await page.addInitScript(seed=>{
    if(sessionStorage.getItem('e2e.seeded') === 'true') return;
    localStorage.clear();
    localStorage.setItem('onboarding.done', 'true');
    localStorage.setItem('ai.agent.enabled', 'false');
    Object.entries(seed).forEach(([key, value])=> localStorage.setItem(key, JSON.stringify(value)));
    sessionStorage.setItem('e2e.seeded', 'true');
  }, values);
}

test('loads the local dashboard and persists a todo', async ({ page })=>{
  await seedStartpage(page, {
    widgets: { todo:true, notes:true, tiles:false, weather:false, transport:false, quote:false, recent:false, system:false, news:false }
  });
  await page.goto('/');
  await expect(page.locator('#clock')).not.toHaveText('--:--');
  await page.locator('#todoInput').fill('Smoke test task');
  await page.locator('#todoAdd').click();
  await expect(page.locator('#todoList')).toContainText('Smoke test task');
  await page.reload();
  await expect(page.locator('#todoList')).toContainText('Smoke test task');
});

test('does not request data or favicons for hidden widgets', async ({ page })=>{
  await seedStartpage(page, {
    widgets: { todo:true, notes:true, tiles:false, weather:false, transport:false, quote:false, recent:false, system:false, news:false }
  });
  const externalWidgetRequests = [];
  page.on('request', request=>{
    if(/open-meteo|api-startpage\.julianverse|google\.com\/s2\/favicons/.test(request.url())) externalWidgetRequests.push(request.url());
  });
  await page.goto('/');
  await page.waitForTimeout(500);
  expect(externalWidgetRequests).toEqual([]);
});

test('renders untrusted RSS content as text and blocks unsafe links', async ({ page })=>{
  await seedStartpage(page, {
    widgets: { todo:false, notes:false, tiles:false, weather:false, transport:false, quote:false, recent:false, system:false, news:true },
    'news.custom': { Unsafe:'https://feed.test/rss' },
    'news.source': 'Unsafe'
  });
  await page.route('https://api-startpage.julianverse.de/api/rss**', route=> route.fulfill({
    contentType: 'application/xml',
    body: '<rss><channel><item><title>&lt;img src=x onerror="window.__rssPwned=1"&gt;</title><link>javascript:window.__rssPwned=1</link></item></channel></rss>'
  }));
  await page.goto('/');
  await expect(page.locator('#newsList')).toContainText('<img src=x');
  await expect(page.locator('#newsList a')).toHaveCount(0);
  expect(await page.evaluate(()=> window.__rssPwned || 0)).toBe(0);
});

test('formats transport delays in minutes', async ({ page })=>{
  await seedStartpage(page, {
    widgets: { todo:false, notes:false, tiles:false, weather:false, transport:true, quote:false, recent:false, system:false, news:false },
    'transport.station': { id:'test-stop', name:'Test Stop', type:'station' },
    'transport.duration': 30
  });
  await page.route('https://api-startpage.julianverse.de/api/stations/test-stop/departures**', route=> route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ when:new Date(Date.now() + 600000).toISOString(), delay:120, direction:'Center', line:{ name:'S1' } }])
  }));
  await page.goto('/');
  await expect(page.locator('#transportList')).toContainText(/\+2 min/i);
});

test('applies saved widget order and size', async ({ page })=>{
  await seedStartpage(page, {
    widgets: { todo:true, notes:false, tiles:false, weather:false, transport:false, quote:false, recent:false, system:false, news:false },
    'layout.widgets.order': ['news','todo','notes','tiles','weather','transport','quote','recent','system'],
    'layout.widgets.sizes': { todo:{ width:12, height:'tall' } }
  });
  await page.goto('/');
  await expect(page.locator('main.grid > section').first()).toHaveAttribute('id', 'newsCard');
  await expect(page.locator('#todo')).toHaveClass(/col-12/);
  await expect(page.locator('#todo')).toHaveAttribute('data-widget-height', 'tall');
});

test('opens settings as a labelled modal dialog', async ({ page })=>{
  await seedStartpage(page);
  await page.goto('/');
  await page.locator('#openSettings').click();
  const dialog = page.locator('#settingsModal [role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-labelledby', 'settingsDialogTitle');
  expect(await page.evaluate(()=> document.querySelector('#settingsModal').contains(document.activeElement))).toBe(true);
});
