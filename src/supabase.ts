import { createClient } from '@supabase/supabase-js'

// Публичные значения: адрес проекта и publishable-ключ. Доступ к данным
// ограничен правилами базы (каждый пользователь видит только свои записи).
export const SUPABASE_URL = 'https://zemjsdirnhhqnlzyltrv.supabase.co'
const SUPABASE_KEY = 'sb_publishable_hfiI_pT9lfUZRklE9TXcAw_epqjtwlL'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const FILES_BUCKET = 'files'
