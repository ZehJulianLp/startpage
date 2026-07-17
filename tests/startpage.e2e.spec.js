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

test('exports only Startpage-owned localStorage entries', async ({ page })=>{
  await seedStartpage(page, {
    todos: [{ text:'Keep me', done:false }],
    paymentMethod: 'redstone-bank',
    lastReceipt: { method:'redstone-bank' }
  });
  await page.goto('/');
  await page.locator('#openSettings').click();
  await page.locator('[data-tab="data"]').click();
  await page.locator('#exportData').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#dataTransferApply').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));

  expect(exported.todos).toEqual([{ text:'Keep me', done:false }]);
  expect(exported).not.toHaveProperty('paymentMethod');
  expect(exported).not.toHaveProperty('lastReceipt');
});

test('does not request data or favicons for hidden widgets', async ({ page })=>{
  await seedStartpage(page, {
    widgets: { todo:true, notes:true, tiles:false, weather:false, transport:false, quote:false, recent:false, system:false, news:false }
  });
  const externalWidgetRequests = [];
  page.on('request', request=>{
    if(/open-meteo|api-startpage\.julianverse|verkehr\.autobahn|google\.com\/s2\/favicons/.test(request.url())) externalWidgetRequests.push(request.url());
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

test('adapts the number of news items to the widget height', async ({ page })=>{
  const items = Array.from({ length:20 }, (_, index)=> `<item><title>News ${index + 1}</title><link>https://example.com/${index + 1}</link></item>`).join('');
  await seedStartpage(page, {
    widgets: { todo:false, notes:false, tiles:false, weather:false, transport:false, quote:false, recent:false, system:false, news:true },
    'news.custom': { Test:'https://feed.test/rss' },
    'news.source': 'Test',
    'layout.widgets.sizes': { news:{ width:12, height:'tall' } }
  });
  await page.route('https://api-startpage.julianverse.de/api/rss**', route=> route.fulfill({
    contentType: 'application/xml',
    body: `<rss><channel>${items}</channel></rss>`
  }));
  await page.goto('/');
  await expect(page.locator('#newsList > li')).toHaveCount(16);

  await page.locator('#widgetLayoutToggle').click();
  await page.locator('#newsCard .widget-layout-height').click();
  await expect(page.locator('#newsCard')).toHaveAttribute('data-widget-height', 'auto');
  await expect(page.locator('#newsList > li')).toHaveCount(8);
});

test('formats transport delays in minutes', async ({ page })=>{
  await seedStartpage(page, {
    widgets: { todo:false, notes:false, tiles:false, weather:false, transport:true, quote:false, recent:false, system:false, news:false },
    'transport.station': { id:'test-stop', name:'Test Stop', type:'station' },
    'transport.duration': 30
  });
  await page.route('https://api-startpage.julianverse.de/api/departures**', route=> route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ok:true,
      updatedAt:new Date().toISOString(),
      departures:[{ when:new Date(Date.now() + 600000).toISOString(), delaySeconds:120, direction:'Center', line:'S1' }]
    })
  }));
  await page.goto('/');
  await expect(page.locator('#transportList')).toContainText(/\+2 min/i);
});

test('switches the transport widget to deduplicated autobahn reports and saves roads', async ({ page })=>{
  await seedStartpage(page, {
    widgets: { todo:false, notes:false, tiles:false, weather:false, transport:true, quote:false, recent:false, system:false, news:false },
    'transport.autobahn.roads': ['A7']
  });
  await page.route('https://verkehr.autobahn.de/o/autobahn/**', route=>{
    const type = route.request().url().split('/').pop();
    const event = {
      identifier:'shared-event',
      title:'A7 | Hannover - Hamburg',
      subtitle:'Hannover -> Hamburg',
      delayTimeValue:'8',
      isBlocked:'false',
      future:false
    };
    route.fulfill({
      contentType:'application/json',
      body:JSON.stringify({ [type]:type === 'warning' ? [event, event] : [] })
    });
  });
  await page.goto('/');
  await page.locator('#transportModeAutobahn').click();
  await expect(page.locator('#transportAutobahnPanel')).toBeVisible();
  await expect(page.locator('#transportTransitPanel')).toBeHidden();
  await expect(page.locator('#transportDurationWrap')).toBeHidden();
  await expect(page.locator('#autobahnList .autobahn-item')).toHaveCount(1);
  await expect(page.locator('#autobahnList')).toContainText('Hannover - Hamburg');
  await expect(page.locator('#autobahnList')).toContainText('+8 min');

  await page.locator('#openSettings').click();
  await page.locator('[data-tab="widgets"]').click();
  await page.locator('#autobahnRoads').fill('a2\nA7\ninvalid');
  await page.locator('#autobahnRoads').blur();
  await expect(page.locator('#autobahnRoads')).toHaveValue('A2\nA7');
  expect(await page.evaluate(()=> JSON.parse(localStorage.getItem('transport.autobahn.roads')))).toEqual(['A2', 'A7']);
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

test('toggles the visual widget editor and persists direct changes', async ({ page })=>{
  await seedStartpage(page, {
    widgets: { todo:true, notes:true, tiles:false, weather:false, transport:false, quote:false, recent:false, system:false, news:false }
  });
  await page.goto('/');
  const todoControls = page.locator('#todo .widget-layout-controls');
  await expect(todoControls).not.toBeVisible();

  await page.locator('#widgetLayoutToggle').click();
  await expect(todoControls).toBeVisible();
  await expect(page.locator('#widgetLayoutToolbar')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/ui-revealed/);
  await page.locator('#todo .widget-layout-width').last().click();
  await expect(page.locator('#todo')).toHaveClass(/col-8/);
  expect(await page.locator('#todo').evaluate(el=> getComputedStyle(el).animationName)).toBe('none');

  await page.locator('#todo .widget-layout-drag').dragTo(page.locator('#notes'), { targetPosition:{ x:300, y:180 } });
  await expect(page.locator('main.grid > section').first()).toHaveAttribute('id', 'notes');
  await page.locator('#widgetLayoutToggle').click();
  await expect(todoControls).not.toBeVisible();
  await expect(page.locator('#widgetLayoutToolbar')).toBeHidden();

  await page.reload();
  await expect(page.locator('#todo')).toHaveClass(/col-8/);
  await expect(page.locator('main.grid > section').first()).toHaveAttribute('id', 'notes');
  await expect(todoControls).not.toBeVisible();
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
