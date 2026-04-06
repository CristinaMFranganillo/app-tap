export const environment = {
  production: false,
  supabaseUrl: ((import.meta as any).env?.['VITE_SUPABASE_URL'] ?? '') as string,
  supabaseAnonKey: ((import.meta as any).env?.['VITE_SUPABASE_ANON_KEY'] ?? '') as string,
};
