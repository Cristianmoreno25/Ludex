// Configuración de Supabase para archivos HTML estáticos
// Este archivo se debe actualizar con las credenciales reales de tu proyecto

window.SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co', // Reemplaza con tu URL real
  anonKey: 'your-anon-key' // Reemplaza con tu clave anónima real
};

// Función para obtener la configuración
window.getSupabaseConfig = function() {
  return window.SUPABASE_CONFIG;
};
