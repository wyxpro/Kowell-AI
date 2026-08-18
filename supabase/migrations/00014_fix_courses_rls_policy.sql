-- Fix RLS policy on courses table to allow authenticated and anon users to insert/update courses
DROP POLICY IF EXISTS "authenticated_insert_courses" ON public.courses;
CREATE POLICY "authenticated_insert_courses" ON public.courses
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_courses" ON public.courses;
CREATE POLICY "authenticated_update_courses" ON public.courses
  FOR UPDATE
  USING (true);
