# Supabase migrations

Run these in the Supabase SQL Editor (Dashboard → SQL Editor) or via Supabase CLI.

- **002_user_llm_settings.sql**: Creates `user_llm_settings` table and RLS so each user can store their chosen LLM provider (openai/claude/gemini) and API key. The backend reads this with the service role when generating recommendations.
