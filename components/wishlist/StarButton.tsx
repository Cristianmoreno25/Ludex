// components/wishlist/StarButton.tsx
'use client';

import React, { useState } from 'react';

type Props = {
  juegoId: number;
  initial?: boolean;
};

function StarOutlineIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 17.3l6.18 3.73-1.64-7.03L21 9.24l-7.19-.62L12 2 10.19 8.62 3 9.24l4.46 4.76L5.82 21z" />
    </svg>
  );
}

function StarSolidIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .587l3.668 7.431 8.2.663-5.934 5.036 1.771 8.013L12 18.897 4.295 22.73 6.066 14.72.132 9.684l8.2-.663L12 .587z" />
    </svg>
  );
}

export default function StarButton({ juegoId, initial = false }: Props) {
  const [wished, setWished] = useState<boolean>(initial);
  const [loading, setLoading] = useState(false);

  const showMessage = (msg: string) => {
    // Usa tu toast si existe; fallback DOM
    if ((window as any).__toast__) {
      (window as any).__toast__(msg);
      return;
    }
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.position = 'fixed';
    el.style.bottom = '20px';
    el.style.right = '20px';
    el.style.padding = '10px 14px';
    el.style.background = '#0b74ff';
    el.style.color = '#fff';
    el.style.borderRadius = '8px';
    el.style.zIndex = '9999';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (!wished) {
        const res = await fetch('/api/lista-deseos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ juegoId }),
        });
        if (res.status === 401) {
          // Mantener comportamiento: redirigir a login
          window.location.href = '/html/login.html';
          return;
        }
        const payload = await res.json();
        if (!res.ok && payload?.error) throw new Error(payload?.error?.message ?? payload?.error);
        setWished(true);
        showMessage(payload?.message ?? 'Añadido a la lista de deseos');
      } else {
        const res = await fetch(`/api/lista-deseos?juegoId=${juegoId}`, { method: 'DELETE' });
        if (res.status === 401) {
          window.location.href = '/html/login.html';
          return;
        }
        const payload = await res.json();
        if (!res.ok && payload?.error) throw new Error(payload?.error?.message ?? payload?.error);
        setWished(false);
        showMessage(payload?.message ?? 'Eliminado de la lista de deseos');
      }
    } catch (err: any) {
      console.error('Wishlist toggle error', err);
      showMessage(err?.message ?? 'Error al actualizar la lista de deseos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      aria-pressed={wished}
      aria-label={wished ? 'Eliminar de la lista de deseos' : 'Añadir a la lista de deseos'}
      onClick={toggle}
      title={wished ? 'En lista de deseos' : 'Añadir a lista de deseos'}
      className="p-2 rounded-full inline-flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700"
      disabled={loading}
    >
      {wished ? <StarSolidIcon /> : <StarOutlineIcon />}
    </button>
  );
}
