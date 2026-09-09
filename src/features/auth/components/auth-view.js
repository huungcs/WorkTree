/**
 * WorkTree X Feature: Auth View Component
 * Renders the authoritative Supabase Auth screen (Login, Signup, Forgot Password, Recovery).
 * Preserves 100% of WorkTree X visual identity, design tokens, and responsive behavior.
 */

import { AuthService } from '../services/auth-service.js';

// SVG Icon Helper adhering to WorkTree X 1.7px stroke line icon standard
const SVG_ICONS = {
  logo: `<svg viewBox="0 0 32 32" fill="none" class="icon" aria-hidden="true"><path d="M7 8v9a6 6 0 006 6h12M16 5v18M25 10v13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="7" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="6" r="3" fill="currentColor"/><circle cx="25" cy="10" r="3" fill="currentColor"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-5-5 2-2m-5-1 2-2"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="m16 3 5 5-4 2-3 6-3-3-6 6-1-1 6-6-3-3 6-3Z"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></svg>`,
  spinner: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon icon-spin" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>`
};

export class AuthView {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('authScreen');
    this.onAuthenticated = options.onAuthenticated || (() => {});
    this.currentMode = 'login'; // 'login' | 'signup' | 'forgot' | 'recovery' | 'confirm_pending'
    this.isSubmitting = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Render giao diện Auth theo chế độ chỉ định
   * @param {'login'|'signup'|'forgot'|'recovery'|'confirm_pending'} mode
   * @param {Object} [params]
   */
  render(mode = 'login', params = {}) {
    if (!this.container) return;
    this.currentMode = mode;
    this.errorMessage = params.error || '';
    this.successMessage = params.success || '';

    // Render khung ngoài
    this.container.innerHTML = `
      <div class="auth-brand">
        <div class="auth-logo">${SVG_ICONS.logo}</div>
        <strong>WorkTree<span>X</span></strong>
        <span class="auth-version">CLOUD SAAS · MULTI-TENANT</span>
      </div>

      <div class="auth-layout">
        <!-- Cột thông tin thương hiệu (Desktop hiển thị, Mobile ẩn qua media query) -->
        <div class="auth-story">
          <p class="auth-eyebrow">WORK TOGETHER. STAY FOCUSED.</p>
          <h1>Đúng người.<br>Đúng việc.<br>Đúng ưu tiên.</h1>
          <p class="auth-description">Hệ thống điều hành công việc và quản trị doanh nghiệp đa tổ chức, vận hành an toàn trên nền tảng Supabase Cloud.</p>
          
          <div class="auth-illustration">
            <div class="auth-mini-top">
              ${SVG_ICONS.pin}<span>Ghim ưu tiên</span>
              <small>Cá nhân hóa</small>
            </div>
            <div class="auth-focus-card">
              <span class="auth-card-icon">${SVG_ICONS.flag}</span>
              <div>
                <strong>Nhiệm vụ trọng tâm</strong>
                <small>Chiến lược & vận hành</small>
              </div>
              <span class="auth-ready">01</span>
            </div>
            <div class="auth-thread"></div>
            <div class="auth-roles">
              <span>${SVG_ICONS.shield} Quản trị viên</span>
              <span>${SVG_ICONS.user} Quản lý</span>
              <span>${SVG_ICONS.user} Nhân viên</span>
            </div>
          </div>
          
          <p class="auth-story-footer">
            ${SVG_ICONS.shield} Xác thực bảo mật qua Supabase Auth · Mã hóa Row-Level Security
          </p>
        </div>

        <!-- Thẻ biểu mẫu tương tác -->
        <div class="auth-card" id="authCard">
          ${this.renderCardContent()}
        </div>
      </div>

      <footer class="auth-footer">
        <span>WorkTree X · Nền tảng điều hành công việc đa doanh nghiệp</span>
        <span>Xác thực GoTrue · PostgreSQL 15+</span>
      </footer>
    `;

    this.container.hidden = false;
    this.attachEvents();
  }

  /**
   * Tạo nội dung bên trong thẻ .auth-card dựa trên currentMode
   */
  renderCardContent() {
    switch (this.currentMode) {
      case 'signup':
        return this.renderSignupForm();
      case 'forgot':
        return this.renderForgotForm();
      case 'recovery':
        return this.renderRecoveryForm();
      case 'confirm_pending':
        return this.renderConfirmPending();
      case 'login':
      default:
        return this.renderLoginForm();
    }
  }

  /**
   * Tab switcher giữa Đăng nhập và Đăng ký
   */
  renderTabs() {
    return `
      <div class="auth-tabs" role="tablist" style="display:flex;gap:12px;margin-bottom:20px;border-bottom:1px solid var(--line);">
        <button type="button" role="tab" class="auth-tab-btn ${this.currentMode === 'login' ? 'is-active' : ''}" data-auth-mode="login" style="background:none;border:none;padding:8px 4px 12px;font-size:14px;font-weight:${this.currentMode === 'login' ? '650' : '400'};color:${this.currentMode === 'login' ? 'var(--primary-text)' : 'var(--muted)'};border-bottom:2px solid ${this.currentMode === 'login' ? 'var(--primary)' : 'transparent'};cursor:pointer;">
          Đăng nhập
        </button>
        <button type="button" role="tab" class="auth-tab-btn ${this.currentMode === 'signup' ? 'is-active' : ''}" data-auth-mode="signup" style="background:none;border:none;padding:8px 4px 12px;font-size:14px;font-weight:${this.currentMode === 'signup' ? '650' : '400'};color:${this.currentMode === 'signup' ? 'var(--primary-text)' : 'var(--muted)'};border-bottom:2px solid ${this.currentMode === 'signup' ? 'var(--primary)' : 'transparent'};cursor:pointer;">
          Đăng ký tài khoản
        </button>
      </div>
    `;
  }

  /**
   * Biểu mẫu Đăng nhập
   */
  renderLoginForm() {
    return `
      <div class="auth-card-header">
        <span class="auth-chip">${SVG_ICONS.shield} Tài khoản WorkTree X</span>
        <h2>Chào mừng trở lại.</h2>
        <p>Đăng nhập bằng email để vào không gian làm việc của bạn.</p>
      </div>

      ${this.renderTabs()}

      <div class="form-error" id="authError" role="alert" ${this.errorMessage ? '' : 'hidden'}>
        ${this.errorMessage}
      </div>
      ${this.successMessage ? `<div class="form-success" role="status" style="background:var(--green-soft);color:var(--green);padding:10px 14px;border-radius:8px;font-size:12px;margin-bottom:14px;">${this.successMessage}</div>` : ''}

      <form id="loginForm" autocomplete="on">
        <div class="auth-fields">
          <label class="field">
            <span>Email đăng nhập <span class="required" style="color:var(--red);">*</span></span>
            <input id="loginEmail" type="email" required autocomplete="username" placeholder="name@company.com" spellcheck="false" ${this.isSubmitting ? 'disabled' : ''}>
          </label>

          <label class="field">
            <span>Mật khẩu <span class="required" style="color:var(--red);">*</span></span>
            <span class="password-wrap">
              <input id="loginPassword" type="password" required autocomplete="current-password" placeholder="••••••••" ${this.isSubmitting ? 'disabled' : ''}>
              <button type="button" class="icon-btn" data-auth-action="toggle-password" data-target="loginPassword" aria-label="Hiện / ẩn mật khẩu" title="Hiện / ẩn mật khẩu">
                ${SVG_ICONS.eye}
              </button>
            </span>
          </label>
        </div>

        <button type="submit" id="loginSubmit" class="btn primary auth-submit" ${this.isSubmitting ? 'disabled' : ''}>
          <span>${this.isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
          ${this.isSubmitting ? SVG_ICONS.spinner : SVG_ICONS.arrowRight}
        </button>
      </form>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;">
        <button type="button" class="link-btn auth-forgot" data-auth-mode="forgot" style="background:none;border:none;padding:0;color:var(--primary-text);font-size:12px;cursor:pointer;">
          Quên mật khẩu?
        </button>
      </div>

      <div class="auth-local-note">
        ${SVG_ICONS.shield}
        <p>Phiên làm việc được bảo mật và tự động gia hạn an toàn qua Supabase GoTrue token.</p>
      </div>
    `;
  }

  /**
   * Biểu mẫu Đăng ký (STRICTLY NO role selector!)
   */
  renderSignupForm() {
    return `
      <div class="auth-card-header">
        <span class="auth-chip">${SVG_ICONS.key} Tạo tài khoản mới</span>
        <h2>Tham gia WorkTree X</h2>
        <p>Đăng ký tài khoản cá nhân để gia nhập tổ chức làm việc.</p>
      </div>

      ${this.renderTabs()}

      <div class="form-error" id="authError" role="alert" ${this.errorMessage ? '' : 'hidden'}>
        ${this.errorMessage}
      </div>

      <form id="signupForm" autocomplete="on">
        <div class="auth-fields">
          <label class="field">
            <span>Họ và tên <span class="required" style="color:var(--red);">*</span></span>
            <input id="signupFullName" type="text" required maxlength="180" autocomplete="name" placeholder="Nguyễn Văn A" ${this.isSubmitting ? 'disabled' : ''}>
          </label>

          <label class="field">
            <span>Email công việc <span class="required" style="color:var(--red);">*</span></span>
            <input id="signupEmail" type="email" required autocomplete="email" placeholder="name@company.com" spellcheck="false" ${this.isSubmitting ? 'disabled' : ''}>
          </label>

          <label class="field">
            <span>Mật khẩu <span class="required" style="color:var(--red);">*</span></span>
            <span class="password-wrap">
              <input id="signupPassword" type="password" required minlength="6" autocomplete="new-password" placeholder="Tối thiểu 6 ký tự" ${this.isSubmitting ? 'disabled' : ''}>
              <button type="button" class="icon-btn" data-auth-action="toggle-password" data-target="signupPassword" aria-label="Hiện / ẩn mật khẩu" title="Hiện / ẩn mật khẩu">
                ${SVG_ICONS.eye}
              </button>
            </span>
          </label>

          <label class="field">
            <span>Xác nhận mật khẩu <span class="required" style="color:var(--red);">*</span></span>
            <span class="password-wrap">
              <input id="signupConfirmPassword" type="password" required minlength="6" autocomplete="new-password" placeholder="Nhập lại mật khẩu" ${this.isSubmitting ? 'disabled' : ''}>
              <button type="button" class="icon-btn" data-auth-action="toggle-password" data-target="signupConfirmPassword" aria-label="Hiện / ẩn mật khẩu" title="Hiện / ẩn mật khẩu">
                ${SVG_ICONS.eye}
              </button>
            </span>
          </label>
        </div>

        <p class="field-hint" style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.6;">
          Vai trò thành viên và quyền hạn được cấp tự động khi tham gia tổ chức hoặc khởi tạo không gian mới.
        </p>

        <button type="submit" id="signupSubmit" class="btn primary auth-submit" ${this.isSubmitting ? 'disabled' : ''}>
          <span>${this.isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}</span>
          ${this.isSubmitting ? SVG_ICONS.spinner : SVG_ICONS.arrowRight}
        </button>
      </form>

      <div class="auth-local-note">
        ${SVG_ICONS.shield}
        <p>Tài khoản tuân thủ quy chế bảo vệ dữ liệu SaaS. Thông tin định danh được bảo mật độc lập.</p>
      </div>
    `;
  }

  /**
   * Biểu mẫu Quên mật khẩu
   */
  renderForgotForm() {
    return `
      <div class="auth-card-header">
        <span class="auth-chip">${SVG_ICONS.mail} Khôi phục quyền truy cập</span>
        <h2>Quên mật khẩu?</h2>
        <p>Nhập địa chỉ email đăng ký để nhận liên kết đặt lại mật khẩu an toàn.</p>
      </div>

      <div class="form-error" id="authError" role="alert" ${this.errorMessage ? '' : 'hidden'}>
        ${this.errorMessage}
      </div>
      ${this.successMessage ? `<div class="form-success" role="status" style="background:var(--green-soft);color:var(--green);padding:12px;border-radius:8px;font-size:12px;margin-bottom:14px;line-height:1.6;">${this.successMessage}</div>` : ''}

      <form id="forgotForm" autocomplete="on">
        <div class="auth-fields">
          <label class="field">
            <span>Email của bạn <span class="required" style="color:var(--red);">*</span></span>
            <input id="forgotEmail" type="email" required autocomplete="email" placeholder="name@company.com" spellcheck="false" ${this.isSubmitting ? 'disabled' : ''}>
          </label>
        </div>

        <button type="submit" id="forgotSubmit" class="btn primary auth-submit" ${this.isSubmitting ? 'disabled' : ''}>
          <span>${this.isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi liên kết khôi phục'}</span>
          ${this.isSubmitting ? SVG_ICONS.spinner : SVG_ICONS.mail}
        </button>
      </form>

      <div style="margin-top:16px;text-align:center;">
        <button type="button" class="link-btn" data-auth-mode="login" style="background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;">
          ← Quay lại màn hình Đăng nhập
        </button>
      </div>
    `;
  }

  /**
   * Biểu mẫu Đặt lại mật khẩu mới khi trong flow PASSWORD_RECOVERY
   */
  renderRecoveryForm() {
    return `
      <div class="auth-card-header">
        <span class="auth-chip">${SVG_ICONS.key} Thiết lập bảo mật</span>
        <h2>Đặt lại mật khẩu mới</h2>
        <p>Tạo mật khẩu mới cho tài khoản của bạn để tiếp tục truy cập.</p>
      </div>

      <div class="form-error" id="authError" role="alert" ${this.errorMessage ? '' : 'hidden'}>
        ${this.errorMessage}
      </div>

      <form id="recoveryForm">
        <div class="auth-fields">
          <label class="field">
            <span>Mật khẩu mới <span class="required" style="color:var(--red);">*</span></span>
            <span class="password-wrap">
              <input id="recoveryPassword" type="password" required minlength="6" autocomplete="new-password" placeholder="Tối thiểu 6 ký tự" ${this.isSubmitting ? 'disabled' : ''}>
              <button type="button" class="icon-btn" data-auth-action="toggle-password" data-target="recoveryPassword" aria-label="Hiện / ẩn mật khẩu" title="Hiện / ẩn mật khẩu">
                ${SVG_ICONS.eye}
              </button>
            </span>
          </label>

          <label class="field">
            <span>Xác nhận mật khẩu mới <span class="required" style="color:var(--red);">*</span></span>
            <span class="password-wrap">
              <input id="recoveryConfirmPassword" type="password" required minlength="6" autocomplete="new-password" placeholder="Nhập lại mật khẩu mới" ${this.isSubmitting ? 'disabled' : ''}>
              <button type="button" class="icon-btn" data-auth-action="toggle-password" data-target="recoveryConfirmPassword" aria-label="Hiện / ẩn mật khẩu" title="Hiện / ẩn mật khẩu">
                ${SVG_ICONS.eye}
              </button>
            </span>
          </label>
        </div>

        <button type="submit" id="recoverySubmit" class="btn primary auth-submit" ${this.isSubmitting ? 'disabled' : ''}>
          <span>${this.isSubmitting ? 'Đang lưu...' : 'Lưu mật khẩu mới'}</span>
          ${this.isSubmitting ? SVG_ICONS.spinner : SVG_ICONS.arrowRight}
        </button>
      </form>
    `;
  }

  /**
   * Trạng thái thông báo: Đăng ký thành công + yêu cầu xác nhận email
   */
  renderConfirmPending() {
    return `
      <div class="auth-card-header">
        <span class="auth-chip" style="background:var(--green-soft);color:var(--green);">${SVG_ICONS.checkCircle} Đăng ký thành công</span>
        <h2>Xác nhận địa chỉ email</h2>
        <p>Chúng tôi đã gửi một liên kết kích hoạt tài khoản đến hòm thư của bạn.</p>
      </div>

      <div style="background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
        <div style="display:inline-flex;padding:12px;background:var(--green-soft);color:var(--green);border-radius:50%;margin-bottom:12px;">
          ${SVG_ICONS.mail}
        </div>
        <h3 style="font-size:16px;margin:0 0 8px;">Vui lòng kiểm tra email của bạn</h3>
        <p style="font-size:13px;color:var(--muted);margin:0;line-height:1.6;">
          Nhấn vào liên kết trong email để kích hoạt tài khoản trước khi đăng nhập. Nếu không thấy, vui lòng kiểm tra cả mục Thư rác (Spam).
        </p>
      </div>

      <button type="button" class="btn primary auth-submit" data-auth-mode="login">
        <span>Đến màn hình Đăng nhập</span>
        ${SVG_ICONS.arrowRight}
      </button>
    `;
  }

  /**
   * Gắn sự kiện lắng nghe tương tác người dùng
   */
  attachEvents() {
    // 1. Chuyển tab / chế độ xem
    this.container.querySelectorAll('[data-auth-mode]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const mode = btn.getAttribute('data-auth-mode');
        this.render(mode);
      });
    });

    // 2. Nút ẩn / hiện mật khẩu
    this.container.querySelectorAll('[data-auth-action="toggle-password"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
          const isPass = input.type === 'password';
          input.type = isPass ? 'text' : 'password';
          btn.setAttribute('aria-pressed', String(isPass));
          btn.innerHTML = isPass ? SVG_ICONS.eyeOff : SVG_ICONS.eye;
        }
      });
    });

    // 3. Xử lý submit LoginForm
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
      const emailInput = document.getElementById('loginEmail');
      if (emailInput && !this.errorMessage) emailInput.focus();
    }

    // 4. Xử lý submit SignupForm
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => this.handleSignup(e));
      const nameInput = document.getElementById('signupFullName');
      if (nameInput) nameInput.focus();
    }

    // 5. Xử lý submit ForgotForm
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
      forgotForm.addEventListener('submit', (e) => this.handleForgot(e));
      const emailInput = document.getElementById('forgotEmail');
      if (emailInput) emailInput.focus();
    }

    // 6. Xử lý submit RecoveryForm
    const recoveryForm = document.getElementById('recoveryForm');
    if (recoveryForm) {
      recoveryForm.addEventListener('submit', (e) => this.handleRecovery(e));
      const passInput = document.getElementById('recoveryPassword');
      if (passInput) passInput.focus();
    }
  }

  /**
   * Xử lý Đăng nhập
   */
  async handleLogin(e) {
    e.preventDefault();
    if (this.isSubmitting) return;

    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) {
      this.showError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    this.setSubmitting(true);
    try {
      const data = await AuthService.signIn(email, password);
      if (data?.session) {
        this.onAuthenticated(data.session);
      }
    } catch (err) {
      console.warn('Đăng nhập thất bại:', err.message);
      this.showError(AuthService.formatAuthError(err));
    } finally {
      this.setSubmitting(false);
    }
  }

  /**
   * Xử lý Đăng ký
   */
  async handleSignup(e) {
    e.preventDefault();
    if (this.isSubmitting) return;

    const fullName = document.getElementById('signupFullName')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirm = document.getElementById('signupConfirmPassword')?.value;

    if (!fullName || !email || !password) {
      this.showError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    if (password.length < 6) {
      this.showError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }
    if (password !== confirm) {
      this.showError('Mật khẩu nhập lại không trùng khớp.');
      return;
    }

    this.setSubmitting(true);
    try {
      const data = await AuthService.signUp(email, password, { fullName });
      
      // Nếu session tồn tại ngay (mailer_autoconfirm = true)
      if (data?.session) {
        this.onAuthenticated(data.session);
      } else {
        // Trường hợp mailer_autoconfirm = false (cần xác thực qua email)
        this.render('confirm_pending');
      }
    } catch (err) {
      console.warn('Đăng ký thất bại:', err.message);
      this.showError(AuthService.formatAuthError(err));
    } finally {
      this.setSubmitting(false);
    }
  }

  /**
   * Xử lý Quên mật khẩu
   */
  async handleForgot(e) {
    e.preventDefault();
    if (this.isSubmitting) return;

    const email = document.getElementById('forgotEmail')?.value.trim();
    if (!email) {
      this.showError('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    this.setSubmitting(true);
    try {
      await AuthService.resetPassword(email);
      this.render('forgot', {
        success: 'Liên kết đặt lại mật khẩu đã được gửi! Vui lòng kiểm tra hòm thư của bạn.'
      });
    } catch (err) {
      console.warn('Yêu cầu đặt lại mật khẩu thất bại:', err.message);
      this.showError(AuthService.formatAuthError(err));
    } finally {
      this.setSubmitting(false);
    }
  }

  /**
   * Xử lý Đặt lại mật khẩu mới
   */
  async handleRecovery(e) {
    e.preventDefault();
    if (this.isSubmitting) return;

    const password = document.getElementById('recoveryPassword')?.value;
    const confirm = document.getElementById('recoveryConfirmPassword')?.value;

    if (!password || password.length < 6) {
      this.showError('Mật khẩu mới cần tối thiểu 6 ký tự.');
      return;
    }
    if (password !== confirm) {
      this.showError('Mật khẩu nhập lại không trùng khớp.');
      return;
    }

    this.setSubmitting(true);
    try {
      await AuthService.updatePassword(password);
      this.render('login', {
        success: 'Mật khẩu đã được cập nhật thành công! Vui lòng đăng nhập bằng mật khẩu mới.'
      });
    } catch (err) {
      console.warn('Cập nhật mật khẩu thất bại:', err.message);
      this.showError(AuthService.formatAuthError(err));
    } finally {
      this.setSubmitting(false);
    }
  }

  /**
   * Hiển thị thông báo lỗi
   */
  showError(message) {
    this.errorMessage = message;
    const errorEl = document.getElementById('authError');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      errorEl.focus?.();
    }
  }

  /**
   * Cập nhật trạng thái đang gửi yêu cầu
   */
  setSubmitting(isSubmitting) {
    this.isSubmitting = isSubmitting;
    const submitBtn = this.container.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = isSubmitting;
    }
    this.container.querySelectorAll('input').forEach(inp => {
      inp.disabled = isSubmitting;
    });
  }
}
