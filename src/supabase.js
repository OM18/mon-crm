import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mwmnlpksljtgyoqckiav.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Ec8UdaCK5aaDJoRknxRUYg_K0t0HMi6'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)