const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export function mountProfileAvatar({ dialog, getContext, subscribeContext, adapter, onChange }) {
  let scope;
  let savedUrl = null;
  let objectUrl = null;
  let draft = null;
  let request = 0;
  let selection = 0;
  let saving = false;
  let loading = false;

  const editor = () => dialog.querySelector('[data-profile-avatar-editor]');
  const field = () => editor()?.querySelector('[type="file"]');
  const status = () => editor()?.querySelector('[role="status"]');
  const setStatus = message => { if (status()) status().textContent = message; };

  function render() {
    const panel = editor();
    const preview = dialog.querySelector('[data-profile-avatar-preview]');
    if (preview) {
      const url = objectUrl || savedUrl;
      const image = preview.querySelector('img');
      if (!url) image?.remove();
      else if (image?.getAttribute('src') !== url) {
        const next = document.createElement('img');
        next.alt = '';
        next.addEventListener('error', () => next.remove(), { once: true });
        next.src = url;
        preview.append(next);
        image?.remove();
      }
    }
    if (!panel) return;
    panel.hidden = !scope?.userId;
    panel.querySelector('[data-profile-avatar-pick]').disabled = saving;
    panel.querySelector('[data-profile-avatar-cancel]').hidden = !draft;
    panel.querySelector('[data-profile-avatar-cancel]').disabled = saving;
    const save = panel.querySelector('[data-profile-avatar-save]');
    save.hidden = !draft;
    save.disabled = saving || loading;
    save.textContent = saving ? 'Đang lưu…' : 'Lưu ảnh';
  }

  function discard() {
    ++selection;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    draft = null;
    if (field()) field().value = '';
  }

  async function contextChanged() {
    const next = getContext();
    if (scope?.userId === next?.userId && scope?.avatarPath === next?.avatarPath) return;
    const generation = ++request;
    scope = next;
    discard();
    savedUrl = null;
    saving = false;
    loading = Boolean(next?.userId && next.avatarPath);
    onChange(null);
    render();
    if (!loading) return;
    try {
      const url = await adapter.resolve();
      if (request !== generation) return;
      savedUrl = url;
      onChange(url);
    } catch {
      if (request === generation) setStatus('Chưa tải được ảnh hồ sơ hiện tại.');
    } finally {
      if (request === generation) { loading = false; render(); }
    }
  }

  dialog.addEventListener('click', async event => {
    if (event.target.closest('[data-profile-avatar-pick]')) {
      field()?.click();
      return;
    }
    if (event.target.closest('[data-profile-avatar-cancel]')) {
      discard();
      render();
      setStatus('');
      editor()?.querySelector('[data-profile-avatar-pick]').focus();
      return;
    }
    if (!event.target.closest('[data-profile-avatar-save]') || !draft || saving || loading) return;
    const generation = request;
    saving = true;
    render();
    setStatus('Đang lưu ảnh đại diện…');
    try {
      const url = await adapter.save(draft);
      if (request !== generation) return;
      savedUrl = url;
      discard();
      onChange(url);
      setStatus('Đã lưu ảnh đại diện.');
    } catch (error) {
      if (request === generation) setStatus(error.message);
    } finally {
      if (request === generation) { saving = false; render(); }
    }
  });

  dialog.addEventListener('change', async event => {
    if (!event.target.matches('[data-profile-avatar-file]')) return;
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type) || !file.size || file.size > MAX_BYTES) {
      setStatus('Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.');
      return;
    }

    const generation = request;
    const picking = ++selection;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
    } catch {
      URL.revokeObjectURL(url);
      if (request === generation && picking === selection) setStatus('Không đọc được ảnh này. Hãy chọn ảnh khác.');
      return;
    }
    if (request !== generation || picking !== selection || !dialog.open || saving) { URL.revokeObjectURL(url); return; }
    discard();
    draft = file;
    objectUrl = url;
    render();
    setStatus('Kiểm tra ảnh xem trước rồi bấm Lưu ảnh.');
  });

  dialog.addEventListener('close', () => {
    if (!saving) discard();
  });
  document.addEventListener('worktree:profile-opened', render);
  subscribeContext(contextChanged);
  contextChanged();
}
