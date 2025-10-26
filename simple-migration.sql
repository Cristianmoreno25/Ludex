-- Migración simple para corregir la tabla usuarios
-- Ejecutar este script en Supabase SQL Editor

-- 1. Agregar columna user_auth_id si no existe
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS user_auth_id UUID;

-- 2. Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS usuarios_user_auth_id_idx 
ON public.usuarios(user_auth_id);

-- 3. Actualizar políticas RLS existentes para usar user_auth_id
-- Primero eliminar las políticas incorrectas
DROP POLICY IF EXISTS usuarios_self_select ON public.usuarios;
DROP POLICY IF EXISTS usuarios_self_update ON public.usuarios;

-- Crear políticas correctas
CREATE POLICY usuarios_self_select
ON public.usuarios
FOR SELECT
TO authenticated
USING (user_auth_id = auth.uid() OR correo_electronico = auth.email());

CREATE POLICY usuarios_self_update
ON public.usuarios
FOR UPDATE
TO authenticated
USING (user_auth_id = auth.uid() OR correo_electronico = auth.email())
WITH CHECK (user_auth_id = auth.uid() OR correo_electronico = auth.email());

CREATE POLICY usuarios_self_insert
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (user_auth_id = auth.uid());

-- 4. Función para sincronizar user_auth_id automáticamente
CREATE OR REPLACE FUNCTION sync_user_auth_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Si user_auth_id es NULL, usar auth.uid()
  IF NEW.user_auth_id IS NULL THEN
    NEW.user_auth_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para sincronizar user_auth_id
DROP TRIGGER IF EXISTS sync_user_auth_id_trigger ON public.usuarios;
CREATE TRIGGER sync_user_auth_id_trigger
  BEFORE INSERT ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_auth_id();
