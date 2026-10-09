import { test, expect, Page } from '@playwright/test'

const USERNAME = 'aDmin_2e3722'
const PASSWORD = 'Aa_12345678'
const TARGET_BRANCH = 'San Francisco'

async function loginAndEnsureBranch(page: Page): Promise<void> {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  if (page.url().includes('/login')) {
    const userInput = page.locator('[data-testid="input-username"] input')
    const passInput = page.locator('[data-testid="input-password"] input')
    const submitBtn = page.locator('[data-testid="btn-login-submit"]')

    await userInput.waitFor({ state: 'visible', timeout: 15000 })
    await userInput.fill(USERNAME)
    await passInput.fill(PASSWORD)
    await submitBtn.click()

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
  }

  await page.goto('/financing/groups')
  await page.waitForLoadState('networkidle')

  const branchSwitcher = page.locator('[data-testid="branch-switcher"]')
  await branchSwitcher.waitFor({ state: 'visible', timeout: 15000 })
  const branchText = await branchSwitcher.textContent()

  if (!branchText?.includes(TARGET_BRANCH)) {
    await branchSwitcher.click()
    const targetBranchItem = page.locator('[data-testid="branch-switcher-list"] .v-list-item', {
      hasText: TARGET_BRANCH
    })
    await targetBranchItem.waitFor({ state: 'visible', timeout: 5000 })
    await targetBranchItem.click()
    await page.waitForTimeout(1000)
    await page.waitForLoadState('networkidle')
  }
}

test.describe('Verificación de Convenciones de Participantes', () => {
  test('TC-P1: Vista de participantes con diseño estándar y sin valores hardcodeados', async ({ page }) => {
    await loginAndEnsureBranch(page)

    // Ir a participantes del primer grupo disponible
    const firstGroupRow = page.locator('[data-testid="sam-groups-table"] tbody tr').first()
    await firstGroupRow.waitFor({ state: 'visible', timeout: 10000 })
    
    // Navegación directa a /financing/groups/1/participants
    await page.goto('/financing/groups/1/participants')
    await page.waitForLoadState('networkidle')

    // 1. Verificar presencia de la tabla y controles principales
    const table = page.locator('[data-testid="participants-table"]')
    await expect(table).toBeVisible({ timeout: 10000 })

    // 2. Verificar buscador de 7 cols
    const searchInput = page.locator('[data-testid="participant-search-input"]')
    await expect(searchInput).toBeVisible()

    // 3. Verificar botón de recarga con tooltip
    const refreshBtn = page.locator('[data-testid="btn-refresh-participants"]')
    await expect(refreshBtn).toBeVisible()

    // 4. Tomar screenshot de la vista principal
    await page.screenshot({ path: '/home/daniel-castillo/.gemini/antigravity/brain/1f2de8ae-11a3-496f-8e19-c5092ff92684/participants_view_layout.png' })

    // 5. Abrir diálogo de Nuevo Participante y verificar que NO tenga valores por defecto
    const btnNewParticipant = page.locator('[data-testid="btn-create-participant"]')
    await btnNewParticipant.click()

    const inputClientId = page.locator('[data-testid="input-participant-client-id"] input')
    await inputClientId.waitFor({ state: 'visible' })
    const clientIdVal = await inputClientId.inputValue()
    expect(clientIdVal).toBe('')

    const inputPosition = page.locator('[data-testid="input-participant-position"] input')
    const positionVal = await inputPosition.inputValue()
    expect(positionVal).toBe('')

    const inputModel = page.locator('[data-testid="input-participant-model"] input')
    const modelVal = await inputModel.inputValue()
    expect(modelVal).toBe('')

    const inputColor = page.locator('[data-testid="input-participant-color"] input')
    const colorVal = await inputColor.inputValue()
    expect(colorVal).toBe('')

    // Screenshot del modal limpio
    await page.screenshot({ path: '/home/daniel-castillo/.gemini/antigravity/brain/1f2de8ae-11a3-496f-8e19-c5092ff92684/participant_modal_clean.png' })

    // Cerrar modal
    const cancelBtn = page.locator('.v-dialog button:has-text("Cancelar")').first()
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }
  })
})
