-- Crear tabla de países
CREATE TABLE public.paises (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(5) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    codigo_moneda CHAR(3) NOT NULL,
    tasa_iva NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);
-- Crear tabla de usuarios
CREATE TABLE public.usuarios (
    id BIGSERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    correo_electronico VARCHAR(255) UNIQUE NOT NULL,
    hash_contrasena VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(200),
    telefono VARCHAR(50),
    fecha_nacimiento DATE,
    pais_id BIGINT REFERENCES public.paises(id),
    rol VARCHAR(20) NOT NULL DEFAULT 'cliente',  -- cliente | desarrollador | admin
    acepto_terminos BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
-- Activar RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paises ENABLE ROW LEVEL SECURITY;
-- Permitir lectura a todos
CREATE POLICY paises_select_all
ON public.paises
FOR SELECT
USING (true);

-- Permitir inserción, actualización y borrado solo a admin
CREATE POLICY paises_admin_policy
ON public.paises
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');
--------------------Rls Usuarios-----------------
-- Permitir que cada usuario vea su propio registro
CREATE POLICY usuarios_self_select
ON public.usuarios
FOR SELECT
TO authenticated
USING (auth.uid()::text = id::text);

-- Permitir que cada usuario actualice solo su propio registro
CREATE POLICY usuarios_self_update
ON public.usuarios
FOR UPDATE
TO authenticated
USING (auth.uid()::text = id::text)
WITH CHECK (auth.uid()::text = id::text);

-- Permitir que el admin vea y modifique todos
CREATE POLICY usuarios_admin_policy
ON public.usuarios
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');
-- Actualizar 'actualizado_en' automáticamente al modificar un usuario
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
---------------------------------------------------------------------------------------