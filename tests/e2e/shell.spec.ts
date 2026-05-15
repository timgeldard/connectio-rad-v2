import { test, expect } from '@playwright/test'

test('@smoke app mounts and workspace shell is visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="workspace-shell"]')).toBeVisible()
})

test('@smoke manifest endpoint returns 200', async ({ request }) => {
  const response = await request.get('/api/workspaces/manifest')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.workspaces).toBeDefined()
  expect(body.workspaces.length).toBeGreaterThanOrEqual(1)
})
