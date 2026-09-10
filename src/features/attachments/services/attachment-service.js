/**
 * WorkTree X Feature: Attachment Service
 * Authoritative cloud operations for task attachments and Supabase Storage.
 * Invariants:
 *  - Canonical Storage bucket: 'worktree-files' (PRIVATE, max 50MB).
 *  - Canonical path: <organization_uuid>/<task_uuid>/<random-id>-<safe-filename>.
 *  - Upsert = false strictly enforced.
 *  - Metadata authority: public.task_attachments.
 *  - Compensating cleanup on metadata insert failure.
 *  - Strict tenant isolation and task collaborate/manage permissions.
 */

import {
  AttachmentRepository,
  CANONICAL_STORAGE_BUCKET,
  STORAGE_MAX_FILE_SIZE
} from '../../../lib/supabase/repositories.js';
import { appState } from '../../../app/state.js';

const uploadingFiles = new Set();

/**
 * Chuẩn hóa tên file thành chuỗi an toàn, loại bỏ ký tự điều khiển,
 * path traversal và dấu phân tách thư mục (\, /).
 */
export function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return 'attachment.bin';
  // 1. Loại bỏ control chars
  let clean = fileName.replace(/[\x00-\x1f\x7f]/g, '');
  // 2. Tách chỉ lấy tên file cuối cùng (ngăn ngừa c:\path\file hoặc ../../file)
  clean = clean.split(/[\\/]/).filter(Boolean).pop() || 'attachment.bin';
  // 3. Loại bỏ ký tự path traversal còn sót
  clean = clean.replace(/\.\.+/g, '.');
  // 4. Thay thế ký tự nguy hiểm thành ký tự an toàn
  clean = clean.replace(/[<>:"|?*]/g, '_');
  // 5. Cắt ngắn tối đa 255 ký tự (phù hợp check constraint của public.task_attachments)
  if (clean.length > 255) {
    const extIdx = clean.lastIndexOf('.');
    if (extIdx > 0 && clean.length - extIdx <= 10) {
      const ext = clean.slice(extIdx);
      clean = clean.slice(0, 255 - ext.length) + ext;
    } else {
      clean = clean.slice(0, 255);
    }
  }
  return clean.trim() || 'attachment.bin';
}

/**
 * Định dạng dung lượng tệp đọc được
 */
export function formatFileSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '0 B';
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Chuyển đổi mã lỗi Supabase / Network sang thông báo thân thiện với người dùng
 */
export function formatAttachmentErrorMessage(error) {
  if (!error) return 'Đã xảy ra lỗi không xác định.';
  const msg = error.message || String(error);

  if (msg.includes('50 MB') || msg.includes('file_size_limit') || msg.includes('exceeded the maximum allowed size')) {
    return 'Tệp vượt quá giới hạn 50 MB.';
  }
  if (error.code === '42501' || msg.includes('permission denied') || msg.includes('violates row-level security') || msg.includes('security policy')) {
    return 'Bạn không có quyền tải tệp lên công việc này.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('mạng') || msg.includes('offline')) {
    return 'Không thể kết nối máy chủ. Vui lòng thử lại.';
  }
  if (msg.includes('The resource was not found') || msg.includes('Object not found') || msg.includes('404')) {
    return 'Tệp không còn tồn tại trên máy chủ.';
  }
  return msg;
}

export const AttachmentService = {
  /**
   * Lấy danh sách tệp đính kèm theo task_id và organization_id
   */
  async getAttachments(taskId, organizationId = null) {
    if (!taskId) return [];
    const orgId = organizationId || appState.activeOrganizationId;
    return await AttachmentRepository.getAttachments(taskId, orgId);
  },

  /**
   * Upload tệp đính kèm lên Supabase Storage và lưu metadata
   * Luồng bảo vệ:
   * 1. Kiểm tra offline
   * 2. Kiểm tra dung lượng (<= 50MB)
   * 3. Khóa chống submit trùng lặp
   * 4. Upload binary lên bucket 'worktree-files' với upsert = false
   * 5. Lưu metadata vào task_attachments
   * 6. Compensating transaction nếu metadata insert thất bại -> dọn object storage
   */
  async uploadAttachment({ taskId, file, organizationId = null, userId = null }) {
    if (!taskId) throw new Error('Thiếu taskId.');
    if (!file) throw new Error('Vui lòng chọn tệp để tải lên.');

    // 1. Kiểm tra offline
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Bạn đang ngoại tuyến. Kết nối mạng để tải tệp lên.');
    }

    // 2. Validate kích thước tệp
    if (file.size > STORAGE_MAX_FILE_SIZE) {
      throw new Error('Tệp vượt quá giới hạn 50 MB.');
    }

    const orgId = organizationId || appState.activeOrganizationId;
    if (!orgId) throw new Error('Thiếu activeOrganizationId.');

    // 3. Khóa chống trùng lặp upload
    const uploadKey = `${taskId}:${file.name}:${file.size}`;
    if (uploadingFiles.has(uploadKey)) {
      throw new Error('Đang tải tệp lên, vui lòng đợi...');
    }
    uploadingFiles.add(uploadKey);

    const safeName = sanitizeFileName(file.name);
    const randomId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now().toString(36));
    const storagePath = `${orgId}/${taskId}/${randomId}-${safeName}`;

    let objectUploaded = false;

    try {
      // 4. Upload Storage Object (upsert = false)
      await AttachmentRepository.uploadStorageObject(storagePath, file, {
        contentType: file.type || 'application/octet-stream'
      });
      objectUploaded = true;

      // 5. Lưu metadata vào DB
      const metadata = await AttachmentRepository.insertMetadata({
        organizationId: orgId,
        taskId,
        storagePath,
        originalName: safeName,
        mimeType: file.type || null,
        sizeBytes: file.size,
        uploadedBy: userId || null
      });

      return metadata;
    } catch (err) {
      // 6. Giao dịch đền bù (Compensating transaction) nếu upload object thành công nhưng insert metadata thất bại
      if (objectUploaded) {
        console.warn('Đang thực hiện dọn dẹp object mồ côi sau khi lưu metadata thất bại:', storagePath);
        try {
          await AttachmentRepository.deleteStorageObject(storagePath);
          console.info('Đã dọn dẹp thành công object mồ côi:', storagePath);
        } catch (cleanupErr) {
          console.error('Không thể dọn dẹp object mồ côi:', storagePath, cleanupErr);
          throw new Error('Tệp đã được tải lên nhưng chưa thể hoàn tất lưu thông tin. Hệ thống đang dọn tệp tạm.');
        }
      }
      throw new Error(formatAttachmentErrorMessage(err));
    } finally {
      uploadingFiles.delete(uploadKey);
    }
  },

  /**
   * Tải tệp xuống từ Supabase Storage bằng session người dùng hiện tại
   * Trả về Blob và tùy chọn kích hoạt tải về trên trình duyệt
   */
  async downloadAttachment(attachment, { triggerBrowserDownload = true } = {}) {
    if (!attachment || !attachment.storage_path) {
      throw new Error('Thiếu thông tin đường dẫn tệp để tải về.');
    }

    try {
      const blob = await AttachmentRepository.downloadStorageObject(attachment.storage_path);
      if (triggerBrowserDownload && typeof window !== 'undefined' && typeof document !== 'undefined') {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.original_name || 'attachment';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          } catch (e) {}
        }, 2000);
      }
      return blob;
    } catch (err) {
      throw new Error(formatAttachmentErrorMessage(err));
    }
  },

  /**
   * Xóa tệp đính kèm:
   * 1. Xóa metadata row trước (kiểm tra RLS DB)
   * 2. Xóa object trên Storage (kiểm tra Storage RLS)
   */
  async deleteAttachment({ attachmentId, storagePath, organizationId = null }) {
    if (!attachmentId) throw new Error('Thiếu attachmentId.');
    const orgId = organizationId || appState.activeOrganizationId;

    try {
      // Xóa metadata trước
      await AttachmentRepository.deleteMetadata(attachmentId, orgId);

      // Nếu metadata xóa thành công, xóa object trên Storage
      if (storagePath) {
        try {
          await AttachmentRepository.deleteStorageObject(storagePath);
        } catch (storageErr) {
          console.warn('Lỗi khi xóa object storage (metadata đã bị xóa):', storagePath, storageErr);
        }
      }

      return { success: true };
    } catch (err) {
      throw new Error(formatAttachmentErrorMessage(err));
    }
  }
};
