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

  await page.locator('[data-testid="sam-groups-table"]').waitFor({ state: 'visible', timeout: 15000 })
}

test.describe.serial('Gestión Completa de Participantes - Pruebas y Registros E2E', () => {
  let targetGroupId = '1'

  test('01. Navegación hacia participantes del grupo', async ({ page }) => {
    await loginAndEnsureBranch(page)

    // Navegar directamente a los participantes del grupo 1
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('[data-testid="participants-table"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="btn-create-participant"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-generate-group-quotes"]')).toBeVisible()
    await expect(page.locator('[data-testid="btn-view-qualified"]')).toBeVisible()
  })

  test('02. Registro de Participante 1 (Carlos Pérez)', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    // Abrir modal de nuevo participante
    await page.locator('[data-testid="btn-create-participant"]').click()

    // 1. Seleccionar Cliente con AppPaginatedSelect
    const clientInput = page.locator('[data-testid="select-participant-client"] input')
    await clientInput.waitFor({ state: 'visible', timeout: 5000 })
    await clientInput.click()
    await clientInput.fill('Carlos')
    await page.waitForTimeout(600)
    const clientOption = page.locator('.v-overlay .v-list-item').filter({ hasText: 'Carlos' }).first()
    await clientOption.waitFor({ state: 'visible', timeout: 5000 })
    await clientOption.click()

    // 2. Seleccionar Asesor con AppPaginatedSelect
    const advisorInput = page.locator('[data-testid="select-participant-advisor"] input')
    await advisorInput.click()
    await advisorInput.fill('Alejandro')
    await page.waitForTimeout(600)
    const advisorOption = page.locator('.v-overlay .v-list-item').filter({ hasText: 'Alejandro' }).first()
    await advisorOption.waitFor({ state: 'visible', timeout: 5000 })
    await advisorOption.click()

    // 3. Posición
    const positionInput = page.locator('[data-testid="input-participant-position"] input')
    await positionInput.fill('1')

    // 4. Marca, Modelo, Año
    const brandInput = page.locator('[data-testid="input-participant-brand"] input')
    await brandInput.fill('Bera')

    const modelInput = page.locator('[data-testid="input-participant-model"] input')
    await modelInput.fill('SBR 150')

    const yearInput = page.locator('[data-testid="input-participant-year"] input')
    await yearInput.fill('2024')

    const colorInput = page.locator('[data-testid="input-participant-color"] input')
    await colorInput.fill('Azul Eléctrico')

    const chassisInput = page.locator('[data-testid="input-participant-chassis"] input')
    await chassisInput.fill('BERA1234567890')

    // Submit
    const submitBtn = page.locator('.v-dialog button[type="submit"]')
    await submitBtn.click()

    // Esperar snackbar o refresco
    await page.waitForTimeout(1500)
    await page.waitForLoadState('networkidle')

    // Verificar en tabla
    const tableBody = page.locator('[data-testid="participants-table"] tbody')
    await expect(tableBody).toContainText('Carlos', { timeout: 10000 })
  })

  test('03. Registro de Participante 2 (María González)', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    await page.locator('[data-testid="btn-create-participant"]').click()

    // 1. Seleccionar Cliente con AppPaginatedSelect
    const clientInput = page.locator('[data-testid="select-participant-client"] input')
    await clientInput.waitFor({ state: 'visible', timeout: 5000 })
    await clientInput.click()
    await clientInput.fill('María')
    await page.waitForTimeout(600)
    const clientOption = page.locator('.v-overlay .v-list-item').filter({ hasText: 'María' }).first()
    await clientOption.waitFor({ state: 'visible', timeout: 5000 })
    await clientOption.click()

    // 2. Seleccionar Asesor con AppPaginatedSelect
    const advisorInput = page.locator('[data-testid="select-participant-advisor"] input')
    await advisorInput.click()
    await advisorInput.fill('Alejandro')
    await page.waitForTimeout(600)
    const advisorOption = page.locator('.v-overlay .v-list-item').filter({ hasText: 'Alejandro' }).first()
    await advisorOption.waitFor({ state: 'visible', timeout: 5000 })
    await advisorOption.click()

    const positionInput = page.locator('[data-testid="input-participant-position"] input')
    await positionInput.fill('2')

    const brandInput = page.locator('[data-testid="input-participant-brand"] input')
    await brandInput.fill('Empire')

    const modelInput = page.locator('[data-testid="input-participant-model"] input')
    await modelInput.fill('Keeway 150')

    const yearInput = page.locator('[data-testid="input-participant-year"] input')
    await yearInput.fill('2024')

    const colorInput = page.locator('[data-testid="input-participant-color"] input')
    await colorInput.fill('Rojo Rubí')

    const submitBtn = page.locator('.v-dialog button[type="submit"]')
    await submitBtn.click()

    await page.waitForTimeout(1500)
    await page.waitForLoadState('networkidle')

    const tableBody = page.locator('[data-testid="participants-table"] tbody')
    await expect(tableBody).toContainText('María', { timeout: 10000 })
  })

  test('04. Ver Detalles del Participante 1', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    // Clic en menú de 3 puntos del primer participante
    const menuBtn = page.locator('[data-testid="btn-participant-actions-menu"]').first()
    await menuBtn.click()

    // Clic en "Ver Detalles"
    const detailsItem = page.locator('[data-testid="menu-item-participant-details"]')
    await detailsItem.waitFor({ state: 'visible', timeout: 5000 })
    await detailsItem.click()

    // Validar modal de detalles
    const dialog = page.locator('.v-dialog')
    await expect(dialog).toContainText('Detalles del Participante')
    await expect(dialog).toContainText('Carlos')
    await expect(dialog).toContainText('Turno Asignado')

    // Cerrar modal
    const closeBtn = page.locator('.v-dialog button:has-text("Cerrar")')
    await closeBtn.click()
    await page.waitForTimeout(500)
  })

  test('05. Edición del Participante (Cambio de datos)', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    // Clic en menú de 3 puntos del primer participante
    const menuBtn = page.locator('[data-testid="btn-participant-actions-menu"]').first()
    await menuBtn.click()

    // Clic en "Editar Participante"
    const editItem = page.locator('[data-testid="menu-item-edit-participant"]')
    await editItem.waitFor({ state: 'visible', timeout: 5000 })
    await editItem.click()

    // Modal de edición visible
    const colorInput = page.locator('[data-testid="input-participant-color"] input')
    await colorInput.waitFor({ state: 'visible', timeout: 5000 })
    await colorInput.fill('Negro Titanio')

    const submitBtn = page.locator('.v-dialog button[type="submit"]')
    await submitBtn.click()

    await page.waitForTimeout(1500)
    await page.waitForLoadState('networkidle')

    // Abrir detalles para confirmar la modificación de color
    const menuBtnAfter = page.locator('[data-testid="btn-participant-actions-menu"]').first()
    await menuBtnAfter.click()
    await page.locator('[data-testid="menu-item-participant-details"]').click()
    await expect(page.locator('.v-dialog')).toContainText('Negro Titanio')

    await page.locator('.v-dialog button:has-text("Cerrar")').click()
  })

  test('06. Cronograma de Cuotas del Participante', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    const menuBtn = page.locator('[data-testid="btn-participant-actions-menu"]').first()
    await menuBtn.click()

    const quotesItem = page.locator('[data-testid="menu-item-view-quotes"]')
    await quotesItem.waitFor({ state: 'visible', timeout: 5000 })
    await quotesItem.click()

    // Verificar modal de cronograma de cuotas
    const dialog = page.locator('.v-dialog')
    await expect(dialog).toContainText('Cronograma de Cuotas')
    await expect(dialog).toContainText('Total Cronograma')

    // Generar cuotas si el botón está visible
    const genBtn = page.locator('[data-testid="btn-generate-participant-quotes"]')
    if (await genBtn.isVisible()) {
      await genBtn.click()
      await page.waitForTimeout(1500)
    }

    const closeBtn = page.locator('.v-dialog [data-testid="modal-cancel-btn"], .v-dialog button:has-text("Cerrar")').first()
    await closeBtn.click()
    await page.waitForTimeout(500)
  })

  test('07. Emisión de Contrato del Participante', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    const menuBtn = page.locator('[data-testid="btn-participant-actions-menu"]').first()
    await menuBtn.click()

    const emitItem = page.locator('[data-testid="menu-item-emit-contract"]')
    await emitItem.waitFor({ state: 'visible', timeout: 5000 })
    await emitItem.click()

    // Verificar snackbar de respuesta (éxito o mensaje de negocio de contrato ya emitido / generado)
    const snackbar = page.locator('.v-snackbar')
    await expect(snackbar).toBeVisible({ timeout: 10000 })
  })

  test('08. Generar Cuotas del Grupo (Acción global)', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    const btnGenerate = page.locator('[data-testid="btn-generate-group-quotes"]')
    await btnGenerate.click()

    const snackbar = page.locator('.v-snackbar')
    await expect(snackbar).toBeVisible({ timeout: 10000 })
  })

  test('09. Ver Participantes Calificados (Modal)', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    const btnQualified = page.locator('[data-testid="btn-view-qualified"]')
    await btnQualified.click()

    const dialog = page.locator('.v-dialog')
    await expect(dialog).toContainText('Participantes Calificados para Adjudicación')

    const closeBtn = page.locator('.v-dialog button:has-text("Cerrar")')
    await closeBtn.click()
    await page.waitForTimeout(500)
  })

  test('10. Búsqueda y Filtros de Estado', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    // 1. Búsqueda por nombre "Carlos"
    const searchInput = page.locator('[data-testid="participant-search-input"] input')
    await searchInput.fill('Carlos')
    await page.waitForTimeout(1000)
    await page.waitForLoadState('networkidle')

    const tableBody = page.locator('[data-testid="participants-table"] tbody')
    await expect(tableBody).toContainText('Carlos')

    // Limpiar búsqueda
    await searchInput.fill('')
    await page.waitForTimeout(1000)

    // 2. Probar Filtros de Chips
    const chipEspera = page.locator('.v-chip:has-text("En Espera")')
    if (await chipEspera.isVisible()) {
      await chipEspera.click()
      await page.waitForTimeout(1000)
      await page.waitForLoadState('networkidle')
    }

    const chipTodos = page.locator('.v-chip:has-text("Todos")')
    if (await chipTodos.isVisible()) {
      await chipTodos.click()
      await page.waitForTimeout(1000)
      await page.waitForLoadState('networkidle')
    }

    // 3. Botón de recarga
    const refreshBtn = page.locator('[data-testid="btn-refresh-participants"]')
    await refreshBtn.click()
    await page.waitForTimeout(800)
  })

  test('11. Retiro / Eliminación de Participante 2', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    // Localizar menú de la fila de María
    const mariaRow = page.locator('[data-testid="participants-table"] tbody tr:has-text("María")')
    const menuBtn = mariaRow.locator('[data-testid="btn-participant-actions-menu"]')
    await menuBtn.click()

    // Clic en Eliminar
    const deleteItem = page.locator('[data-testid="menu-item-delete-participant"]')
    await deleteItem.waitFor({ state: 'visible', timeout: 5000 })
    await deleteItem.click()

    // Confirmación en modal
    const dialog = page.locator('.v-dialog')
    await expect(dialog).toContainText('Eliminar Participante')

    const confirmBtn = page.locator('.v-dialog [data-testid="modal-submit-btn"], .v-dialog button:has-text("Sí, Eliminar")').first()
    await confirmBtn.click()

    await page.waitForTimeout(1500)
    await page.waitForLoadState('networkidle')

    // Verificar notificación de éxito
    const snackbar = page.locator('.v-snackbar')
    await expect(snackbar).toBeVisible({ timeout: 10000 })
  })

  test('12. Botón Volver a la Lista de Grupos', async ({ page }) => {
    await loginAndEnsureBranch(page)
    await page.goto(`/financing/groups/${targetGroupId}/participants`)
    await page.waitForLoadState('networkidle')

    const backBtn = page.locator('[data-testid="btn-back-to-groups"]')
    await backBtn.click()

    await page.waitForURL((url) => url.pathname === '/financing/groups', { timeout: 10000 })
    await expect(page.locator('[data-testid="sam-groups-table"]')).toBeVisible()
  })
})
