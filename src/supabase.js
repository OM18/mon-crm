import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mwmnlpksljtgyoqckiav.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bW5scGtzbGp0Z3lvcWNraWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjIxODEsImV4cCI6MjA4ODg5ODE4MX0.TIbB2dR25mfIxHCDE8_WlePE69LnKjTEfkXcTk8Newc'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)