-- Migración para corregir la tabla usuarios y políticas RLS
-- Ejecutar este script en Supabase SQL Editor

-- 1. Agregar columna user_auth_id a la tabla usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS user_auth_id UUID;

-- 2. Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS usuarios_user_auth_id_idx 
ON public.usuarios(user_auth_id);

-- 3. Eliminar políticas RLS existentes (incorrectas)
DROP POLICY IF EXISTS usuarios_self_select ON public.usuarios;
DROP POLICY IF EXISTS usuarios_self_update ON public.usuarios;
DROP POLICY IF EXISTS usuarios_admin_policy ON public.usuarios;

-- 4. Crear políticas RLS correctas
-- Política para SELECT: usuarios pueden ver su propio registro
CREATE POLICY usuarios_self_select
ON public.usuarios
FOR SELECT
TO authenticated
USING (user_auth_id = auth.uid());

-- Política para UPDATE: usuarios pueden actualizar su propio registro
CREATE POLICY usuarios_self_update
ON public.usuarios
FOR UPDATE
TO authenticated
USING (user_auth_id = auth.uid())
WITH CHECK (user_auth_id = auth.uid());

-- Política para INSERT: usuarios pueden insertar su propio registro
CREATE POLICY usuarios_self_insert
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (user_auth_id = auth.uid());

-- Política para admin: admin puede hacer todo
CREATE POLICY usuarios_admin_all
ON public.usuarios
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- 5. Función para sincronizar user_auth_id cuando se crea un usuario
CREATE OR REPLACE FUNCTION sync_user_auth_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Si user_auth_id es NULL, intentar obtenerlo del auth.uid()
  IF NEW.user_auth_id IS NULL THEN
    NEW.user_auth_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para sincronizar user_auth_id automáticamente
DROP TRIGGER IF EXISTS sync_user_auth_id_trigger ON public.usuarios;
CREATE TRIGGER sync_user_auth_id_trigger
  BEFORE INSERT ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_auth_id();

-- 7. Actualizar registros existentes con user_auth_id basado en correo_electronico
-- Esto es temporal y debería ejecutarse solo una vez
-- UPDATE public.usuarios 
-- SET user_auth_id = (
--   SELECT id FROM auth.users 
--   WHERE auth.users.email = usuarios.correo_electronico
-- )
-- WHERE user_auth_id IS NULL;

-- 8. Hacer user_auth_id NOT NULL después de la migración
-- ALTER TABLE public.usuarios ALTER COLUMN user_auth_id SET NOT NULL;
