ALTER TABLE public.artworks ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
GRANT DELETE ON public.artworks TO authenticated;
DROP POLICY IF EXISTS "Owners can see own artwork" ON public.artworks;
CREATE POLICY "Owners can see own artwork" ON public.artworks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Owners can delete own artwork" ON public.artworks;
CREATE POLICY "Owners can delete own artwork" ON public.artworks FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
