import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dlbowtrmzigvyfqkhufi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsYm93dHJtemlndnlmcWtodWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzEyNjQsImV4cCI6MjA4OTQwNzI2NH0.Jkl_aBTEoxTr5xcHFlspJUrtGeC5Zc_okTx4D-x6ilI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data, error } = await supabase.from('cutoffs').select('*').limit(1)
    console.log("Error:", error)
    console.log("Data:", data)
}
test()
