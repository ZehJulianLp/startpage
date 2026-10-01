const { test, expect } = require('@playwright/test');

for(const viewport of [{ width:1280, height:900 }, { width:390, height:844 }]){
  test(`opens Julianverse News for all sources or the selected feed (${viewport.width}px)`, async ({ page, context })=>{
    await page.setViewportSize(viewport);
    const feed = 'https://feed.test/rss?topic=tech&lang=de&token=a+b%2Fc';
    await page.addInitScript(feedUrl=>{
      if(sessionStorage.getItem('e2e.seeded')) return;
      localStorage.setItem('onboarding.done', 'true');
      localStorage.setItem('ai.agent.enabled', 'false');
      localStorage.setItem('ui.locale', JSON.stringify('de-de'));
      localStorage.setItem('widgets', JSON.stringify({ todo:false, notes:false, tiles:false, weather:false, transport:false, quote:false, recent:false, system:false, news:true }));
      localStorage.setItem('news.custom', JSON.stringify({ 'Mein Feed':feedUrl, Unsafe:'javascript:alert(1)' }));
      localStorage.setItem('news.source', JSON.stringify('__all__'));
      sessionStorage.setItem('e2e.seeded', 'true');
    }, feed);
    await context.route('https://api-startpage.julianverse.de/api/rss**', route=> route.fulfill({
      contentType:'application/xml',
      body:'<rss><channel><item><title>Test News</title><link>https://example.test/story</link></item></channel></rss>'
    }));
    await context.route('https://julianverse.de/news/**', route=> route.fulfill({ contentType:'text/html', body:'News target' }));
    await page.goto('/');
    const button = page.getByRole('link', { name:'In Julianverse News öffnen', exact:true });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('href', 'https://julianverse.de/news/');
    await expect(button).toHaveAttribute('target', '_blank');
    const openNews = async ()=>{
      const popupPromise = page.waitForEvent('popup');
      await button.click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      const url = new URL(popup.url());
      await popup.close();
      return url;
    };
    expect((await openNews()).href).toBe('https://julianverse.de/news/');

    // The native select is visually replaced by the Startpage's accessible select widget.
    const select = async value=>{
      await page.locator('#newsSource').selectOption(value, { force:true });
    };
    await select('Mein Feed');
    const customUrl = await openNews();
    expect(customUrl.searchParams.get('feed')).toBe(feed);
    expect(customUrl.searchParams.get('name')).toBe('Mein Feed');
    await page.reload();
    await expect(button).toHaveAttribute('href', customUrl.href);
    await select('Heise');
    await expect(button).toHaveAttribute('href', /feed=https%3A%2F%2Fwww\.heise\.de/);
    await select('__all__');
    await expect(button).toHaveAttribute('href', 'https://julianverse.de/news/');
    await select('Unsafe');
    await expect(button).toHaveAttribute('href', 'https://julianverse.de/news/');
    await select('__all__');
    await button.scrollIntoViewIfNeeded();
    const bounds = await button.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    await page.locator('#newsCard').screenshot({ path:`/tmp/startpage-news-magic-${viewport.width}.png` });
  });
}
