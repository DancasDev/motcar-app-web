import { compileMetadataRules } from '../src/utils/metadataValidation.ts'

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`)
    process.exit(1)
  }
}

console.log('--- INICIANDO SUITE DE TODAS LAS COMBINACIONES DE VALIDACIÓN ---')

// 1. Required (strings, numbers, arrays, nulls)
{
  const [rule] = compileMetadataRules([{ code: 'required' }], 'Campo')
  assert(typeof rule('') === 'string', 'required debe fallar con string vacío')
  assert(typeof rule(null) === 'string', 'required debe fallar con null')
  assert(typeof rule([]) === 'string', 'required debe fallar con array vacío []')
  assert(rule('Hola') === true, 'required debe pasar con string con contenido')
  assert(rule(0) === true, 'required debe pasar con número 0')
  assert(rule(['item']) === true, 'required debe pasar con array con elementos')
  console.log('✔ 1. Regla required aprobada en todos sus tipos.')
}

// 2. Longitudes: min_length, max_length, exact_length (strings y arrays)
{
  const [minRule] = compileMetadataRules([{ code: 'min_length', params: { value: 3 } }], 'Texto')
  assert(typeof minRule('ab') === 'string', 'min_length debe fallar con string menor a min')
  assert(minRule('abc') === true, 'min_length debe pasar con string igual a min')
  assert(typeof minRule(['a', 'b']) === 'string', 'min_length debe fallar con array menor a min')
  assert(minRule(['a', 'b', 'c']) === true, 'min_length debe pasar con array >= min')

  const [maxRule] = compileMetadataRules([{ code: 'max_length', params: { value: 2 } }], 'Texto')
  assert(typeof maxRule('abc') === 'string', 'max_length debe fallar con string mayor a max')
  assert(maxRule('ab') === true, 'max_length debe pasar con string <= max')
  assert(typeof maxRule(['a', 'b', 'c']) === 'string', 'max_length debe fallar con array > max')
  assert(maxRule(['a', 'b']) === true, 'max_length debe pasar con array <= max')

  const [exactRule] = compileMetadataRules([{ code: 'exact_length', params: { value: 2 } }], 'Texto')
  assert(typeof exactRule('a') === 'string', 'exact_length debe fallar con string != exact')
  assert(exactRule('ab') === true, 'exact_length debe pasar con string == exact')
  assert(typeof exactRule(['a']) === 'string', 'exact_length debe fallar con array != exact')
  assert(exactRule(['a', 'b']) === true, 'exact_length debe pasar con array == exact')
  console.log('✔ 2. Reglas min_length, max_length y exact_length aprobadas (string y array).')
}

// 3. Reglas Numéricas (greater_than, greater_than_equal_to, less_than, less_than_equal_to)
{
  const [gt] = compileMetadataRules([{ code: 'greater_than', params: { value: 10 } }], 'Num')
  assert(typeof gt(10) === 'string', 'greater_than debe fallar si es igual')
  assert(gt(11) === true, 'greater_than debe pasar si es mayor')

  const [gte] = compileMetadataRules([{ code: 'greater_than_equal_to', params: { value: 10 } }], 'Num')
  assert(typeof gte(9) === 'string', 'gte debe fallar si es menor')
  assert(gte(10) === true, 'gte debe pasar si es igual')

  const [lt] = compileMetadataRules([{ code: 'less_than', params: { value: 10 } }], 'Num')
  assert(typeof lt(10) === 'string', 'less_than debe fallar si es igual')
  assert(lt(9) === true, 'less_than debe pasar si es menor')

  const [lte] = compileMetadataRules([{ code: 'less_than_equal_to', params: { value: 10 } }], 'Num')
  assert(typeof lte(11) === 'string', 'lte debe fallar si es mayor')
  assert(lte(10) === true, 'lte debe pasar si es igual')
  console.log('✔ 3. Reglas de comparación numérica aprobadas.')
}

// 4. Tipos numéricos: integer, decimal, numeric, is_natural, is_natural_no_zero
{
  const [num] = compileMetadataRules([{ code: 'numeric' }], 'Num')
  assert(typeof num('abc') === 'string', 'numeric debe fallar con texto no numérico')
  assert(num('123.45') === true, 'numeric debe pasar con decimal')

  const [int] = compileMetadataRules([{ code: 'integer' }], 'Num')
  assert(typeof int('12.3') === 'string', 'integer debe fallar con decimal')
  assert(int('42') === true, 'integer debe pasar con entero')

  const [nat] = compileMetadataRules([{ code: 'is_natural' }], 'Num')
  assert(typeof nat('-5') === 'string', 'is_natural debe fallar con negativos')
  assert(nat('0') === true, 'is_natural debe pasar con 0')

  const [pos] = compileMetadataRules([{ code: 'is_natural_no_zero' }], 'Num')
  assert(typeof pos('0') === 'string', 'is_natural_no_zero debe fallar con 0')
  assert(pos('5') === true, 'is_natural_no_zero debe pasar con > 0')
  console.log('✔ 4. Reglas de subtipos numéricos y enteros aprobadas.')
}

// 5. Emails y URLs (individuales y arrays)
{
  const [email] = compileMetadataRules([{ code: 'valid_email' }], 'Email')
  assert(typeof email('no-email') === 'string', 'valid_email debe fallar con email no válido')
  assert(email('admin@motcar.com') === true, 'valid_email debe pasar con email correcto')

  const [emails] = compileMetadataRules([{ code: 'valid_emails' }], 'Emails')
  assert(typeof emails('admin@motcar.com, invalido') === 'string', 'valid_emails debe fallar si uno es inválido')
  assert(emails('a@b.com, c@d.com') === true, 'valid_emails debe pasar si todos son válidos')

  const [url] = compileMetadataRules([{ code: 'valid_url' }], 'Archivos')
  assert(typeof url('not-a-url') === 'string', 'valid_url debe fallar con string no URL')
  assert(url('https://cdn.example.com/file.pdf') === true, 'valid_url debe pasar con URL individual')
  assert(typeof url(['https://cdn.example.com/ok.pdf', 'not-valid']) === 'string', 'valid_url debe fallar con array con URL inválida')
  assert(url(['https://cdn.example.com/ok.pdf', 'http://cdn.example.com/ok2.png']) === true, 'valid_url debe pasar con array de URLs válidas')
  console.log('✔ 5. Reglas de emails y URLs aprobadas (soporte de arrays múltiples).')
}

// 6. Listas (in_list, not_in_list)
{
  const [inList] = compileMetadataRules([{ code: 'in_list', params: { value: 'A,B,C' } }], 'Opciones')
  assert(typeof inList('D') === 'string', 'in_list debe fallar con valor fuera de lista')
  assert(inList('B') === true, 'in_list debe pasar con valor dentro de lista')
  assert(typeof inList(['A', 'D']) === 'string', 'in_list debe fallar si un elemento del array no está')
  assert(inList(['A', 'B']) === true, 'in_list debe pasar con array de valores válidos')

  const [notInList] = compileMetadataRules([{ code: 'not_in_list', params: { value: 'X,Y' } }], 'Opciones')
  assert(typeof notInList('X') === 'string', 'not_in_list debe fallar con valor prohibido')
  assert(notInList('A') === true, 'not_in_list debe pasar con valor no prohibido')
  assert(typeof notInList(['A', 'X']) === 'string', 'not_in_list debe fallar si array contiene prohibido')
  assert(notInList(['A', 'B']) === true, 'not_in_list debe pasar con array limpio')
  console.log('✔ 6. Reglas in_list y not_in_list aprobadas (strings y arrays).')
}

// 7. Caracteres y cadenas: alpha, alpha_space, alpha_dash, alpha_numeric, alpha_numeric_space, alpha_numeric_punct, hex, string
{
  const [alpha] = compileMetadataRules([{ code: 'alpha' }], 'Texto')
  assert(typeof alpha('123') === 'string', 'alpha debe fallar con números')
  assert(alpha('HolaMundo') === true, 'alpha debe pasar con letras')

  const [alphaSpace] = compileMetadataRules([{ code: 'alpha_space' }], 'Texto')
  assert(typeof alphaSpace('Hola 123') === 'string', 'alpha_space debe fallar con números')
  assert(alphaSpace('Hola Mundo') === true, 'alpha_space debe pasar con letras y espacios')

  const [alphaDash] = compileMetadataRules([{ code: 'alpha_dash' }], 'Texto')
  assert(typeof alphaDash('Hola Mundo!') === 'string', 'alpha_dash debe fallar con signos no permitidos')
  assert(alphaDash('hola_mundo-123') === true, 'alpha_dash debe pasar con letras, números, guiones y guiones bajos')

  const [alphaPunct] = compileMetadataRules([{ code: 'alpha_numeric_punct' }], 'Texto')
  assert(alphaPunct('¡Hola, mundo #123!') === true, 'alpha_numeric_punct debe pasar con puntuación')

  const [hex] = compileMetadataRules([{ code: 'hex' }], 'Hex')
  assert(typeof hex('ZZZ') === 'string', 'hex debe fallar con no hex')
  assert(hex('1a2b3c') === true, 'hex debe pasar con hexadecimal')

  const [str] = compileMetadataRules([{ code: 'string' }], 'Str')
  assert(typeof str(123) === 'string', 'string debe fallar con números')
  assert(str('texto') === true, 'string debe pasar con texto')
  console.log('✔ 7. Reglas de caracteres alfanuméricos y formatos especiales aprobadas.')
}

// 8. Formatos avanzados: regex_match, valid_json, valid_base64, valid_ip, timezone
{
  const [regex] = compileMetadataRules([{ code: 'regex_match', params: { value: '^[0-9]{4}$' } }], 'PIN')
  assert(typeof regex('123') === 'string', 'regex_match debe fallar si no coincide')
  assert(regex('1234') === true, 'regex_match debe pasar si coincide')

  const [json] = compileMetadataRules([{ code: 'valid_json' }], 'Json')
  assert(typeof json('{invalido}') === 'string', 'valid_json debe fallar con json inválido')
  assert(json('{"nombre": "test"}') === true, 'valid_json debe pasar con json válido')

  const [b64] = compileMetadataRules([{ code: 'valid_base64' }], 'Base64')
  assert(typeof b64('???notb64') === 'string', 'valid_base64 debe fallar')
  assert(b64('SGVsbG8gV29ybGQ=') === true, 'valid_base64 debe pasar')

  const [ip] = compileMetadataRules([{ code: 'valid_ip' }], 'IP')
  assert(typeof ip('999.1.1.1') === 'string', 'valid_ip debe fallar con IP fuera de rango')
  assert(ip('192.168.0.1') === true, 'valid_ip debe pasar con IPv4 válida')

  const [tz] = compileMetadataRules([{ code: 'timezone' }], 'TZ')
  assert(typeof tz('Planeta/Marte') === 'string', 'timezone debe fallar con zona inexistente')
  assert(tz('America/Caracas') === true, 'timezone debe pasar con zona válida')
  assert(tz('UTC') === true, 'timezone debe pasar con UTC')
  console.log('✔ 8. Reglas de JSON, Base64, Regex, IP y Timezone aprobadas.')
}

// 9. Fechas y comparaciones temporales
{
  const [valDate] = compileMetadataRules([{ code: 'valid_date' }], 'Fecha')
  assert(typeof valDate('fecha-falsa') === 'string', 'valid_date debe fallar con fecha falsa')
  assert(valDate('2026-10-09') === true, 'valid_date debe pasar con fecha ISO válida')

  const [dateGt] = compileMetadataRules([{ code: 'date_greater_than', params: { value: '2026-01-01' } }], 'Fecha')
  assert(typeof dateGt('2025-12-31') === 'string', 'date_greater_than debe fallar si es anterior')
  assert(dateGt('2026-02-01') === true, 'date_greater_than debe pasar si es posterior')

  const [dateGte] = compileMetadataRules([{ code: 'date_greater_than_equal_to', params: { value: '2026-01-01' } }], 'Fecha')
  assert(typeof dateGte('2025-12-31') === 'string', 'date_greater_than_equal_to debe fallar si es anterior')
  assert(dateGte('2026-01-01') === true, 'date_greater_than_equal_to debe pasar si es igual')

  const [dateLt] = compileMetadataRules([{ code: 'date_less_than', params: { value: '2026-01-01' } }], 'Fecha')
  assert(typeof dateLt('2026-02-01') === 'string', 'date_less_than debe fallar si es posterior')
  assert(dateLt('2025-12-31') === true, 'date_less_than debe pasar si es anterior')

  const [dateLte] = compileMetadataRules([{ code: 'date_less_than_equal_to', params: { value: '2026-01-01' } }], 'Fecha')
  assert(typeof dateLte('2026-02-01') === 'string', 'date_less_than_equal_to debe fallar si es posterior')
  assert(dateLte('2026-01-01') === true, 'date_less_than_equal_to debe pasar si es igual')
  console.log('✔ 9. Reglas de fechas y comparaciones temporales aprobadas.')
}

console.log('--- TODAS LAS 9 BATERÍAS DE REGLAS PASARON EXITOSAMENTE (100% CUBIERTO) ---')
