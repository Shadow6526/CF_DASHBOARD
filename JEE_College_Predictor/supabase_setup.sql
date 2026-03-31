-- 1. Create the table in Supabase
CREATE TABLE cutoffs (
  id SERIAL PRIMARY KEY,
  institute TEXT NOT NULL,
  branch TEXT NOT NULL,
  quota TEXT NOT NULL,
  seat_type TEXT NOT NULL,
  gender TEXT NOT NULL,
  opening_rank FLOAT,
  closing_rank FLOAT
);

-- Note: To upload the 11k rows, the easiest way is to use the Supabase Dashboard:
-- 1. Create this table using the SQL editor.
-- 2. Go to 'Table Editor' -> 'cutoffs'.
-- 3. Click 'Insert' -> 'Import data from CSV'.
-- 4. Select the `josaa24.csv` file inside your project's `data/` folder and let Supabase auto-map it!
