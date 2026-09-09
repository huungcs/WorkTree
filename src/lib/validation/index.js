/**
 * WorkTree X Validation Helpers
 */

export function validateOrgSlug(slug) {
  if (!slug || slug.length < 3) return 'Mã định danh (slug) phải có ít nhất 3 ký tự.';
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang.';
  return null;
}

export function validateTaskTitle(title) {
  if (!title || !title.trim()) return 'Tiêu đề công việc không được để trống.';
  if (title.trim().length > 255) return 'Tiêu đề công việc không được vượt quá 255 ký tự.';
  return null;
}

export function validateEmail(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Địa chỉ email không hợp lệ.';
  }
  return null;
}
