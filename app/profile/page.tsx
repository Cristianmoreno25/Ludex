// app/profile/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const supabase = createClient();

type UsuarioRow = {
  id?: number;
  usuario?: string;
  nombre_completo?: string;
  correo_electronico?: string;
  telefono?: string;
  fecha_nacimiento?: string;
  rol?: string;
  avatar_path?: string;
  pais_id?: number;
  creado_en?: string;
};

type PaisRow = {
  id: number;
  nombre: string;
  codigo: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UsuarioRow | null>(null);
  const [pais, setPais] = useState<PaisRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Verificar sesión inmediatamente
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile();
      } else {
        router.push('/auth/login');
      }
    };
    
    checkSession();
    
    // Suscribirse a cambios de sesión
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile();
      } else {
        setUser(null);
        setProfile(null);
        router.push('/auth/login');
      }
    });
    return () => listener?.subscription?.unsubscribe?.();
  }, [router]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const { data: userResult } = await supabase.auth.getUser();
      const currentUser = userResult?.user;
      
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        router.push('/auth/login');
        return;
      }

      setUser(currentUser);

      // Buscar usuario en la tabla usuarios por correo_electronico
      const email = currentUser.email;
      if (email) {
        const { data, error } = await supabase
          .from('usuarios')
          .select(`
            id,
            usuario, 
            nombre_completo, 
            correo_electronico, 
            telefono,
            fecha_nacimiento,
            rol,
            avatar_path,
            pais_id,
            creado_en
          `)
          .eq('correo_electronico', email)
          .maybeSingle();

        if (!error && data) {
          console.log('Perfil encontrado en BD:', data);
          setProfile(data);
          
          // Si tiene país, obtener información del país
          if (data.pais_id) {
            const { data: paisData } = await supabase
              .from('paises')
              .select('id, nombre, codigo')
              .eq('id', data.pais_id)
              .maybeSingle();
            
            if (paisData) {
              console.log('País encontrado:', paisData);
              setPais(paisData);
            }
          }
        } else {
          // Si no existe en la tabla usuarios, crear perfil básico
          console.log('Usuario no encontrado en BD, creando perfil básico');
          setProfile({
            usuario: currentUser.email?.split('@')[0] || 'usuario',
            nombre_completo: currentUser.user_metadata?.full_name || currentUser.email,
            correo_electronico: currentUser.email,
            rol: 'cliente'
          });
        }
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  function avatarUrl(path?: string) {
    if (!path) return 'https://i.pravatar.cc/150?img=3';
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${encodeURIComponent(path)}`;
  }

  function formatDate(dateString?: string) {
    if (!dateString) return 'No especificada';
    return new Date(dateString).toLocaleDateString('es-ES');
  }

  if (loading) {
    return (
      <main className="main profile-page">
        <h1 className="profile-title">Perfil</h1>
        <div className="profile-info">
          <div className="profile-avatar" style={{ 
            width: '96px', 
            height: '96px', 
            borderRadius: '50%', 
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem'
          }}>⏳</div>
          <div className="profile-username">Cargando...</div>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/protected" className="back-btn" aria-label="Volver">
            <i className="fa-solid fa-arrow-left"></i>
          </Link>
          <div className="brand">
            <svg className="brand-mark" width="24" height="24" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="#3366ff"/>
            </svg>
            <span className="brand-name">
              <Link href="/protected">Ludex</Link>
            </span>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="main profile-page">
        <h1 className="profile-title">Perfil</h1>

        {/* Información del usuario */}
        <div className="profile-info">
          <img 
            src={avatarUrl(profile?.avatar_path)} 
            alt="Foto de perfil de usuario" 
            className="profile-avatar" 
          />
          <div className="profile-username">
            {profile?.usuario ? `@${profile.usuario}` : (user?.email?.split('@')[0] || 'Usuario')}
          </div>
          <button className="edit-btn" aria-label="Editar perfil">✎</button>
        </div>

        {/* Debug info - remover en producción */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ 
            background: '#f0f0f0', 
            padding: '10px', 
            margin: '10px 0', 
            borderRadius: '5px',
            fontSize: '12px',
            color: '#666'
          }}>
            <strong>Debug Info:</strong><br/>
            User: {user?.email || 'No user'}<br/>
            Profile: {profile ? 'Loaded' : 'Not loaded'}<br/>
            Loading: {loading ? 'Yes' : 'No'}<br/>
            Username: {profile?.usuario || 'N/A'}<br/>
            Full Name: {profile?.nombre_completo || 'N/A'}
          </div>
        )}

        {/* Información detallada */}
        <div className="profile-details">
          <div className="detail-item">
            <span className="detail-label">Nombre completo:</span>
            <span className="detail-value">{profile?.nombre_completo || 'No especificado'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Email:</span>
            <span className="detail-value">{profile?.correo_electronico || user?.email}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Teléfono:</span>
            <span className="detail-value">{profile?.telefono || 'No especificado'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Fecha de nacimiento:</span>
            <span className="detail-value">{formatDate(profile?.fecha_nacimiento)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">País:</span>
            <span className="detail-value">{pais?.nombre || 'No especificado'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Rol:</span>
            <span className="detail-value">{profile?.rol || 'cliente'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Miembro desde:</span>
            <span className="detail-value">{formatDate(profile?.creado_en || user?.created_at)}</span>
          </div>
        </div>

        {/* Navegación */}
        <nav className="profile-nav">
          <ul>
            <li>
              <Link href="/mis-compras" className="profile-item">
                Mis Compras <span className="arrow">›</span>
              </Link>
            </li>
            <li>
              <Link href="#" className="profile-item">
                Información de Pago <span className="arrow">›</span>
              </Link>
            </li>
            <li>
              <Link href="/configuration" className="profile-item">
                Configuraciones <span className="arrow">›</span>
              </Link>
            </li>
            <li>
              <Link href="/developer" className="profile-item">
                Actualizar a desarrollador <span className="arrow">›</span>
              </Link>
            </li>
          </ul>
        </nav>

        <hr className="divider" />

        <nav className="profile-nav">
          <ul>
            <li>
              <button onClick={handleLogout} className="profile-item logout">
                Cerrar sesión <span className="arrow">›</span>
              </button>
            </li>
          </ul>
        </nav>
      </main>

      <style jsx>{`
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
          background: #fff;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .back-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          text-decoration: none;
          color: #111;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .brand-mark {
          border-radius: 50%;
        }

        .brand-name a {
          text-decoration: none;
          color: #111;
        }

        .main {
          padding: 16px;
          max-width: 600px;
          margin: 0 auto;
        }

        .profile-title {
          font-size: 1.4rem;
          font-weight: 700;
          text-align: center;
          margin: 16px 0;
        }

        .profile-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
        }

        .profile-avatar {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          object-fit: cover;
        }

        .profile-username {
          font-size: 0.95rem;
          color: #555;
        }

        .edit-btn {
          background: none;
          border: none;
          font-size: 1rem;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .edit-btn:hover {
          background-color: #f0f0f0;
        }

        .profile-details {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .detail-item:last-child {
          border-bottom: none;
        }

        .detail-label {
          font-weight: 500;
          color: #666;
          font-size: 0.9rem;
        }

        .detail-value {
          color: #111;
          font-size: 0.9rem;
          text-align: right;
          max-width: 60%;
          word-break: break-word;
        }

        .profile-nav ul {
          list-style: none;
          margin: 16px 0;
          padding: 0;
        }

        .profile-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f1f2f4;
          padding: 14px 16px;
          border-radius: 12px;
          margin-bottom: 12px;
          text-decoration: none;
          color: #111;
          font-weight: 500;
          transition: background 0.2s ease;
          border: none;
          width: 100%;
          cursor: pointer;
          font-size: 1rem;
        }

        .profile-item:hover {
          background: #e5e6ea;
        }

        .profile-item.logout {
          color: #d33;
        }

        .arrow {
          font-size: 1.2rem;
          color: #888;
        }

        .divider {
          border: none;
          border-top: 1px solid #eee;
          margin: 20px 0;
        }

        @media (min-width: 769px) {
          .main {
            padding: 24px;
          }
        }
      `}</style>
    </>
  );
}
