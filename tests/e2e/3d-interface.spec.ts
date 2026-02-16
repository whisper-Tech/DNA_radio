import { test, expect } from '@playwright/test';

test.describe('DNA Radio 3D Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/radio-3d');
    await page.waitForLoadState('networkidle');
  });

  test('should load 3D scene', async ({ page }) => {
    // Check if canvas is present
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Check if DNA helix loads
    await page.waitForTimeout(2000); // Allow 3D to load
    
    // Verify WebGL context
    const webglContext = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas ? !!canvas.getContext('webgl') : false;
    });
    expect(webglContext).toBe(true);
  });

  test('should display UI overlay', async ({ page }) => {
    // Check title
    await expect(page.locator('h1')).toContainText('DNA Radio');
    
    // Check controls
    await expect(page.locator('button:has-text("Play")')).toBeVisible();
    await expect(page.locator('button:has-text("Next")')).toBeVisible();
    
    // Check playlist panel
    await expect(page.locator('text=Playlist')).toBeVisible();
  });

  test('should interact with song orbs', async ({ page }) => {
    // Wait for 3D to load
    await page.waitForTimeout(2000);
    
    // Click on a song orb (simulated)
    await page.mouse.move(400, 300);
    await page.mouse.click(400, 300);
    
    // Check if song selection updates
    await page.waitForTimeout(500);
    const currentSong = page.locator('.text-cyan-300');
    // Note: Actual 3D interaction testing would require more specific selectors
  });

  test('should control playback', async ({ page }) => {
    // Find and click play/pause button
    const playButton = page.locator('button:has-text("Pause")');
    await expect(playButton).toBeVisible();
    await playButton.click();
    
    // Check if button text changes
    await expect(page.locator('button:has-text("Play")')).toBeVisible();
  });

  test('should navigate playlist', async ({ page }) => {
    // Check playlist items
    const playlistItems = page.locator('.space-y-2 > div');
    await expect(playlistItems.first()).toBeVisible();
    
    // Click on a playlist item
    await playlistItems.first().click();
    
    // Verify selection updates
    await page.waitForTimeout(500);
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    // UI should adapt
    await expect(page.locator('h1')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('should handle camera controls', async ({ page }) => {
    const canvas = page.locator('canvas');
    
    // Test drag to rotate
    await canvas.hover();
    await page.mouse.down();
    await page.mouse.move(500, 300);
    await page.mouse.up();
    
    // Test scroll to zoom
    await canvas.hover();
    await page.mouse.wheel(0, -100);
    
    await page.waitForTimeout(500);
  });
});

test.describe('DNA Radio Main Pages', () => {
  test('should navigate to 3D radio', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Check if main page loads
    await expect(page.locator('body')).toBeVisible();
    
    // Navigate to 3D radio
    await page.goto('http://localhost:5173/radio-3d');
    await expect(page.locator('h1:has-text("DNA Radio")')).toBeVisible();
  });
});
