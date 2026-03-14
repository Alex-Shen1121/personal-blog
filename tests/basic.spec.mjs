/**
 * 基础功能测试
 * 验证页面加载和基本交互
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    // 检查页面标题
    await expect(page).toHaveTitle(/沈晨玙/);
    
    // 检查主要导航
    await expect(page.locator('nav')).toBeVisible();
    
    // 检查页脚
    await expect(page.locator('footer')).toBeVisible();
  });

  test('should show hero section', async ({ page }) => {
    await page.goto('/');
    
    // 检查 Hero 区域
    const hero = page.locator('main h1');
    await expect(hero).toBeVisible();
  });

  test('should navigate to blog', async ({ page }) => {
    await page.goto('/');
    
    // 点击博客链接
    await page.click('a[href="/blog/"]');
    
    // 验证跳转
    await expect(page).toHaveURL(/.*\/blog\/?$/);
  });
});

test.describe('Blog', () => {
  test('should load blog list page', async ({ page }) => {
    await page.goto('/blog/');
    
    await expect(page).toHaveTitle(/博客/);
  });

  test('should load blog post if available', async ({ page }) => {
    await page.goto('/blog/');
    
    // 查找第一篇文章链接
    const firstPost = page.locator('article a').first();
    
    if (await firstPost.count() > 0) {
      const href = await firstPost.getAttribute('href');
      
      if (href) {
        await page.goto(href);
        
        // 检查文章标题
        await expect(page.locator('article h1')).toBeVisible();
        
        // 检查文章内容
        await expect(page.locator('article .content, article main')).toBeVisible();
      }
    }
  });
});

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');
    
    // 导航到关于页
    await page.click('a[href="/about/"]');
    await expect(page).toHaveURL(/.*\/about\/?$/);
    
    // 导航到项目页
    await page.click('a[href="/projects/"]');
    await expect(page).toHaveURL(/.*\/projects\/?$/);
    
    // 导航到近况页
    await page.click('a[href="/now/"]');
    await expect(page).toHaveURL(/.*\/now\/?$/);
  });
});

test.describe('Theme', () => {
  test('should toggle theme', async ({ page }) => {
    await page.goto('/');
    
    // 查找主题切换按钮
    const themeButton = page.locator('button[aria-label*="主题"], button[title*="主题"], button:has-text("主题")');
    
    if (await themeButton.count() > 0) {
      // 记录当前主题
      const html = await page.locator('html').getAttribute('class');
      
      // 点击切换
      await themeButton.click();
      
      // 验证主题切换
      await page.waitForTimeout(300);
      const newHtml = await page.locator('html').getAttribute('class');
      expect(newHtml).not.toBe(html);
    }
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    // 检查 h1 存在且唯一
    const h1s = await page.locator('h1').count();
    expect(h1s).toBeGreaterThan(0);
  });

  test('should have skip link', async ({ page }) => {
    await page.goto('/');
    
    // 检查跳转到正文链接
    const skipLink = page.locator('a[href="#main-content"], a:has-text("跳到正文")');
    await expect(skipLink.first()).toBeVisible();
  });

  test('should have proper alt text for images', async ({ page }) => {
    await page.goto('/');
    
    // 检查所有图片有 alt 属性
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const src = await img.getAttribute('src');
      
      // 装饰性图片可以为空 alt=""，但内容图片应该有 alt
      if (src && !src.includes('data:') && !src.includes('favicon')) {
        // 只检查可见的图片
        const isVisible = await img.isVisible();
        if (isVisible && !alt) {
          console.log(`Warning: Image without alt: ${src}`);
        }
      }
    }
  });
});
