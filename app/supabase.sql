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
-----------------------------------------------------------------------------------------------------------------------------------------------------------------

-- =====================================================================================
--  EXTENSIONES Y UTILS
-- =====================================================================================
-- Habilitar extensiones útiles si no existen (idempotente)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Función helper para detectar admin desde el JWT (mismo criterio usado en el repo)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE((auth.jwt() ->> 'role') = 'admin', false)
$$;

-- =====================================================================================
--  CATEGORÍAS Y JUEGOS (HU6, HU12)
-- =====================================================================================
-- Tabla de categorías
CREATE TABLE IF NOT EXISTS public.categorias (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Lectura pública de categorías
DO $$ BEGIN
  CREATE POLICY categorias_select_all
  ON public.categorias
  FOR SELECT
  TO public
  USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Solo admin puede insertar/actualizar/borrar categorías
DO $$ BEGIN
  CREATE POLICY categorias_admin_all
  ON public.categorias
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Semillas mínimas de categorías (idempotente)
INSERT INTO public.categorias (nombre, slug)
VALUES
  ('Adventure','adventure'),
  ('RPG','rpg'),
  ('Puzzle','puzzle'),
  ('Simulation','simulation'),
  ('Strategy','strategy'),
  ('Action','action')
ON CONFLICT (nombre) DO NOTHING;

-- Tabla de juegos
CREATE TABLE IF NOT EXISTS public.juegos (
  id BIGSERIAL PRIMARY KEY,
  developer_auth_id UUID NOT NULL, -- usuario (auth.uid()) dueño del juego
  titulo TEXT NOT NULL,
  slug TEXT UNIQUE,
  descripcion TEXT,
  categoria_id BIGINT REFERENCES public.categorias(id),
  precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  precio_descuento NUMERIC(10,2) CHECK (precio_descuento >= 0),
  estado TEXT NOT NULL CHECK (estado IN ('borrador','revision','publicado','rechazado')) DEFAULT 'borrador',
  calificacion_media NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  calificaciones_total INTEGER NOT NULL DEFAULT 0,
  publicado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.juegos ENABLE ROW LEVEL SECURITY;

-- Índices útiles para búsqueda/filtrado (HU6)
CREATE INDEX IF NOT EXISTS juegos_titulo_idx ON public.juegos (lower(titulo));
CREATE INDEX IF NOT EXISTS juegos_precio_idx ON public.juegos (precio);
CREATE INDEX IF NOT EXISTS juegos_rating_idx ON public.juegos (calificacion_media);
CREATE INDEX IF NOT EXISTS juegos_categoria_idx ON public.juegos (categoria_id);
CREATE INDEX IF NOT EXISTS juegos_publicados_idx ON public.juegos (estado) WHERE estado = 'publicado';

-- Política: lectura pública SOLO de juegos publicados
DO $$ BEGIN
  CREATE POLICY juegos_public_select
  ON public.juegos
  FOR SELECT
  TO public
  USING (estado = 'publicado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Política: los desarrolladores ven SIEMPRE sus juegos (cualquier estado)
DO $$ BEGIN
  CREATE POLICY juegos_owner_select
  ON public.juegos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = developer_auth_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Política: insertar juego propio (developer_auth_id = auth.uid())
DO $$ BEGIN
  CREATE POLICY juegos_owner_insert
  ON public.juegos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = developer_auth_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Política: actualizar juego propio solo en borrador o rechazado
DO $$ BEGIN
  CREATE POLICY juegos_owner_update
  ON public.juegos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = developer_auth_id AND estado IN ('borrador','rechazado'))
  WITH CHECK (auth.uid() = developer_auth_id AND estado IN ('borrador','rechazado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Política: admin puede TODO sobre juegos (incluye publicar)
DO $$ BEGIN
  CREATE POLICY juegos_admin_all
  ON public.juegos
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger de timestamp
CREATE OR REPLACE FUNCTION public.juegos_set_timestamp()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := NOW();
  IF NEW.estado = 'publicado' AND OLD.estado IS DISTINCT FROM 'publicado' THEN
    NEW.publicado_en := COALESCE(NEW.publicado_en, NOW());
  END IF;
  RETURN NEW;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_juegos_set_timestamp'
  ) THEN
    CREATE TRIGGER trg_juegos_set_timestamp
    BEFORE UPDATE ON public.juegos
    FOR EACH ROW EXECUTE FUNCTION public.juegos_set_timestamp();
  END IF;
END $$;

-- =====================================================================================
--  CALIFICACIONES (HU6)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.calificaciones (
  id BIGSERIAL PRIMARY KEY,
  juego_id BIGINT NOT NULL REFERENCES public.juegos(id) ON DELETE CASCADE,
  user_auth_id UUID NOT NULL,
  valor INTEGER NOT NULL CHECK (valor BETWEEN 1 AND 5),
  comentario TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (juego_id, user_auth_id)
);
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;

-- RLS: lectura pública (o podrías limitar a publicados); escritura solo del dueño de la fila
DO $$ BEGIN
  CREATE POLICY califs_select_all
  ON public.calificaciones
  FOR SELECT
  TO public
  USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY califs_insert_self
  ON public.calificaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY califs_update_self
  ON public.calificaciones
  FOR UPDATE
  TO authenticated
  USING (user_auth_id = auth.uid())
  WITH CHECK (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY califs_delete_self
  ON public.calificaciones
  FOR DELETE
  TO authenticated
  USING (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger: mantener promedio y conteo en juegos
CREATE OR REPLACE FUNCTION public.recalc_juego_rating()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_juego BIGINT;
BEGIN
  v_juego := COALESCE(NEW.juego_id, OLD.juego_id);
  UPDATE public.juegos j
  SET calificacion_media = COALESCE(s.avg,0)::NUMERIC(3,2),
      calificaciones_total = COALESCE(s.ct,0)
  FROM (
    SELECT juego_id, AVG(valor) AS avg, COUNT(*) AS ct
    FROM public.calificaciones WHERE juego_id = v_juego GROUP BY juego_id
  ) s
  WHERE j.id = v_juego;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calif_ins') THEN
    CREATE TRIGGER trg_calif_ins AFTER INSERT ON public.calificaciones
    FOR EACH ROW EXECUTE FUNCTION public.recalc_juego_rating();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calif_upd') THEN
    CREATE TRIGGER trg_calif_upd AFTER UPDATE ON public.calificaciones
    FOR EACH ROW EXECUTE FUNCTION public.recalc_juego_rating();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calif_del') THEN
    CREATE TRIGGER trg_calif_del AFTER DELETE ON public.calificaciones
    FOR EACH ROW EXECUTE FUNCTION public.recalc_juego_rating();
  END IF;
END $$;

-- =====================================================================================
--  CARRITO (HU7)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.carritos (
  id BIGSERIAL PRIMARY KEY,
  user_auth_id UUID NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('abierto','checkout','completado','anulado')) DEFAULT 'abierto',
  total_items INTEGER NOT NULL DEFAULT 0,
  total_monto NUMERIC(10,2) NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.carritos ENABLE ROW LEVEL SECURITY;

-- Un solo carrito abierto por usuario
CREATE UNIQUE INDEX IF NOT EXISTS uniq_carrito_abierto
ON public.carritos(user_auth_id) WHERE (estado = 'abierto');

-- RLS: solo dueño puede acceder CRUD a su carrito
DO $$ BEGIN
  CREATE POLICY carritos_owner_select
  ON public.carritos
  FOR SELECT
  TO authenticated
  USING (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY carritos_owner_insert
  ON public.carritos
  FOR INSERT
  TO authenticated
  WITH CHECK (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY carritos_owner_update
  ON public.carritos
  FOR UPDATE
  TO authenticated
  USING (user_auth_id = auth.uid())
  WITH CHECK (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY carritos_owner_delete
  ON public.carritos
  FOR DELETE
  TO authenticated
  USING (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ítems del carrito
CREATE TABLE IF NOT EXISTS public.carrito_items (
  id BIGSERIAL PRIMARY KEY,
  carrito_id BIGINT NOT NULL REFERENCES public.carritos(id) ON DELETE CASCADE,
  juego_id BIGINT NOT NULL REFERENCES public.juegos(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0) DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (carrito_id, juego_id)
);
ALTER TABLE public.carrito_items ENABLE ROW LEVEL SECURITY;

-- RLS: solo el dueño del carrito ve/modifica sus ítems
DO $$ BEGIN
  CREATE POLICY carrito_items_owner_select
  ON public.carrito_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carritos c
      WHERE c.id = carrito_id AND c.user_auth_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY carrito_items_owner_insert
  ON public.carrito_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carritos c
      WHERE c.id = carrito_id AND c.user_auth_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY carrito_items_owner_update
  ON public.carrito_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carritos c
      WHERE c.id = carrito_id AND c.user_auth_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carritos c
      WHERE c.id = carrito_id AND c.user_auth_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY carrito_items_owner_delete
  ON public.carrito_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carritos c
      WHERE c.id = carrito_id AND c.user_auth_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Triggers utilitarios: set precio_unitario por defecto y recalcular totales
CREATE OR REPLACE FUNCTION public.set_precio_item_por_defecto()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p NUMERIC(10,2);
BEGIN
  IF NEW.precio_unitario IS NULL THEN
    SELECT COALESCE(j.precio_descuento, j.precio) INTO p FROM public.juegos j WHERE j.id = NEW.juego_id;
    NEW.precio_unitario := COALESCE(p, 0);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.recalc_carrito_totales()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_carrito BIGINT; v_items int; v_monto numeric;
BEGIN
  v_carrito := COALESCE(NEW.carrito_id, OLD.carrito_id);
  SELECT COALESCE(SUM(ci.cantidad),0), COALESCE(SUM(ci.cantidad * ci.precio_unitario),0)
    INTO v_items, v_monto
  FROM public.carrito_items ci WHERE ci.carrito_id = v_carrito;
  UPDATE public.carritos SET total_items = v_items, total_monto = v_monto, actualizado_en = NOW() WHERE id = v_carrito;
  RETURN NULL;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_carrito_items_bi_price') THEN
    CREATE TRIGGER trg_carrito_items_bi_price
    BEFORE INSERT ON public.carrito_items
    FOR EACH ROW EXECUTE FUNCTION public.set_precio_item_por_defecto();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_carrito_items_ai_recalc') THEN
    CREATE TRIGGER trg_carrito_items_ai_recalc
    AFTER INSERT OR UPDATE OR DELETE ON public.carrito_items
    FOR EACH ROW EXECUTE FUNCTION public.recalc_carrito_totales();
  END IF;
END $$;

-- =====================================================================================
--  WISHLIST + NOTIFICACIONES (HU8)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.lista_deseos (
  id BIGSERIAL PRIMARY KEY,
  user_auth_id UUID NOT NULL,
  juego_id BIGINT NOT NULL REFERENCES public.juegos(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_auth_id, juego_id)
);
ALTER TABLE public.lista_deseos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY wishlist_owner_crud
  ON public.lista_deseos
  FOR ALL
  TO authenticated
  USING (user_auth_id = auth.uid())
  WITH CHECK (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notificaciones simples
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id BIGSERIAL PRIMARY KEY,
  user_auth_id UUID NOT NULL,
  tipo TEXT NOT NULL, -- 'descuento', etc
  data JSONB,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS notif_user_idx ON public.notificaciones (user_auth_id, leida);

DO $$ BEGIN
  CREATE POLICY notif_owner_crud
  ON public.notificaciones
  FOR ALL
  TO authenticated
  USING (user_auth_id = auth.uid())
  WITH CHECK (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger: al bajar precio de un juego publicado, notificar a usuarios con wishlist
CREATE OR REPLACE FUNCTION public.notify_price_drop()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oldp NUMERIC; newp NUMERIC;
BEGIN
  oldp := COALESCE(OLD.precio_descuento, OLD.precio);
  newp := COALESCE(NEW.precio_descuento, NEW.precio);
  IF NEW.estado = 'publicado' AND newp < oldp THEN
    INSERT INTO public.notificaciones (user_auth_id, tipo, data)
    SELECT ld.user_auth_id, 'descuento', jsonb_build_object('juego_id', NEW.id, 'precio_anterior', oldp, 'precio_nuevo', newp)
    FROM public.lista_deseos ld
    WHERE ld.juego_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_juegos_notify_drop') THEN
    CREATE TRIGGER trg_juegos_notify_drop
    AFTER UPDATE OF precio, precio_descuento ON public.juegos
    FOR EACH ROW EXECUTE FUNCTION public.notify_price_drop();
  END IF;
END $$;

-- =====================================================================================
--  DESARROLLADORES (HU11) + ARCHIVOS (HU12)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.desarrolladores (
  user_auth_id UUID PRIMARY KEY,
  nombre_estudio TEXT,
  razon_social TEXT,
  nit TEXT UNIQUE,              -- id fiscal
  direccion TEXT,
  pais_id BIGINT REFERENCES public.paises(id),
  telefono TEXT,
  estado_verificacion TEXT NOT NULL CHECK (estado_verificacion IN ('pendiente','verificado','rechazado')) DEFAULT 'pendiente',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  documentos JSONB,             -- metadatos/links a documentos
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.desarrolladores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY dev_owner_select
  ON public.desarrolladores
  FOR SELECT
  TO authenticated
  USING (user_auth_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY dev_owner_insert
  ON public.desarrolladores
  FOR INSERT
  TO authenticated
  WITH CHECK (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY dev_owner_update
  ON public.desarrolladores
  FOR UPDATE
  TO authenticated
  USING (user_auth_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_auth_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Archivos de juego (metadatos; los binarios viven en Supabase Storage)
CREATE TABLE IF NOT EXISTS public.juego_archivos (
  id BIGSERIAL PRIMARY KEY,
  juego_id BIGINT NOT NULL REFERENCES public.juegos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('instalador','ejecutable','otro')),
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  checksum TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.juego_archivos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY files_dev_select
  ON public.juego_archivos
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.juegos j WHERE j.id = juego_id AND j.developer_auth_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY files_dev_insert
  ON public.juego_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.juegos j WHERE j.id = juego_id AND j.developer_auth_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY files_dev_update
  ON public.juego_archivos
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.juegos j WHERE j.id = juego_id AND j.developer_auth_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.juegos j WHERE j.id = juego_id AND j.developer_auth_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY files_dev_delete
  ON public.juego_archivos
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.juegos j WHERE j.id = juego_id AND j.developer_auth_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================================
--  MÉTODOS DE PAGO (HU16)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.metodos_pago (
  id BIGSERIAL PRIMARY KEY,
  user_auth_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'card', -- por ahora solo 'card'
  brand TEXT,                        -- VISA/Mastercard/etc
  last4 TEXT,                        -- últimos 4 dígitos
  masked TEXT,                       -- '**** **** **** 1234'
  holder_name TEXT,
  exp_month INT CHECK (exp_month BETWEEN 1 AND 12),
  exp_year INT CHECK (exp_year >= EXTRACT(YEAR FROM NOW())::INT - 1),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS metodos_pago_default_idx
ON public.metodos_pago(user_auth_id)
WHERE (is_default);

DO $$ BEGIN
  CREATE POLICY mp_owner_crud
  ON public.metodos_pago
  FOR ALL
  TO authenticated
  USING (user_auth_id = auth.uid())
  WITH CHECK (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Luhn check (validación básica de tarjeta). No almacenamos el número.
CREATE OR REPLACE FUNCTION public.luhn_valid(num TEXT)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s INT := 0; alt BOOLEAN := false; i INT; c INT;
BEGIN
  num := regexp_replace(num, '\\D', '', 'g');
  IF length(num) < 12 THEN RETURN false; END IF;
  FOR i IN REVERSE length(num)..1 LOOP
    c := CAST(substr(num, i, 1) AS INT);
    IF alt THEN c := c * 2; IF c > 9 THEN c := c - 9; END IF; END IF;
    s := s + c; alt := NOT alt;
  END LOOP;
  RETURN (s % 10 = 0);
END; $$;

-- RPC para añadir tarjeta: recibe número, valida Luhn y guarda enmascarado
CREATE OR REPLACE FUNCTION public.add_payment_card(
  p_number TEXT,
  p_exp_month INT,
  p_exp_year INT,
  p_holder TEXT,
  p_brand TEXT DEFAULT NULL,
  p_set_default BOOLEAN DEFAULT FALSE
)
RETURNS public.metodos_pago
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_last4 TEXT; v_masked TEXT; v_row public.metodos_pago;
BEGIN
  IF NOT public.luhn_valid(p_number) THEN
    RAISE EXCEPTION 'Tarjeta no válida' USING ERRCODE = '22000';
  END IF;
  v_last4 := right(regexp_replace(p_number, '\\D', '', 'g'), 4);
  v_masked := '**** **** **** ' || v_last4;

  IF p_set_default THEN
    UPDATE public.metodos_pago SET is_default = FALSE WHERE user_auth_id = auth.uid();
  END IF;

  INSERT INTO public.metodos_pago (user_auth_id, brand, last4, masked, holder_name, exp_month, exp_year, is_default)
  VALUES (auth.uid(), p_brand, v_last4, v_masked, p_holder, p_exp_month, p_exp_year, COALESCE(p_set_default, FALSE))
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

-- =====================================================================================
--  PREFERENCIAS DE CUENTA (HU17)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.preferencias_usuarios (
  user_auth_id UUID PRIMARY KEY,
  notificaciones BOOLEAN NOT NULL DEFAULT TRUE,
  idioma TEXT NOT NULL DEFAULT 'es',
  tema TEXT NOT NULL DEFAULT 'system', -- 'light','dark','system'
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.preferencias_usuarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY prefs_owner_crud
  ON public.preferencias_usuarios
  FOR ALL
  TO authenticated
  USING (user_auth_id = auth.uid())
  WITH CHECK (user_auth_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RPC de conveniencia para upsert de preferencias
CREATE OR REPLACE FUNCTION public.set_preferencias(
  p_notif BOOLEAN,
  p_idioma TEXT,
  p_tema TEXT,
  p_marketing BOOLEAN
)
RETURNS public.preferencias_usuarios
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v public.preferencias_usuarios;
BEGIN
  INSERT INTO public.preferencias_usuarios (user_auth_id, notificaciones, idioma, tema, marketing_opt_in)
  VALUES (auth.uid(), COALESCE(p_notif, TRUE), COALESCE(p_idioma,'es'), COALESCE(p_tema,'system'), COALESCE(p_marketing,FALSE))
  ON CONFLICT (user_auth_id)
  DO UPDATE SET notificaciones = EXCLUDED.notificaciones,
                idioma = EXCLUDED.idioma,
                tema = EXCLUDED.tema,
                marketing_opt_in = EXCLUDED.marketing_opt_in,
                actualizado_en = NOW()
  RETURNING * INTO v;
  RETURN v;
END; $$;

-- =====================================================================================
--  HELPERS GENÉRICOS: setear user_auth_id si viene NULL
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.set_auth_user_id()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_auth_id IS NULL THEN
    NEW.user_auth_id := auth.uid();
  END IF;
  RETURN NEW;
END; $$;

DO $$ BEGIN
  -- carritos
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_carritos_set_user') THEN
    CREATE TRIGGER trg_carritos_set_user
    BEFORE INSERT ON public.carritos
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();
  END IF;
  -- wishlist
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wishlist_set_user') THEN
    CREATE TRIGGER trg_wishlist_set_user
    BEFORE INSERT ON public.lista_deseos
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();
  END IF;
  -- metodos_pago
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mp_set_user') THEN
    CREATE TRIGGER trg_mp_set_user
    BEFORE INSERT ON public.metodos_pago
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();
  END IF;
  -- preferencias
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prefs_set_user') THEN
    CREATE TRIGGER trg_prefs_set_user
    BEFORE INSERT ON public.preferencias_usuarios
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();
  END IF;
  -- calificaciones
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_calif_set_user') THEN
    CREATE TRIGGER trg_calif_set_user
    BEFORE INSERT ON public.calificaciones
    FOR EACH ROW EXECUTE FUNCTION public.set_auth_user_id();
  END IF;
END $$;

-- =====================================================================================
--  NOTAS
--  - Las tablas existentes (paises, usuarios) se mantienen intactas.
--  - Se permite lectura pública de juegos publicados y categorías para browsing sin cuenta.
--  - RLS para owner en carritos, wishlist, métodos de pago y preferencias.
--  - Publicación de juegos: sólo admin puede pasar a 'publicado' (política admin all).
--  - Notificaciones por descuento se generan automáticamente al bajar precio.
-- =====================================================================================
----------------------------------------------------------------------------------------------------------------------------------------
-- =====================================================================================
--  SIMULACIÓN DE PAGO: CHECKOUT DEL CARRITO (SIN API) (HU7)
-- =====================================================================================
-- Uso:
--   SELECT * FROM public.checkout_carrito();
-- Efecto:
--   - Toma el carrito 'abierto' del usuario actual (auth.uid()),
--   - lo marca como 'completado',
--   - retorna (carrito_id, total_monto),
--   - y crea un nuevo carrito 'abierto' vacío para el usuario.
CREATE OR REPLACE FUNCTION public.checkout_carrito()
RETURNS TABLE(carrito_id BIGINT, total NUMERIC)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_id BIGINT; v_total NUMERIC;
BEGIN
  SELECT id, total_monto INTO v_id, v_total
  FROM public.carritos
  WHERE user_auth_id = auth.uid() AND estado = 'abierto'
  ORDER BY id DESC LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No hay carrito abierto';
  END IF;
  UPDATE public.carritos
  SET estado = 'completado', actualizado_en = NOW()
  WHERE id = v_id;
  INSERT INTO public.carritos (user_auth_id, estado)
  VALUES (auth.uid(), 'abierto');
  RETURN QUERY SELECT v_id, v_total;
END $$;
-- =====================================================================================
--  DOCUMENTACIÓN (REFERENCIA RÁPIDA) – STORAGE POR UI (SIN API)
-- =====================================================================================
/*
PASO 1) Buckets (en UI)
  - game-images (público)
    • Public bucket: ON
    • Restrict file size: 5 MB → 5,242,880
    • MIME: image/png,image/jpeg,image/webp,image/avif,image/svg+xml
  - game-files (privado)
    • Public bucket: OFF
    • Restrict file size: RECOMENDADO 100 MB → 104,857,600 (si quieres 50 MB usa 52,428,800)
    • MIME: application/zip,application/x-zip-compressed,application/octet-stream,application/x-msdownload
PASO 2) Convención de rutas en Storage
  - Binarios:  games/<juego_id>/build.zip
  - Portadas:  games/<juego_id>/cover.webp
  - Guarda el path en public.juego_archivos.storage_path
PASO 3) Políticas UI para game-images (bucket)
  A) INSERT (Auth):
     bucket_id = 'game-images' AND owner = auth.uid()
  B) UPDATE (Auth):
     bucket_id = 'game-images' AND owner = auth.uid()
  C) DELETE (Auth):
     bucket_id = 'game-images' AND owner = auth.uid()
  D) (Opcional) SELECT (Public) para listar desde cliente:
     bucket_id = 'game-images'
PASO 4) Políticas UI para game-files (bucket, privado)
  A) SELECT (Auth) – Dueño O Comprador (carrito completado):
     bucket_id = 'game-files'
     AND (
       owner = auth.uid()
       OR EXISTS (
         SELECT 1
         FROM public.carrito_items ci
         JOIN public.carritos c ON c.id = ci.carrito_id
         WHERE c.estado = 'completado'
           AND c.user_auth_id = auth.uid()
           AND ci.juego_id::text = (storage.foldername(name))[2]
       )
     )
  B) INSERT (Auth):
     bucket_id = 'game-files' AND owner = auth.uid()
  C) UPDATE (Auth):
     bucket_id = 'game-files' AND owner = auth.uid()
  D) DELETE (Auth):
     bucket_id = 'game-files' AND owner = auth.uid()
PASO 5) Flujo de pago simulado
  - Al pagar, llama:  SELECT * FROM public.checkout_carrito();
  - Esto marca el carrito actual como 'completado' y crea uno nuevo 'abierto'.
  - Gracias a la política SELECT del bucket privado, los compradores podrán descargar
    archivos bajo games/<juego_id>/..., sin necesidad de API de URL firmada.
PRUEBAS RÁPIDAS
  1) DEV sube build:  games/123/build.zip  (autenticado) → debería listar/descargar como owner.
  2) USER sin compra → no puede descargar.
  3) USER agrega al carrito y ejecuta checkout_carrito() → ahora puede descargar/listar.
NOTAS
  - Si subes con service key desde servidor, 'owner' puede quedar NULL. Para gestión desde cliente
    usa subida autenticada o cambia políticas a validación por carpeta+developer.
  - Para producción, se recomienda API con URL firmadas para control más fino.
*/