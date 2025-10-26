-- Script simple para corregir las políticas RLS
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar políticas existentes incorrectas
DROP POLICY IF EXISTS usuarios_self_select ON public.usuarios;
DROP POLICY IF EXISTS usuarios_self_update ON public.usuarios;
DROP POLICY IF EXISTS usuarios_admin_policy ON public.usuarios;

-- 2. Crear políticas correctas basadas en correo_electronico
-- Política para SELECT: usuarios pueden ver su propio registro por correo
CREATE POLICY usuarios_self_select
ON public.usuarios
FOR SELECT
TO authenticated
USING (correo_electronico = auth.email());

-- Política para UPDATE: usuarios pueden actualizar su propio registro por correo
CREATE POLICY usuarios_self_update
ON public.usuarios
FOR UPDATE
TO authenticated
USING (correo_electronico = auth.email())
WITH CHECK (correo_electronico = auth.email());

-- Política para INSERT: usuarios pueden insertar su propio registro
CREATE POLICY usuarios_self_insert
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (correo_electronico = auth.email());

-- 3. Política para admin (opcional)
CREATE POLICY usuarios_admin_all
ON public.usuarios
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');
