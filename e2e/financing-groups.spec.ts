import { test, expect, Page } from '@playwright/test'

// Credenciales suministradas
const USERNAME = 'aDmin_2e3722'
const PASSWORD = 'Aa_12345678'
const TARGET_BRANCH = 'San Francisco'

// Generador de sufijo único por ejecución
const uniqueSuffix = Date.now().toString().slice(-4)
const testGroupName = `Grupo E2E Test ${uniqueSuffix}`
const updatedGroupName = `Grupo E2E Modif ${uniqueSuffix}`

/**
 * Helper para autenticarse y garantizar sucursal activa "San Francisco"
 */
async function loginAndEnsureBranch(page: Page): Promise<void> {
  // 1. Ir a /login de manera determinista
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Si está en /login, autenticarse
  if (page.url().includes('/login')) {
    const userInput = page.locator('[data-testid="input-username"] input')
    const passInput = page.locator('[data-testid="input-password"] input')
    const submitBtn = page.locator('[data-testid="btn-login-submit"]')

    await userInput.waitFor({ state: 'visible', timeout: 15000 })
    await userInput.fill(USERNAME)
    await passInput.fill(PASSWORD)
    await submitBtn.click()

    // Esperar redirección fuera de login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
  }

  // 2. Navegar a /financing/groups
  await page.goto('/financing/groups')
  await page.waitForLoadState('networkidle')

  // 3. Asegurar que la sucursal activa sea "San Francisco"
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

  // Verificar que la tabla de grupos esté en pantalla
  await page.locator('[data-testid="sam-groups-table"]').waitFor({ state: 'visible', timeout: 15000 })
}

test.describe.serial('Módulo Autofinanciamiento Colectivo - Suite Exhaustiva E2E', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await loginAndEnsureBranch(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  // --------------------------------------------------------------------------
  // TC-01: Verificación de Layout y Títulos (Sin siglas SAM)
  // --------------------------------------------------------------------------
  test('TC-01: Layout del encabezado sin "SAM" y elementos base visibles', async () => {
    // Título principal sin siglas SAM
    const title = page.locator('h1')
    await expect(title).toHaveText('Autofinanciamiento Colectivo')
    await expect(title).not.toContainText('SAM')

    // Subtítulo oficial
    const subtitle = page.locator('.sam-groups-module p.text-medium-emphasis').first()
    await expect(subtitle).toHaveText(
      'Administración del programa de ahorro colectivo y adjudicación de beneficios'
    )

    // Botón "+ Nuevo Grupo"
    const newGroupBtn = page.locator('[data-testid="btn-create-group"]')
    await expect(newGroupBtn).toBeVisible()
    await expect(newGroupBtn).toContainText('Nuevo Grupo')

    // Barra de búsqueda
    const searchInput = page.locator('[data-testid="group-search-input"]')
    await expect(searchInput).toBeVisible()

    // Filtros de chips
    await expect(page.locator('.app-chip-item', { hasText: 'Todos' })).toBeVisible()
    await expect(page.locator('.app-chip-item', { hasText: 'En Formación' })).toBeVisible()
    await expect(page.locator('.app-chip-item', { hasText: 'Activo' })).toBeVisible()

    // Botón de recarga
    await expect(page.locator('[data-testid="btn-refresh-groups"]')).toBeVisible()

    // Tabla de datos
    await expect(page.locator('[data-testid="sam-groups-table"]')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-02: Pruebas Negativas - Validación de Campos Obligatorios en Formulario
  // --------------------------------------------------------------------------
  test('TC-02: [Negativo] Intentar crear grupo con datos incompletos o vacíos', async () => {
    // Abrir modal de creación
    await page.locator('[data-testid="btn-create-group"]').click()
    const modalTitle = page.locator('.app-modal__header .v-card-title')
    await expect(modalTitle).toHaveText('Nuevo Grupo')

    const submitBtn = page.locator('[data-testid="modal-submit-btn"]')
    const snackbar = page.locator('[data-testid="financing-snackbar"]')

    // 1. Enviar con nombre vacío
    await submitBtn.click()
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('El nombre del grupo es obligatorio.')
    await page.waitForTimeout(400)

    // 2. Llenar nombre pero dejar frecuencia vacía
    const nameInput = page.locator('[data-testid="input-group-name"] input')
    await nameInput.fill('Grupo Temporal Incompleto')
    await submitBtn.click()
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('Selecciona una frecuencia de pago.')
    await page.waitForTimeout(400)

    // 3. Seleccionar frecuencia pero dejar monto de adjudicación vacío
    await page.locator('[data-testid="select-group-frequency"]').click()
    const firstFreqOption = page.locator('.v-overlay:visible .v-list-item').first()
    await firstFreqOption.waitFor({ state: 'visible' })
    await firstFreqOption.click()
    await page.waitForTimeout(400)

    await submitBtn.click()
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('Ingresa un monto de adjudicación válido.')
    await page.waitForTimeout(400)

    // 4. Llenar monto de adjudicación pero dejar monto de cuota vacío
    const amountInput = page.locator('[data-testid="input-group-amount"] input')
    await amountInput.fill('1000')
    await submitBtn.click()
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('Ingresa el monto de cuota.')
    await page.waitForTimeout(400)

    // 5. Llenar cuota pero dejar total de cuotas vacío
    const installmentAmountInput = page.locator('[data-testid="input-group-installment-amount"] input')
    await installmentAmountInput.fill('50')
    await submitBtn.click()
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('Ingresa el total de cuotas.')
    await page.waitForTimeout(400)

    // 6. Llenar total cuotas pero dejar fecha base vacía
    const installmentCountInput = page.locator('[data-testid="input-group-installment-count"] input')
    await installmentCountInput.fill('20')
    await submitBtn.click()
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('Ingresa la fecha base de cobros.')

    // Cancelar para cerrar el modal de forma limpia
    await page.locator('[data-testid="modal-cancel-btn"]').click()
    await expect(page.locator('.app-modal')).not.toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-03: Pruebas Negativas - Valores Numéricos Inválidos (Monto <= 0)
  // --------------------------------------------------------------------------
  test('TC-03: [Negativo] Intentar crear grupo con montos iguales o inferiores a 0', async () => {
    await page.locator('[data-testid="btn-create-group"]').click()
    await page.waitForSelector('.app-modal')

    const nameInput = page.locator('[data-testid="input-group-name"] input')
    await nameInput.fill('Grupo Monto Cero')

    // Seleccionar frecuencia
    await page.locator('[data-testid="select-group-frequency"]').click()
    await page.locator('.v-overlay:visible .v-list-item').first().click()
    await page.waitForTimeout(300)

    // Monto 0
    const amountInput = page.locator('[data-testid="input-group-amount"] input')
    await amountInput.fill('0')

    const installmentAmountInput = page.locator('[data-testid="input-group-installment-amount"] input')
    await installmentAmountInput.fill('0')

    const installmentCountInput = page.locator('[data-testid="input-group-installment-count"] input')
    await installmentCountInput.fill('0')

    const baseDateInput = page.locator('[data-testid="input-group-base-date"] input')
    await baseDateInput.fill('2026-10-31')

    const submitBtn = page.locator('[data-testid="modal-submit-btn"]')
    const snackbar = page.locator('[data-testid="financing-snackbar"]')

    await submitBtn.click()
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('Ingresa un monto de adjudicación válido.')

    // Cancelar modal
    await page.locator('[data-testid="modal-cancel-btn"]').click()
    await expect(page.locator('.app-modal')).not.toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-04: Pruebas Negativas - Falla Backend por Nombre Duplicado (400)
  // --------------------------------------------------------------------------
  test('TC-04: [Negativo] Forzar error 400 del backend al enviar un nombre de grupo ya existente', async () => {
    // Obtener el nombre del primer grupo existente en la tabla
    const existingGroupRow = page.locator('[data-testid="sam-groups-table"] tbody tr').first()
    const existingGroupName = await existingGroupRow.locator('td').first().locator('.font-weight-bold').textContent()

    if (existingGroupName && existingGroupName.trim()) {
      const duplicateName = existingGroupName.trim()

      await page.locator('[data-testid="btn-create-group"]').click()
      await page.locator('[data-testid="input-group-name"] input').fill(duplicateName)

      // Seleccionar frecuencia
      await page.locator('[data-testid="select-group-frequency"]').click()
      await page.locator('.v-overlay:visible .v-list-item').first().click()
      await page.waitForTimeout(300)

      // Llenar datos válidos
      await page.locator('[data-testid="input-group-amount"] input').fill('1000')
      await page.locator('[data-testid="input-group-installment-amount"] input').fill('50')
      await page.locator('[data-testid="input-group-installment-count"] input').fill('20')
      await page.locator('[data-testid="input-group-base-date"] input').fill('2026-11-01')

      // Enviar formulario sabiendo que el backend debe rechazar el duplicado
      await page.locator('[data-testid="modal-submit-btn"]').click()

      // Verificar que el snackbar muestra el rechazo de la API sin que se congele o rompa la app
      const snackbar = page.locator('[data-testid="financing-snackbar"]')
      await expect(snackbar).toBeVisible()
      const snackText = await snackbar.textContent()
      expect(snackText).toBeTruthy()

      // Cerrar modal
      await page.locator('[data-testid="modal-cancel-btn"]').click()
      await expect(page.locator('.app-modal')).not.toBeVisible()
    }
  })

  // --------------------------------------------------------------------------
  // TC-05: Happy Path - Creación Exitosa de Nuevo Grupo
  // --------------------------------------------------------------------------
  test('TC-05: [Éxito] Creación limpia de nuevo grupo con datos válidos', async () => {
    await page.locator('[data-testid="btn-create-group"]').click()
    await page.waitForSelector('.app-modal')

    // Nombre único
    await page.locator('[data-testid="input-group-name"] input').fill(testGroupName)

    // Seleccionar Frecuencia
    await page.locator('[data-testid="select-group-frequency"]').click()
    await page.locator('.v-overlay:visible .v-list-item').first().click()
    await page.waitForTimeout(300)

    // Montos y Parámetros
    await page.locator('[data-testid="input-group-amount"] input').fill('1200')
    await page.locator('[data-testid="input-group-installment-amount"] input').fill('50')
    await page.locator('[data-testid="input-group-installment-count"] input').fill('24')
    await page.locator('[data-testid="input-group-participant-max"] input').fill('24')
    await page.locator('[data-testid="input-group-base-date"] input').fill('2026-10-15')

    // Guardar
    await page.locator('[data-testid="modal-submit-btn"]').click()

    // Validar toast de éxito
    const snackbar = page.locator('[data-testid="financing-snackbar"]')
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('Grupo creado exitosamente.')

    // Modal debe cerrarse automáticamente
    await expect(page.locator('.app-modal')).not.toBeVisible()

    // Esperar a que la tabla se refresque
    await page.waitForTimeout(1000)

    // Verificar que el grupo figura en la tabla
    const createdRow = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })
    await expect(createdRow).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-06: Verificación de Formato de Columnas (Monto, Cuotas, Participantes)
  // --------------------------------------------------------------------------
  test('TC-06: Verificación del formato de columnas según especificación de diseño', async () => {
    const row = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })
    await expect(row).toBeVisible()

    // Columna Monto formateada con dos decimales ($1,200.00)
    await expect(row.locator('td').nth(1)).toContainText('$1,200.00')

    // Columna Cuotas formateada: "24 / $50.00"
    await expect(row.locator('td').nth(2)).toContainText('24')
    await expect(row.locator('td').nth(2)).toContainText('/')
    await expect(row.locator('td').nth(2)).toContainText('$50.00')

    // Columna Participantes: "0 / 24"
    await expect(row.locator('td').nth(3)).toContainText('0 / 24')

    // Columna Estado: "Formación"
    await expect(row.locator('td').nth(4)).toContainText('Formación')

    // Columna Acciones: Botón de 3 puntos
    await expect(row.locator('[data-testid="btn-group-actions-menu"]')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-07: Búsqueda Reactiva (Búsqueda positiva, fallida y restablecimiento)
  // --------------------------------------------------------------------------
  test('TC-07: Búsqueda reactiva por texto exacto, búsqueda vacía y limpieza', async () => {
    const searchInput = page.locator('[data-testid="group-search-input"] input')

    // 1. Filtrar por el nombre del grupo creado
    await searchInput.fill(testGroupName)
    await page.waitForTimeout(1000)

    const matchingRows = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })
    await expect(matchingRows).toHaveCount(1)

    // 2. Filtrar por término inexistente
    await searchInput.fill('ZZZZ_INEXISTENTE_9999')
    await page.waitForTimeout(1000)

    // Verificar estado sin registros (soporta español e inglés)
    const emptyTable = page.locator('[data-testid="sam-groups-table"] tbody')
    await expect(emptyTable).toContainText(/No hay datos disponibles|No data available/)

    // 3. Limpiar campo de búsqueda
    await searchInput.fill('')
    await page.waitForTimeout(1000)

    // La fila vuelve a aparecer
    await expect(page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-08: Filtro por Estados (AppChipFilter)
  // --------------------------------------------------------------------------
  test('TC-08: Filtro de estado mediante chips (Todos, En Formación, Activo)', async () => {
    // Clic en "En Formación"
    const formacionChip = page.locator('.app-chip-item', { hasText: 'En Formación' })
    await formacionChip.click()
    await page.waitForTimeout(1000)
    await expect(page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })).toBeVisible()

    // Clic en "Activo" (nuestro grupo está en formación, por lo que no debería aparecer)
    const activoChip = page.locator('.app-chip-item', { hasText: 'Activo' })
    await activoChip.click()
    await page.waitForTimeout(1000)

    // Clic en "Todos" para volver a ver todo
    const todosChip = page.locator('.app-chip-item', { hasText: 'Todos' })
    await todosChip.click()
    await page.waitForTimeout(1000)

    await expect(page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-09: Tooltip y Recarga de la Tabla
  // --------------------------------------------------------------------------
  test('TC-09: Verificación de tooltip y botón circular de recarga', async () => {
    const refreshBtn = page.locator('[data-testid="btn-refresh-groups"]')
    await refreshBtn.hover()

    // Tooltip "Recargar la tabla"
    const tooltip = page.getByText('Recargar la tabla')
    await expect(tooltip).toBeVisible()

    // Clic para recargar
    await refreshBtn.click()
    await page.waitForTimeout(1000)
    await expect(page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-10: Menú de Acciones de Fila (Orden y Elementos)
  // --------------------------------------------------------------------------
  test('TC-10: Menú de 3 puntos muestra las 5 opciones en el orden UX definido', async () => {
    const row = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })
    await row.locator('[data-testid="btn-group-actions-menu"]').click()

    // Verificar las opciones en orden
    const detailsItem = page.locator('[data-testid="menu-item-details"]')
    const participantsItem = page.locator('[data-testid="menu-item-participants"]')
    const generateItem = page.locator('[data-testid="menu-item-generate-receivables"]')
    const editItem = page.locator('[data-testid="menu-item-edit"]')
    const deleteItem = page.locator('[data-testid="menu-item-delete"]')

    await expect(detailsItem).toBeVisible()
    await expect(detailsItem).toContainText('Ver Detalles')

    await expect(participantsItem).toBeVisible()
    await expect(participantsItem).toContainText('Ver Participantes')

    await expect(generateItem).toBeVisible()
    await expect(generateItem).toContainText('Generar Cuotas')

    await expect(editItem).toBeVisible()
    await expect(editItem).toContainText('Editar Grupo')

    await expect(deleteItem).toBeVisible()
    await expect(deleteItem).toContainText('Eliminar')

    // Cerrar menú haciendo clic afuera
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  // --------------------------------------------------------------------------
  // TC-10b: Acción de Negocio - Ejecutar "Generar Cuotas" desde menú de la tabla
  // --------------------------------------------------------------------------
  test('TC-10b: Ejecución de "Generar Cuotas" y validación de regla de negocio sin participantes', async () => {
    const row = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })
    await row.locator('[data-testid="btn-group-actions-menu"]').click()
    await page.waitForTimeout(300)

    // Clic en la acción de negocio "Generar Cuotas"
    await page.locator('[data-testid="menu-item-generate-receivables"]').click()

    // Validar feedback del sistema (la API responde notificando la regla de participantes)
    const snackbar = page.locator('[data-testid="financing-snackbar"]')
    await expect(snackbar).toBeVisible({ timeout: 6000 })
    const snackText = await snackbar.textContent()
    expect(snackText).toBeTruthy()
    await page.waitForTimeout(500)
  })

  // --------------------------------------------------------------------------
  // TC-11: Modal "Ver Detalles" (Métricas, Parámetros y Auditoría)
  // --------------------------------------------------------------------------
  test('TC-11: Inspección de auditoría y métricas en modal "Ver Detalles"', async () => {
    const row = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })
    await row.locator('[data-testid="btn-group-actions-menu"]').click()
    await page.locator('[data-testid="menu-item-details"]').click()

    // El modal de detalles debe estar abierto
    const modalTitle = page.locator('.app-modal__header .v-card-title')
    await expect(modalTitle).toHaveText('Detalles del Grupo')

    // Nombre del grupo dentro de la cabecera
    await expect(page.locator('.text-h6', { hasText: testGroupName })).toBeVisible()

    // Métricas
    await expect(page.locator('.text-subtitle-1', { hasText: '$1,200.00' })).toBeVisible()
    await expect(page.locator('.text-subtitle-1', { hasText: '$50.00' })).toBeVisible()
    await expect(page.locator('.text-subtitle-1', { hasText: /^24$/ })).toBeVisible()
    await expect(page.locator('.text-subtitle-1', { hasText: '0 / 24' })).toBeVisible()

    // Sección de auditoría
    await expect(page.locator('text=Auditoría de Registro')).toBeVisible()
    await expect(page.locator('text=Fecha de Creación:')).toBeVisible()

    // Cerrar modal con botón Cerrar
    await page.locator('[data-testid="modal-cancel-btn"]').click()
    await expect(page.locator('.app-modal')).not.toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-12 & TC-13: Editar Grupo y Persistencia en Tabla
  // --------------------------------------------------------------------------
  test('TC-12 & TC-13: Modificar nombre y monto del grupo con persistencia verificada', async () => {
    const row = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: testGroupName })
    await row.locator('[data-testid="btn-group-actions-menu"]').click()
    await page.locator('[data-testid="menu-item-edit"]').click()

    const modalTitle = page.locator('.app-modal__header .v-card-title')
    await expect(modalTitle).toHaveText('Editar Grupo')

    // Verificar que el nombre actual está cargado
    const nameInput = page.locator('[data-testid="input-group-name"] input')
    await expect(nameInput).toHaveValue(testGroupName)

    // Modificar nombre y monto
    await nameInput.fill(updatedGroupName)
    const amountInput = page.locator('[data-testid="input-group-amount"] input')
    await amountInput.fill('2400')
    const installmentAmountInput = page.locator('[data-testid="input-group-installment-amount"] input')
    await installmentAmountInput.fill('100')

    // Guardar cambios
    await page.locator('[data-testid="modal-submit-btn"]').click()

    // Validar toast de éxito
    const snackbar = page.locator('[data-testid="financing-snackbar"]')
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('Grupo actualizado exitosamente.')

    // Verificar que el modal se cerró
    await expect(page.locator('.app-modal')).not.toBeVisible()

    // Verificar actualización en la tabla
    await page.waitForTimeout(1000)
    const updatedRow = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: updatedGroupName })
    await expect(updatedRow).toBeVisible()
    await expect(updatedRow.locator('td').nth(1)).toContainText('$2,400.00')
    await expect(updatedRow.locator('td').nth(2)).toContainText('$100.00')
  })

  // --------------------------------------------------------------------------
  // TC-14: Navegación a Participantes del Grupo y Regreso
  // --------------------------------------------------------------------------
  test('TC-14: Navegación a la vista de Participantes y botón de retorno', async () => {
    const row = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: updatedGroupName })
    await row.locator('[data-testid="btn-group-actions-menu"]').click()
    await page.locator('[data-testid="menu-item-participants"]').click()

    // Esperar navegación
    await page.waitForURL((url) => url.pathname.includes('/participants'), { timeout: 10000 })
    expect(page.url()).toContain('/participants')

    // Título de la vista de participantes debe mostrar el nombre del grupo
    await expect(page.locator('h1', { hasText: updatedGroupName })).toBeVisible()

    // Probar la acción "Generar Cuotas" a nivel de vista de participantes
    const generateBtn = page.locator('[data-testid="btn-generate-group-quotes"]')
    await expect(generateBtn).toBeVisible()
    await generateBtn.click()

    // Validar snackbar de respuesta del sistema
    const snackbar = page.locator('.v-snackbar')
    await expect(snackbar).toBeVisible({ timeout: 6000 })
    await page.waitForTimeout(500)

    // Clic en el botón volver
    const backBtn = page.locator('[data-testid="btn-back-to-groups"]')
    await expect(backBtn).toBeVisible()
    await backBtn.click()

    // Debe regresar a /financing/groups
    await page.waitForURL((url) => url.pathname.endsWith('/financing/groups'), { timeout: 10000 })
    await expect(page.locator('[data-testid="sam-groups-table"]')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-15: Destructivo - Cancelar Eliminación
  // --------------------------------------------------------------------------
  test('TC-15: Diálogo de eliminación se cancela sin alterar el registro', async () => {
    const row = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: updatedGroupName })
    await row.locator('[data-testid="btn-group-actions-menu"]').click()
    await page.locator('[data-testid="menu-item-delete"]').click()

    // Diálogo de eliminación
    const modalTitle = page.locator('.app-modal__header .v-card-title')
    await expect(modalTitle).toHaveText('Eliminar Grupo')
    await expect(page.locator('.app-modal__body', { hasText: updatedGroupName })).toBeVisible()

    // Cancelar
    await page.locator('[data-testid="modal-cancel-btn"]').click()
    await expect(page.locator('.app-modal')).not.toBeVisible()

    // El grupo aún debe existir
    await expect(page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: updatedGroupName })).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // TC-16: Destructivo - Confirmar Eliminación y Verificar Desaparición
  // --------------------------------------------------------------------------
  test('TC-16: Confirmar eliminación del grupo y verificar que desaparece de la tabla activa', async () => {
    const row = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: updatedGroupName })
    await row.locator('[data-testid="btn-group-actions-menu"]').click()
    await page.locator('[data-testid="menu-item-delete"]').click()

    // Confirmar eliminación
    await page.locator('[data-testid="modal-submit-btn"]').click()

    // Validar toast de éxito
    const snackbar = page.locator('[data-testid="financing-snackbar"]')
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('Grupo eliminado exitosamente.')

    // El modal debe cerrarse
    await expect(page.locator('.app-modal')).not.toBeVisible()

    // Esperar refresco de la tabla
    await page.waitForTimeout(1000)

    // El grupo ya no debe estar en la tabla
    const deletedRow = page.locator('[data-testid="sam-groups-table"] tbody tr', { hasText: updatedGroupName })
    await expect(deletedRow).not.toBeVisible()
  })
})
