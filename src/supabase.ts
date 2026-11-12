import { createClient } from '@supabase/supabase-js'

// Публичные значения: адрес проекта и publishable-ключ. Доступ к данным
// ограничен правилами базы (каждый пользователь видит только свои записи).
export const SUPABASE_URL = 'https://zemjsdirnhhqnlzyltrv.supabase.co'
const SUPABASE_KEY = 'sb_publishable_hfiI_pT9lfUZRklE9TXcAw_epqjtwlL'

// Ссылки из писем (подтверждение почты, сброс пароля) разбираем сами:
// приложение использует адреса вида #/..., и стандартный разбор с ними конфликтует.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export const FILES_BUCKET = 'files'

/** Адрес, куда ведут ссылки из писем, — корень приложения. */
export function appRootUrl(): string {
  return location.origin + location.pathname
}

/**
 * Вызывается до отрисовки приложения. Если страницу открыли по ссылке из письма,
 * забирает из адреса данные входа и переводит на нужный экран.
 */
export function handleAuthRedirect() {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : ''
  const go = (route: string) => history.replaceState(null, '', location.pathname + '#' + route)

  // Ошибка: например, ссылка устарела или уже использована
  if (hash.includes('error_description=') || hash.includes('error_code=')) {
    const p = new URLSearchParams(hash)
    const code = p.get('error_code') ?? 'error'
    go(`/reset-password?error=${encodeURIComponent(code)}`)
    return
  }

  // Implicit-ссылка: #access_token=…&refresh_token=…&type=recovery|signup
  if (hash.includes('access_token=')) {
    const p = new URLSearchParams(hash)
    const access_token = p.get('access_token') ?? ''
    const refresh_token = p.get('refresh_token') ?? ''
    const type = p.get('type')
    go(type === 'recovery' ? '/reset-password' : '/settings')
    if (access_token && refresh_token) void supabase.auth.setSession({ access_token, refresh_token })
    return
  }

  // PKCE-ссылка: ?code=…
  const search = new URLSearchParams(location.search)
  const code = search.get('code')
  if (code) {
    history.replaceState(null, '', location.pathname + '#/reset-password')
    void supabase.auth.exchangeCodeForSession(code).catch(() => {
      history.replaceState(null, '', location.pathname + '#/reset-password?error=otp_expired')
    })
  }
}
