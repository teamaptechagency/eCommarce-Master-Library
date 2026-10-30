// The supplied Supabase fallback runs locally in Master Library. Remote project
// URLs and keys are intentionally not bundled into this local preview.
export const supabase: any = null;
export const isSupabaseConfigured = false;
export const IMAGE_BUCKET = 'local-demo-images';
export const fetchUserRoleFromDatabase = async (_userId?: string | null, _email?: string | null): Promise<'admin' | 'user'> => {
  const response = await fetch('/__master/session', { credentials: 'same-origin' });
  if (!response.ok) return 'user';
  const session = await response.json();
  return session.user?.role === 'admin' ? 'admin' : 'user';
};
export const uploadImageToSupabase = async (file: File): Promise<string> => {
  if (file.size > 5 * 1024 * 1024) throw new Error('Maximum image size is 5 MB');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP image');
  return new Promise((resolve,reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image')); reader.readAsDataURL(file);
  });
};
