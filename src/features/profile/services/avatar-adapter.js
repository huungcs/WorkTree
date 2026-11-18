import { getSupabase } from '../../../lib/supabase/client.js';

export function createProfileAvatarAdapter({ getClient = getSupabase } = {}) {
  async function invoke(body) {
    const client = await getClient();
    const { data, error } = await client.functions.invoke('profile-avatar', { body });
    if (error) {
      const unavailable = [404, 501].includes(error.context?.status);
      throw new Error(unavailable
        ? 'Tính năng lưu ảnh hồ sơ chưa được kết nối trên máy chủ.'
        : 'Chưa lưu hoặc tải được ảnh hồ sơ. Bạn thử lại nhé.');
    }

    let url;
    try { url = new URL(data?.avatarUrl); } catch { /* Use the same UI error for invalid or missing URLs. */ }
    if (url?.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Máy chủ chưa trả về ảnh hồ sơ hợp lệ.');
    }
    return url.href;
  }

  return {
    resolve: () => invoke({ action: 'resolve' }),
    save(file) {
      const body = new FormData();
      body.append('action', 'save');
      body.append('file', file);
      return invoke(body);
    }
  };
}
