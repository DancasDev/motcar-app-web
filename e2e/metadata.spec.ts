import { test, expect } from '@playwright/test'

test.describe('Motor de Metadatos y Validaciones Exhaustivas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-metadata')
    await page.locator('#full-metadata-renderer').waitFor({ state: 'visible' })
  })

  test('1. Renderiza correctamente las 18 combinaciones de campos de metadatos', async ({ page }) => {
    const fullContainer = page.locator('#full-metadata-renderer')
    await expect(fullContainer).toBeVisible()

    // 1. Textarea
    await expect(fullContainer.getByLabel('Observaciones')).toBeVisible()

    // 2. Archivo Único
    await expect(fullContainer.getByText('Cédula o Pasaporte (Archivo Único)')).toBeVisible()

    // 3. Archivo Múltiple
    await expect(fullContainer.getByText('Comprobantes de Ingreso (Múltiples URLs)')).toBeVisible()

    // 4. Select individual y múltiple
    await expect(fullContainer.getByRole('combobox', { name: 'Tipo de Documento' })).toBeVisible()
    await expect(fullContainer.getByRole('combobox', { name: 'Intereses (Múltiple)' })).toBeVisible()

    // 5. Radio
    await expect(fullContainer.getByText('Género')).toBeVisible()
    await expect(fullContainer.getByLabel('Masculino')).toBeVisible()

    // 6. Checkbox
    await expect(fullContainer.getByLabel('Acepto los términos y condiciones')).toBeVisible()

    // 7. Número y Rango
    await expect(fullContainer.getByLabel('Edad')).toBeVisible()
    await expect(fullContainer.getByLabel('Presupuesto')).toBeVisible()

    // 8. Fechas y Horas (date, time, datetime_local, month, week)
    await expect(fullContainer.getByLabel('Fecha de Nacimiento')).toBeVisible()
    await expect(fullContainer.getByLabel('Hora Preferida')).toBeVisible()
    await expect(fullContainer.getByLabel('Cita Programada')).toBeVisible()
    await expect(fullContainer.getByLabel('Mes de Inicio')).toBeVisible()
    await expect(fullContainer.getByLabel('Semana de Entrega')).toBeVisible()

    // 9. Color
    await expect(fullContainer.getByLabel('Color del Vehículo')).toBeVisible()

    // 10. Inputs de texto estándar (text, email, tel, password, url)
    await expect(fullContainer.getByLabel('Nombre Completo')).toBeVisible()
    await expect(fullContainer.getByLabel('Correo Electrónico')).toBeVisible()
    await expect(fullContainer.getByLabel('Teléfono de Contacto')).toBeVisible()
    await expect(fullContainer.getByLabel('Clave Secreta')).toBeVisible()
    await expect(fullContainer.getByLabel('Sitio Web')).toBeVisible()
  })

  test('2. Manejo interactivo de múltiples archivos (Array de URLs)', async ({ page }) => {
    const multiContainer = page.locator('#panel-file-multi')
    await expect(multiContainer).toBeVisible()

    // Verificar cantidad inicial
    const countLabel = page.locator('#multi-files-count')
    await expect(countLabel).toHaveText('2')

    // Verificar que los ítems están presentes
    await expect(multiContainer.locator('.multi-file-name').filter({ hasText: 'contrato1.pdf' })).toBeVisible()
    await expect(multiContainer.locator('.multi-file-name').filter({ hasText: 'garantia.jpg' })).toBeVisible()

    // Eliminar el primer archivo
    const removeButtons = multiContainer.locator('.btn-remove-multi-file')
    await expect(removeButtons).toHaveCount(2)
    await removeButtons.first().click()

    // Verificar que ahora queda 1 archivo
    await expect(countLabel).toHaveText('1')
    await expect(multiContainer.locator('.multi-file-name').filter({ hasText: 'contrato1.pdf' })).toHaveCount(0)
    await expect(multiContainer.locator('.multi-file-name').filter({ hasText: 'garantia.jpg' })).toBeVisible()

    // Eliminar el segundo archivo
    await multiContainer.locator('.btn-remove-multi-file').first().click()
    await expect(countLabel).toHaveText('0')

    // Verificar que el dropzone permanece activo para subir más archivos
    await expect(multiContainer.locator('.upload-dropzone')).toBeVisible()
    await expect(page.locator('#multi-files-val')).toHaveText('[]')
  })

  test('3. Manejo interactivo de archivo individual (preview, delete y reemplazo)', async ({ page }) => {
    const singleContainer = page.locator('#panel-file-single')
    await expect(singleContainer).toBeVisible()

    // Verificar preview inicial del archivo individual
    await expect(singleContainer.locator('.file-preview-card')).toBeVisible()
    await expect(singleContainer.locator('.file-name-label')).toHaveText('foto_perfil.png')
    await expect(page.locator('#single-file-val')).toContainText('foto_perfil.png')

    // Eliminar archivo individual
    await singleContainer.locator('.btn-delete-file').click()

    // Preview debe desaparecer y dar paso al dropzone
    await expect(singleContainer.locator('.file-preview-card')).not.toBeVisible()
    await expect(singleContainer.locator('.upload-dropzone')).toBeVisible()
    await expect(page.locator('#single-file-val')).toHaveText('null')
  })

  test('4. Validación en formulario v-form (campos obligatorios y arrays requeridos)', async ({ page }) => {
    const form = page.locator('#test-vform')
    await expect(form).toBeVisible()

    // 1. Ejecutar validación con campos vacíos
    await page.locator('#btn-validate-form').click()

    // Debe fallar la validación
    const statusBadge = page.locator('#validation-status-badge')
    await expect(statusBadge).toHaveText('Estado: failed')

    // Verificar que se muestran los mensajes de error de Vuetify
    await expect(form.getByText('Nombre Requerido es obligatorio.')).toBeVisible()
    await expect(form.getByText('Foto de Cédula (Obligatoria) es obligatorio.')).toBeVisible()
    await expect(form.getByText('Archivos Adjuntos (Obligatorios) es obligatorio.')).toBeVisible()

    // 2. Llenar con datos válidos
    await page.locator('#btn-fill-valid').click()

    // Revalidar el formulario
    await page.locator('#btn-validate-form').click()

    // Ahora la validación debe pasar
    await expect(statusBadge).toHaveText('Estado: success')
    await expect(form.getByText('Nombre Requerido es obligatorio.')).not.toBeVisible()
    await expect(form.getByText('Foto de Cédula (Obligatoria) es obligatorio.')).not.toBeVisible()
    await expect(form.getByText('Archivos Adjuntos (Obligatorios) es obligatorio.')).not.toBeVisible()
  })

  test('5. Modos de visualización: sections, cards y flat', async ({ page }) => {
    const renderer = page.locator('#full-metadata-renderer')

    // Modo por defecto: sections
    await expect(renderer).toHaveClass(/display-mode-sections/)
    await expect(renderer.locator('.group-header').first()).toBeVisible()

    // Cambiar a modo Cards
    await page.locator('#btn-mode-cards').click()
    await expect(renderer).toHaveClass(/display-mode-cards/)
    await expect(renderer.locator('.metadata-group-card').first()).toBeVisible()

    // Cambiar a modo Flat
    await page.locator('#btn-mode-flat').click()
    await expect(renderer).toHaveClass(/display-mode-flat/)
    await expect(renderer.locator('.group-header')).toHaveCount(0)

    // Volver a sections
    await page.locator('#btn-mode-sections').click()
    await expect(renderer).toHaveClass(/display-mode-sections/)
    await expect(renderer.locator('.group-header').first()).toBeVisible()
  })

  test('6. Batería de validaciones complejas: detecta errores en email, rangos, regex, fechas, listas, JSON y array de URLs', async ({ page }) => {
    const combosForm = page.locator('#combos-vform')
    await expect(combosForm).toBeVisible()

    // 1. Llenar con datos inválidos en todas las categorías
    await page.locator('#btn-fill-invalid-combos').click()

    // 2. Disparar validación
    await page.locator('#btn-validate-combos').click()

    // 3. El formulario debe fallar
    const badge = page.locator('#combos-status-badge')
    await expect(badge).toHaveText('Estado: failed')

    // 4. Verificar errores en pantalla para cada regla
    await expect(combosForm.getByText('El correo electrónico no es válido.')).toBeVisible()
    await expect(combosForm.getByText('Rango Numérico (10 a 100, entero) debe ser mayor o igual que 10.')).toBeVisible()
    await expect(combosForm.getByText('Longitud (3 a 8 caracteres) debe tener al menos 3 caracteres.')).toBeVisible()
    await expect(combosForm.getByText('Patrón Placa (ABC-123) tiene un formato no válido.')).toBeVisible()
    await expect(combosForm.getByText('Estado (ACTIVO o INACTIVO) debe ser uno de: ACTIVO, INACTIVO.')).toBeVisible()
    await expect(combosForm.getByText('Fecha Posterior a 2026-01-01 debe ser posterior a 2026-01-01.')).toBeVisible()
    await expect(combosForm.getByText('Solo Letras (alpha) solo debe contener letras.')).toBeVisible()
    await expect(combosForm.getByText('JSON Válido (valid_json) debe ser un JSON válido.')).toBeVisible()
    await expect(combosForm.getByText('Cada archivo debe ser una URL válida.')).toBeVisible()
  })

  test('7. Batería de validaciones complejas: aprueba exitosamente cuando los valores son válidos', async ({ page }) => {
    const combosForm = page.locator('#combos-vform')
    await expect(combosForm).toBeVisible()

    // 1. Llenar con datos válidos
    await page.locator('#btn-fill-valid-combos').click()

    // 2. Disparar validación
    await page.locator('#btn-validate-combos').click()

    // 3. El formulario debe aprobar con éxito
    const badge = page.locator('#combos-status-badge')
    await expect(badge).toHaveText('Estado: success')

    // 4. Verificar que no queda ningún campo en estado de error ni mensajes de error activos
    await expect(combosForm.locator('.v-input--error')).toHaveCount(0)
    await expect(combosForm.locator('.v-messages__message')).toHaveCount(0)
  })
})
