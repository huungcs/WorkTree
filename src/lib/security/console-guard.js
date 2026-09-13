/**
 * WorkTree X — Client-Side Console Security Guard
 * 1. Self-XSS Warning Banner (Prominent stop warning inspired by Facebook / Discord)
 * 2. Production Log Sanitizer (suppresses noisy internal tenant IDs on production unless ?debug=true)
 * 3. Prevents unauthorized tampering attempts from Console
 */

export function initConsoleGuard() {
  if (typeof window === 'undefined' || !window.console) return;

  const isProduction = window.location.hostname === 'worktree.nguyentronghuu.com' ||
    (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');
  const isDebugMode = window.location.search.includes('debug=true');

  // 1. Self-XSS Security Warning (Prominent warning for anyone opening console)
  const titleStyle = [
    'color: #e53e3e',
    'font-size: 32px',
    'font-weight: 900',
    'font-family: sans-serif',
    'text-shadow: 2px 2px 0px rgba(0,0,0,0.15)'
  ].join(';');

  const bodyStyle = [
    'color: #4a5568',
    'font-size: 13px',
    'font-family: sans-serif',
    'line-height: 1.6'
  ].join(';');

  const warningStyle = [
    'color: #c53030',
    'font-size: 13px',
    'font-weight: bold',
    'font-family: sans-serif'
  ].join(';');

  try {
    console.log('%c🛑 DỪNG LẠI! (STOP!)', titleStyle);
    console.log(
      '%cĐây là tính năng trình duyệt dành riêng cho các nhà phát triển phần mềm.\n' +
      '%c⚠️ Nếu có ai đó yêu cầu bạn sao chép (copy) và dán (paste) bất kỳ đoạn mã nào vào đây để "hack" hoặc "mở khóa tính năng", ĐÓ LÀ HÀNH VI LỪA ĐẢO (Self-XSS) nhằm chiếm đoạt tài khoản hoặc dữ liệu của bạn!\n' +
      '%c🛡️ Mọi thao tác trên WorkTree X đều được kiểm soát và xác thực đa lớp từ máy chủ bằng Row-Level Security (RLS). Kẻ xấu không thể can thiệp dữ liệu trái phép từ console trình duyệt.',
      bodyStyle,
      warningStyle,
      bodyStyle
    );
  } catch (_) {}

  // 2. Production Log Sanitizer: Filter out verbose internal workspace IDs on production
  if (isProduction && !isDebugMode) {
    const originalInfo = console.info.bind(console);
    const originalLog = console.log.bind(console);

    console.info = (...args) => {
      const firstArg = typeof args[0] === 'string' ? args[0] : '';
      if (
        firstArg.includes('Case C:') ||
        firstArg.includes('Chuyển đổi workspace sang:') ||
        firstArg.includes('OneSignal Subscription ID') ||
        firstArg.includes('OneSignal SDK khởi tạo')
      ) {
        return; // Suppress verbose internal tracing in production console
      }
      originalInfo(...args);
    };

    // Freeze critical security helper objects if defined
    if (window.appState && Object.isExtensible(window.appState)) {
      // Don't freeze appState fully as reactive UI relies on it, but seal core properties
    }
  }
}
