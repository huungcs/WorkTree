/* WorkTree X V8: local account workflow and personal priority pins.
 * SECURITY: all data and policy are in this browser. DevTools, storage editing,
 * or possession of backups bypass this UI. Production requires a server-side
 * authorization boundary, per-request scope checks and authenticated sessions.
 * Passwords use native WebCrypto PBKDF2-SHA256, 600,000 rounds, random 128-bit salt.
 */
const T={
 login:'Đăng nhập',logout:'Đăng xuất',close:'Đóng',cancel:'Hủy',save:'Lưu thay đổi',create:'Tạo tài khoản',name:'Họ và tên',username:'Tên đăng nhập',password:'Mật khẩu',confirmPassword:'Nhập lại mật khẩu',currentPassword:'Mật khẩu hiện tại',newPassword:'Mật khẩu mới',passwordHint:'Tối thiểu 12 ký tự. Nên dùng một cụm từ dài, dễ nhớ.',
 admin:'Quản trị viên',manager:'Quản lý',member:'Nhân viên',viewer:'Chỉ xem',owner:'Chủ sở hữu',role:'Vai trò',scope:'Phạm vi được cấp',allScope:'Toàn bộ không gian',allowedScope:'Phạm vi được cấp',account:'Tài khoản',accounts:'Tài khoản & phân quyền',matrix:'Ma trận quyền',audit:'Nhật ký tài khoản',active:'Hoạt động',inactive:'Đã vô hiệu',edit:'Chỉnh sửa',disable:'Vô hiệu hóa',enable:'Kích hoạt',resetPassword:'Đặt lại mật khẩu',changePassword:'Đổi mật khẩu',person:'Liên kết nhân sự',noPerson:'Không liên kết',
 local:'Cục bộ trên trình duyệt này',localWarning:'Đây là quy trình đăng nhập và phân quyền cục bộ. Người có quyền truy cập tệp, DevTools hoặc bộ nhớ trình duyệt vẫn có thể đọc/sửa dữ liệu. Chưa có máy chủ hay đồng bộ giữa các máy.',
 setupTitle:'Thiết lập người quản trị',setupSub:'Tạo tài khoản đầu tiên. Dữ liệu công việc hiện có được giữ nguyên.',loginTitle:'Chào mừng trở lại.',loginSub:'Đăng nhập để vào đúng không gian của bạn.',heroTitle:'Đúng người.\nĐúng việc.\nĐúng ưu tiên.',heroSub:'Một nơi để đội ngũ tập trung vào điều quan trọng nhất.',setup:'Tạo quản trị viên',showPassword:'Hiện / ẩn mật khẩu',forgot:'Quên mật khẩu?',forgotHelp:'Nhờ quản trị viên đặt mật khẩu tạm trong Tài khoản & quyền. Không có email khôi phục tự động. Không xóa dữ liệu trình duyệt để tránh mất công việc.',
 denied:'Thao tác không thuộc quyền của bạn.',badLogin:'Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.',locked:'Thử sai quá nhiều lần. Vui lòng thử lại sau 60 giây.',passwordMismatch:'Hai mật khẩu chưa trùng khớp.',usernameInvalid:'Tên đăng nhập cần 3–80 ký tự: chữ không dấu, số, dấu chấm, @, _ hoặc -.',duplicateUsername:'Tên đăng nhập này đã tồn tại.',storageError:'Không lưu được. Hãy cho phép bộ nhớ trình duyệt và kiểm tra dung lượng.',cryptoError:'Trình duyệt chưa cấp Web Crypto. Mở tệp bằng Chrome/Edge hiện đại, hoặc chạy qua localhost/HTTPS. Ứng dụng không hạ cấp sang mật khẩu văn bản.',identityError:'Dữ liệu tài khoản không đọc được. Bản gốc chưa bị ghi đè. Hãy khôi phục bộ nhớ từ bản sao của thiết bị; không tự động tạo lại quản trị.',sessionExpired:'Phiên làm việc đã khóa. Vui lòng đăng nhập lại.',
 pins:'Ghim ưu tiên',pin:'Ghim lên đầu cây',unpin:'Bỏ ghim',personal:'Của riêng bạn',managePins:'Sắp xếp ghim',addPin:'Thêm ghim',pinEmpty:'Chọn một dự án hoặc công việc để luôn thấy ở đầu cây.',pinHint:'Ghim là lối tắt cá nhân. Không đổi thư mục gốc, hạn hay mức ưu tiên của công việc.',pinSaved:'Đã ghim lên đầu cây.',pinRemoved:'Đã bỏ ghim.',pinTop:'Đưa lên đầu',up:'Lên',down:'Xuống',urgent:'Cần xử lý gấp',normal:'Ghim thường',pinSearch:'Tìm dự án, thư mục hoặc công việc...',task:'Công việc',project:'Dự án / thư mục',allPins:'Xem & sắp xếp tất cả',hiddenDependency:'Công việc phụ thuộc nằm ngoài phạm vi của bạn.',noResults:'Không có kết quả phù hợp.',
 scopeHint:'Chọn một hay nhiều nhánh; quyền tự bao gồm các cấp con. Nhân viên chỉ thấy việc gắn với nhân sự của mình trong phạm vi này.',scopeRequired:'Hãy chọn ít nhất một nhánh được cấp quyền.',personRequired:'Nhân viên cần liên kết một nhân sự để xác định công việc được giao.',personTaken:'Nhân sự này đã được liên kết với một tài khoản khác.',forceChange:'Yêu cầu đổi mật khẩu ở lần đăng nhập kế tiếp',mustChange:'Hãy đổi mật khẩu tạm trước khi vào không gian.',temporary:'Mật khẩu tạm',newAccount:'Tạo tài khoản nhân viên',accountSaved:'Đã lưu tài khoản và quyền.',passwordSaved:'Đã đổi mật khẩu.',confirmDisable:'Vô hiệu tài khoản này? Công việc của nhân sự vẫn được giữ nguyên. Phiên đang mở sẽ bị khóa.',selfGuard:'Không thể tự vô hiệu hoặc tự hạ quyền tài khoản đang sử dụng.',scopeChanged:'Tài khoản đã thay đổi ở tab khác. Vui lòng mở lại biểu mẫu.',linkedGuard:'Cấu trúc mới làm mất nhân sự hoặc phạm vi của tài khoản đang hoạt động. Hãy sửa quyền hoặc vô hiệu tài khoản đó trước.',
 welcome:'Đã đăng nhập',readOnly:'Chế độ chỉ xem',memberHint:'Bạn chỉ cập nhật trạng thái, checklist, ghi giờ và bình luận trên công việc được giao.',idle:'Tự khóa sau 30 phút không thao tác; phiên tối đa 12 giờ.',searchAccounts:'Tìm tên, tài khoản...',noAudit:'Chưa có nhật ký.',newPasswordDifferent:'Mật khẩu mới phải khác mật khẩu hiện tại.',saved:'Đã lưu',undo:'Hoàn tác',loggedOut:'Đã đăng xuất.',unsavedLogout:'Đăng xuất sẽ bỏ biểu mẫu chưa lưu. Tiếp tục?',pinsLimit:'Tối đa 100 mục ghim mỗi tài khoản.',credentialsHint:'Chia sẻ tên đăng nhập và mật khẩu tạm trực tiếp. Tài khoản chỉ dùng được trên bộ dữ liệu cục bộ này, không tự xuất hiện ở máy khác.'
};
const ACCESS_KEY='worktree_x_v8_identity',SESSION_KEY='worktree_x_v8_session',PIN_KEY='worktree_x_v8_pins';
const ROLES=['admin','manager','member','viewer'];
const IDLE_MS=30*60*1000,MAX_SESSION_MS=12*60*60*1000;
let identity={version:1,accounts:[],audit:[]},identityRaw=null,identityIssue='',session=null,pendingUser=null;
let pinDB={version:1,users:{}},pinRaw=null,pinUndo=null,accessTab='accounts',accountQuery='',accountEditing=null,passwordTarget=null;
const PERSONAL_DEFAULTS={collapsed:false,sort:'smart',pageSize:15,focusTab:'attention',theme:'light',density:'comfortable',currentUser:null,timelineDays:14};
let authBusy=false,lastActivityWrite=0,appReady=false,pinsExpanded=false,scopeSearch='';
Object.assign(ICONS,{'arrow-top':'<path d="M4 3h16M7 12l5-5 5 5M12 7v14"/>',pin:'<path d="m16 3 5 5-4 2-3 6-3-3-6 6-1-1 6-6-3-3 6-3Z"/>',logout:'<path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h10"/>',key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-5-5 2-2m-5-1 2-2"/>','arrow-up':'<path d="m6 10 6-6 6 6M12 4v16"/>','arrow-down':'<path d="m6 14 6 6 6-6M12 4v16"/>'});
function currentAccount(){
 if(window.__worktree_supabase_user) return window.__worktree_supabase_user;
 if(window.__WORKTREE_LEGACY_LOCAL_AUTH__){
  const a=session&&identity.accounts.find(a=>a.id===session.id&&a.active&&a.version===session.version);
  return a&&!a.mustChange?a:null;
 }
 return null;
}
function currentPerson(){const a=currentAccount();return a?{id:byNode.has(a.personId)?a.personId:null,name:a.name}:{id:null,name:T.account};}
function isAdmin(){const r=currentAccount()?.role;return r==='admin'||r==='owner';}
function inScope(nodeId,a=currentAccount()){
 if(!a)return false;if(a.role==='admin'||a.role==='owner')return byNode.has(nodeId);
 return a.scopes.some(root=>byNode.has(root)&&subtree(root).has(nodeId));
}
function canReadTask(t,a=currentAccount()){return !!(a&&t&&inScope(t.node,a)&&(a.role!=='member'||(a.personId&&t.owner===a.personId)));}
function canUpdateTask(t){const a=currentAccount();return !!(a&&a.role!=='viewer'&&canReadTask(t));}
function canManageTask(t){const a=currentAccount();return !!(a&&['owner','admin','manager'].includes(a.role)&&canReadTask(t));}
function canCreateTask(){const a=currentAccount();return !!(a&&['owner','admin','manager'].includes(a.role)&&data.nodes.some(n=>inScope(n.id)));}
function canPlaceTask(id){return isAdmin()||currentAccount()?.role==='manager'&&inScope(id);}
function canReport(){return ['owner','admin','manager'].includes(currentAccount()?.role);}
function readableTasks(){return data?.tasks.filter(t=>canReadTask(t))||[];}
function visibleNodeIds(){
 const a=currentAccount(),set=new Set();if(!a||!data)return set;
 for(const n of data.nodes){if(inScope(n.id)&&(a.role!=='member'||n.type!=='person'||n.id===a.personId)){for(const p of pathNodes(n.id))set.add(p.id);}}
 for(const t of readableTasks()){for(const p of pathNodes(t.node))set.add(p.id);}
 const r=rootNode();if(r)set.add(r.id);return set;
}
function visibleNodes(){const ids=visibleNodeIds();return data.nodes.filter(n=>ids.has(n.id));}
function visibleChildren(id){const ids=visibleNodeIds();return childrenOf(id).filter(n=>ids.has(n.id));}
function permittedPeople(){
 if(window.__worktree_is_cloud_workspace&&Array.isArray(window.cloudEmployees)){
  return window.cloudEmployees;
 }
 if(!data)return [];
 const a=currentAccount();if(!a)return data.nodes.filter(n=>n.type==='person');
 const owners=new Set(readableTasks().map(t=>t.owner));
 return data.nodes.filter(n=>n.type==='person'&&(a.role==='admin'||a.role==='owner'||(a.role==='member'?n.id===a.personId:inScope(n.id)||owners.has(n.id))));
}
function canReadActivity(a){if(isAdmin())return true;return a.taskId?canReadTask(byTask.get(a.taskId)):currentAccount()?.role!=='member'&&!!a.nodeId&&inScope(a.nodeId);}
function deny(){toast(T.denied,'error');return false;}
function refreshIdentity(){
 let raw;try{raw=localStorage.getItem(ACCESS_KEY);}catch(e){return false;}
 if(raw!==identityRaw){try{identity=validateIdentity(JSON.parse(raw));identityRaw=raw;}catch(e){identityIssue=T.identityError;lockWorkspace(identityIssue);return false;}}
 if(session&&!currentAccount()){lockWorkspace(T.sessionExpired);return false;}return true;
}
function requireLogin(){
 if(window.__worktree_supabase_user) return true;
 if(window.__WORKTREE_LEGACY_LOCAL_AUTH__){
  if(!refreshIdentity())return false;
  if(!currentAccount()||(session && (Date.now()-session.lastActive>IDLE_MS||Date.now()-session.startedAt>MAX_SESSION_MS))){if(session)lockWorkspace(T.sessionExpired);return false;}
  return true;
 }
 return false;
}
function requireAdmin(){return requireLogin()&&(isAdmin()||deny());}
function assertMutation(before,after){
 if(!requireLogin())throw Error(T.denied);const a=currentAccount();
 if(a.role==='admin'){
  const map=new Map(after.nodes.map(n=>[n.id,n]));
  for(const u of identity.accounts.filter(u=>u.active&&u.role!=='admin')){
   if(u.personId&&map.get(u.personId)?.type!=='person'||u.scopes.some(id=>!map.has(id)))throw Error(T.linkedGuard);
  }return;
 }
 if(a.role==='viewer')throw Error(T.denied);
 if(JSON.stringify(before.nodes)!==JSON.stringify(after.nodes))throw Error(T.denied);
 const old=new Map(before.tasks.map(t=>[t.id,t])),next=new Map(after.tasks.map(t=>[t.id,t]));
 const memberFields=new Set(['status','progress','actual','checklist','comments','logs','updatedAt','resumeStatus','resumeProgress','autoProgress','favorite']);
 for(const id of new Set([...old.keys(),...next.keys()])){
  const t=old.get(id),n=next.get(id);if(JSON.stringify(t)===JSON.stringify(n))continue;
  if(a.role==='manager'){
   if(t&&!canReadTask(t)||n&&!canReadTask(n))throw Error(T.denied);
   if(n&&n.owner!==t?.owner&&n.owner&&!inScope(n.owner))throw Error(T.denied);
  }else{
   if(!t||!n||!canUpdateTask(t)||!canReadTask(n))throw Error(T.denied);
   for(const k of Object.keys(n))if(!memberFields.has(k)&&JSON.stringify(n[k])!==JSON.stringify(t[k]))throw Error(T.denied);
   const nc=new Map(n.comments.map(c=>[c.id,c]));
   for(const c of t.comments)if(c.authorId!==a.personId&&JSON.stringify(c)!==JSON.stringify(nc.get(c.id)))throw Error(T.denied);
   for(const c of n.comments.filter(c=>!t.comments.some(o=>o.id===c.id)))if(c.authorId!==a.personId||c.author!==a.name)throw Error(T.denied);
  }
 }
}
function validateIdentity(v){
 if(!isObject(v)||v.version!==1||!Array.isArray(v.accounts)||!v.accounts.length||v.accounts.length>500)throw Error(T.identityError);
 const ids=new Set(),names=new Set();
 for(const a of v.accounts){
  if(!isObject(a)||typeof a.id!=='string'||!/^u_[a-zA-Z0-9-]+$/.test(a.id)||ids.has(a.id)||typeof a.username!=='string'||names.has(a.username)||!ROLES.includes(a.role)||typeof a.name!=='string'||!Array.isArray(a.scopes)||!a.scopes.every(Number.isSafeInteger)||typeof a.active!=='boolean'||!Number.isSafeInteger(a.version)||!isObject(a.credential)||a.credential.algorithm!=='PBKDF2-SHA256'||a.credential.iterations!==600000||!/^[a-f0-9]{32}$/.test(a.credential.salt)||!/^[a-f0-9]{64}$/.test(a.credential.hash))throw Error(T.identityError);
  ids.add(a.id);names.add(a.username);
 }
 if(!v.accounts.some(a=>a.active&&a.role==='admin'))throw Error(T.identityError);
 v.audit=Array.isArray(v.audit)?v.audit.slice(-200):[];return v;
}
function readIdentity(){
 try{identityRaw=localStorage.getItem(ACCESS_KEY);if(identityRaw)identity=validateIdentity(JSON.parse(identityRaw));}
 catch(e){identityIssue=e.name==='SecurityError'?T.storageError:T.identityError;}
 try{pinRaw=localStorage.getItem(PIN_KEY);const p=JSON.parse(pinRaw||'null');if(p?.version===1&&isObject(p.users))pinDB=p;}catch(e){}
}
function writeIdentity(next){
 try{
  if(localStorage.getItem(ACCESS_KEY)!==identityRaw)throw Error(T.scopeChanged);
  const raw=JSON.stringify(next);localStorage.setItem(ACCESS_KEY,raw);identity=next;identityRaw=raw;return true;
 }catch(e){throw Error(e.message===T.scopeChanged?T.scopeChanged:T.storageError);}
}
function auditEvent(next,action,target='',actor=currentAccount()?.name||T.account){next.audit.push({at:new Date().toISOString(),actor,action,target});next.audit=next.audit.slice(-200);}
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const unhex=s=>Uint8Array.from(s.match(/.{2}/g)||[],x=>parseInt(x,16));
async function makeCredential(password,salt=null){
 if(!globalThis.crypto?.subtle)throw Error(T.cryptoError);
 const saltBytes=salt?unhex(salt):crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:saltBytes,iterations:600000},key,256);
 return {algorithm:'PBKDF2-SHA256',iterations:600000,salt:hex(saltBytes),hash:hex(bits)};
}
async function verifyPassword(password,c){const result=await makeCredential(password,c.salt);let diff=0;for(let i=0;i<result.hash.length;i++)diff|=result.hash.charCodeAt(i)^c.hash.charCodeAt(i);return diff===0;}
function checkPassword(p){if(Array.from(p).length<12||Array.from(p).length>128)throw Error(T.passwordHint);}
function checkUsername(v){const s=v.trim().toLowerCase();if(!/^[a-z0-9][a-z0-9@._-]{2,79}$/.test(s))throw Error(T.usernameInvalid);return s;}
function field(label,id,type='text',value='',extra=''){return `<label class="field">${esc(label)}<input id="${id}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
function passwordField(label,id,autocomplete='new-password'){return `<label class="field">${esc(label)}<span class="password-wrap"><input id="${id}" type="password" required maxlength="128" autocomplete="${autocomplete}"><button type="button" class="icon-btn" data-v8="toggle-password" data-target="${id}" aria-label="${T.showPassword}" title="${T.showPassword}">${icon('eye')}</button></span></label>`;}
function dialogHead(title,id,dialog,overline='WORKTREE X'){return `<div class="dialog-head"><div><p class="overline">${overline}</p><h2 id="${id}">${title}</h2></div><button type="button" class="icon-btn" data-action="close" data-dialog="${dialog}" aria-label="${T.close}">${icon('x')}</button></div>`;}
function authError(message){const el=$('authError');if(el){el.textContent=message;el.hidden=false;}}
function renderAuth(message=''){
 if(typeof window.renderSupabaseAuth==='function'){
  window.renderSupabaseAuth(message);
  return;
 }
 const setup=!identity.accounts.length&&!identityIssue;
 $('authScreen').innerHTML=`<div class="auth-brand"><div class="auth-logo">${icon('network')}</div><strong>WorkTree<span>X</span></strong><span class="auth-version">V8 / TEAM ACCESS</span></div><div class="auth-layout"><div class="auth-story"><p class="auth-eyebrow">WORK TOGETHER. STAY FOCUSED.</p><h1>${T.heroTitle.replace(/\n/g,'<br>')}</h1><p class="auth-description">${T.heroSub}</p><div class="auth-illustration"><div class="auth-mini-top">${icon('pin')}<span>${T.pins}</span><small>${T.personal}</small></div><div class="auth-focus-card"><span class="auth-card-icon">${icon('flag')}</span><div><strong>${T.urgent}</strong><small>${T.project}</small></div><span class="auth-ready">01</span></div><div class="auth-thread"></div><div class="auth-roles">${ROLES.slice(0,3).map(r=>`<span>${icon(r==='admin'?'shield':'user')}${T[r]}</span>`).join('')}</div></div><p class="auth-story-footer">${icon('lock')} ${T.local}</p></div><div class="auth-card"><div class="auth-card-header"><span class="auth-chip">${icon(setup?'key':'shield')}${setup?T.setup:T.account}</span><h2>${setup?T.setupTitle:T.loginTitle}</h2><p>${setup?T.setupSub:T.loginSub}</p></div><div class="form-error" id="authError" role="alert" ${message||identityIssue?'':'hidden'}>${esc(message||identityIssue)}</div>${identityIssue?'':`<form id="authForm" autocomplete="on"><div class="auth-fields">${setup?field(T.name,'authName','text','', 'required maxlength="180" autocomplete="name"'):''}${field(T.username,'authUsername','text','', 'required maxlength="80" autocomplete="username" autocapitalize="none" spellcheck="false"')}${passwordField(T.password,'authPassword',setup?'new-password':'current-password')}${setup?passwordField(T.confirmPassword,'authConfirm'):''}${setup?`<label class="field">${T.person}<select id="authPerson"><option value="">${T.noPerson}</option>${data.nodes.filter(n=>n.type==='person').map(n=>`<option value="${n.id}" ${n.id===306?'selected':''}>${esc(n.name)}</option>`).join('')}</select></label><p class="field-hint">${T.passwordHint}</p>`:''}</div><button type="submit" id="authSubmit" class="btn primary auth-submit">${setup?T.setup:T.login}${icon('arrow-right')}</button></form>${!setup?`<button class="link-btn auth-forgot" data-v8="forgot">${T.forgot}</button>`:''}`}<div class="auth-local-note">${icon('info')}<p>${T.localWarning}</p></div><p class="auth-session-note">${T.idle}</p></div></div><footer class="auth-footer">WorkTree X V8 <span>${T.local}</span></footer>`;
 $('authScreen').hidden=false;$('app').hidden=true;$('app').inert=true;
 $('authForm')?.addEventListener('submit',submitAuth);
 $('authUsername')?.focus();
}
async function submitAuth(e){
 e.preventDefault();if(authBusy)return;authBusy=true;$('authSubmit').disabled=true;$('authError').hidden=true;
 try{
  const username=checkUsername($('authUsername').value),password=$('authPassword').value;
  if(!identity.accounts.length){
   checkPassword(password);if(password!==$('authConfirm').value)throw Error(T.passwordMismatch);
   const name=$('authName').value.trim();if(!name)throw Error(T.name);
   const credential=await makeCredential(password),a={id:'u_'+crypto.randomUUID(),username,name,role:'admin',personId:Number($('authPerson').value)||null,scopes:[],active:true,mustChange:false,version:1,credential,failures:0,lockedUntil:0,createdAt:new Date().toISOString()};
   const next={version:1,accounts:[a],audit:[]};auditEvent(next,T.setup,a.username,a.name);writeIdentity(next);await enterWorkspace(a,true);
  }else{
   refreshIdentity();let a=identity.accounts.find(a=>a.username===username);
   if(a?.lockedUntil>Date.now())throw Error(T.locked);
   const revision=identityRaw;
   const c=a?.credential||{salt:'00000000000000000000000000000000',hash:'0'.repeat(64)};
   const valid=await verifyPassword(password,c);
   if(localStorage.getItem(ACCESS_KEY)!==revision){refreshIdentity();throw Error(T.scopeChanged);}
   const next=clone(identity),u=next.accounts.find(x=>x.username===username);
   if(!a||!a.active||!valid){if(u){u.failures=(u.failures||0)+1;if(u.failures>=5){u.lockedUntil=Date.now()+60000;u.failures=0;}auditEvent(next,T.badLogin,username,T.account);writeIdentity(next);}throw Error(T.badLogin);}
   u.failures=0;u.lockedUntil=0;u.lastLogin=new Date().toISOString();auditEvent(next,T.login,username,u.name);writeIdentity(next);a=identity.accounts.find(x=>x.id===a.id);
   if(a.mustChange){pendingUser={id:a.id,version:a.version};$('authPassword').value='';openPassword(null,true);}
   else await enterWorkspace(a);
  }
 }catch(err){authError(err.message||T.badLogin);}finally{authBusy=false;if($('authSubmit'))$('authSubmit').disabled=false;}
}
function saveSession(){try{session?sessionStorage.setItem(SESSION_KEY,JSON.stringify(session)):sessionStorage.removeItem(SESSION_KEY);}catch(e){}}
function touchSession(){if(!session||!currentAccount())return;const now=Date.now();if(now-session.lastActive>IDLE_MS||now-session.startedAt>MAX_SESSION_MS){lockWorkspace(T.sessionExpired);return;}session.lastActive=now;if(now-lastActivityWrite>5000){saveSession();lastActivityWrite=now;}}
function resetPersonalState(){
 const r=typeof rootNode==='function'?rootNode():null;
 const rootId=r?r.id:null;
 Object.assign(state,PERSONAL_DEFAULTS,{timelineStart:addDays(TODAY,-2),calendarMonth:monthStart(TODAY),workloadWeek:weekStart(TODAY),selected:rootId,view:'overview',includeChildren:true,filters:blankFilters(),page:1,expanded:rootId?[rootId]:[],savedViews:[],timer:null,selectedTasks:new Set(),treeQuery:'',filterOpen:false,mobileOpen:false});history=[];future=[];drawerDrafts.clear();commandOptions=[];pinUndo=null;pinsExpanded=false;
}
function loadPrefs(){
 const a=currentAccount();if(!a)return;const key=KEYS.prefs;KEYS.prefs=key+'_'+a.id;
 try{legacyLoadPrefs();const saved=JSON.parse(localStorage.getItem(KEYS.prefs)||'null');if(state.timer&&saved?.timer?.pausedAt)state.timer.pausedAt=saved.timer.pausedAt;}finally{KEYS.prefs=key;}
 state.currentUser=a.personId;
 const r=typeof rootNode==='function'?rootNode():null;
 if(r&&!visibleNodeIds().has(state.selected))state.selected=r.id;
 if(state.timer&&!canUpdateTask(byTask.get(state.timer.taskId)))state.timer=null;
}
function savePrefs(){const a=currentAccount();if(!a)return;try{localStorage.setItem(KEYS.prefs+'_'+a.id,JSON.stringify(prefsObject()));}catch(e){}}
async function enterWorkspace(a,first=false,restore=false){
 resetPersonalState();if(!restore)session={id:a.id,version:a.version,startedAt:Date.now(),lastActive:Date.now()};saveSession();loadPrefs();
 if(a.role==='member'&&!restore){state.view='list';state.filters.owner=String(a.personId);}
 $('authScreen').hidden=true;$('app').hidden=false;$('app').inert=false;
 $('authScreen').innerHTML='';applyTheme();applySidebar();renderAll(true);appReady=true;
 if(first&&!lastRaw&&!storageProtected)persistData();
 if(!restore)toast(T.welcome+': '+a.name);
 if(migrationMessage&&first)toast(migrationMessage);
 $('mainContent').focus({preventScroll:true});
}
function lockWorkspace(message=T.sessionExpired){
 if(session&&state.timer){state.timer.pausedAt=Date.now();savePrefs();}
 session=null;pendingUser=null;saveSession();dirtyTask=false;dirtyNode=false;drawerId=null;editingTask=null;editingNode=null;
 if(confirmResolver){confirmResolver(false);confirmResolver=null;}
 $$('dialog[open]').forEach(d=>d.close());for(const id of ['viewContent','orgTree','savedViews','drawerContent','settingsContent','infoContent','commandResults','accessContent','accountContent','profileContent','passwordContent','pinContent','pinSection'])$(id).innerHTML='';
 $('timerDock').hidden=true;$('toastRegion').innerHTML='';state.mobileOpen=false;document.body.style.overflow='';history=[];future=[];drawerDrafts.clear();state.selectedTasks.clear();commandOptions=[];
 renderAuth(message);
}
async function logout(){
 if(typeof window.supabaseSignOut==='function'){
  await window.supabaseSignOut();
  return;
 }
 if(!requireLogin())return;
 if((dirtyTask||dirtyNode)&&!await ask(T.logout,T.unsavedLogout,T.logout,true))return;
 if(state.timer&&!await stopTimer())return;
 try{const next=clone(identity);auditEvent(next,T.logout,currentAccount().username);writeIdentity(next);}catch(e){toast(e.message,'error');return;}
 lockWorkspace(T.loggedOut);
}
function accountSummary(a){
 if(a.role==='admin'||a.role==='owner')return T.allScope;
 if(a.scopes&&a.scopes.length)return a.scopes.map(id=>byNode.get(id)?.name||('#'+id)).join(' / ');
 return a.organization?.name||T.allScope;
}
function roleDescription(r){return {admin:'Điều hành toàn bộ, cấp tài khoản, sửa cây và sao lưu.',manager:'Xem, tạo, giao và chỉnh sửa công việc trong nhánh được cấp.',member:T.memberHint,viewer:'Xem công việc trong phạm vi được cấp. Không thay đổi dữ liệu.'}[r];}
function accessAuditHTML(){return `<p class="view-note">${T.local} · Đây không phải nhật ký chống chỉnh sửa.</p><div class="access-audit">${identity.audit.slice().reverse().map(a=>`<div><span class="access-audit-icon">${icon('shield')}</span><p><strong>${esc(a.actor)}</strong> ${esc(a.action)}<small>${esc(a.target)} · ${esc(timeAgo(a.at))}</small></p></div>`).join('')||T.noAudit}</div>`;}
function matrixHTML(){
 const rows=[['Xem công việc','Toàn bộ','Trong nhánh','Việc được giao','Trong nhánh'],['Tạo, giao, sửa kế hoạch','yes','yes','no','no'],['Cập nhật, checklist, ghi giờ','yes','yes','Việc được giao','no'],['Xóa công việc','yes','Trong nhánh*','no','no'],['Sửa cây, cấp tài khoản','yes','no','no','no'],['Nhập / sao lưu JSON','yes','no','no','no'],['Xuất CSV theo bộ lọc','yes','yes','no','no'],[T.pins+' · '+T.personal,'yes','yes','yes','yes']];
 return `<div class="role-cards">${ROLES.map(r=>`<article><span class="role-badge role-${r}">${icon(r==='admin'?'shield':r==='viewer'?'eye':'user')}${T[r]}</span><p>${roleDescription(r)}</p></article>`).join('')}</div><div class="access-table-scroll"><table class="access-matrix"><thead><tr><th>Thao tác</th>${ROLES.map(r=>`<th>${T[r]}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>i===0?`<th>${v}</th>`:`<td>${v==='yes'?`<span class="matrix-yes" aria-label="Có">${icon('check')}</span>`:v==='no'?'<span class="muted" aria-label="Không">—</span>':v}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="view-note">* Không xóa nếu thao tác đó làm thay đổi liên kết của công việc ngoài phạm vi. Cần quản trị viên xử lý.</p>`;
}
function getAccountsList(){
 const list = [...identity.accounts];
 const cur = currentAccount();
 if(cur && !list.some(a => a.id === cur.id)){
  list.unshift({
   id: cur.id,
   name: cur.name,
   username: cur.username || cur.email || 'admin',
   role: cur.role || 'admin',
   personId: cur.personId,
   scopes: cur.scopes || [],
   active: true,
   isCloudUser: !!window.__worktree_supabase_user
  });
 }
 return list;
}
let cloudEmployeesWithStatus = [];

async function renderCloudEmployeeDirectory(forceReload = false) {
 const container = $('accountList');
 if(!container) return;
 const orgId = window.appState?.activeOrganizationId;
 if(!orgId){
  container.innerHTML = `<p class="empty-state">Chưa chọn tổ chức.</p>`;
  return;
 }

 if(forceReload || !cloudEmployeesWithStatus.length){
  container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted)">${icon('refresh')} Đang tải danh sách nhân sự...</div>`;
  try{
   if(window.EmployeeService?.loadEmployeesWithAccountStatus){
    cloudEmployeesWithStatus = await window.EmployeeService.loadEmployeesWithAccountStatus(orgId);
   } else if(Array.isArray(window.cloudEmployees)){
    cloudEmployeesWithStatus = window.cloudEmployees.map(e=>({...e, accountStatus:'uninvited', role:'member'}));
   }
  }catch(err){
   console.error('Lỗi tải danh sách nhân sự:', err);
   container.innerHTML = `<div class="form-error" role="alert">Không thể tải danh sách nhân sự: ${esc(err.message)}</div>`;
   return;
  }
 }

 const q = fold(accountQuery);
 const filtered = cloudEmployeesWithStatus.filter(emp => {
  const text = `${emp.full_name||''} ${emp.email||''} ${emp.employee_code||''} ${emp.job_title||''} ${nodeName(emp.home_node_id)||''}`;
  return fold(text).includes(q);
 });

 if(!filtered.length){
  container.innerHTML = `<p class="empty-state">${T.noResults}</p>`;
  return;
 }

 const curMember = window.appState?.activeMembership;
 const curEmployeeId = curMember?.employeeId;

 container.innerHTML = filtered.map(emp => {
  const isYou = curEmployeeId && emp.id === curEmployeeId;
  const homeNodeTitle = nodeName(emp.home_node_id);
  const jobText = [emp.job_title, homeNodeTitle].filter(Boolean).join(' · ');

  let statusBadge = '';
  let opsHTML = '';

  if(emp.accountStatus === 'linked'){
   statusBadge = `<span class="badge" style="background:var(--green-soft);color:var(--green);font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:4px;">${icon('check')} Tài khoản: Đã liên kết</span> <small class="muted" style="margin-left:6px">${esc(emp.accountEmail || emp.email || '')}</small>`;
   opsHTML = `<span class="access-status active">Hoạt động</span>`;
  } else if(emp.accountStatus === 'pending'){
   statusBadge = `<span class="badge" style="background:var(--amber-soft);color:var(--amber);font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:4px;">${icon('clock')} Tài khoản: Đang chờ chấp nhận</span> <small class="muted" style="margin-left:6px">${esc(emp.accountEmail || emp.email || '')}</small>`;
   opsHTML = `<button class="btn btn-sm" data-v8="employee-resend" data-employee-id="${emp.id}" title="Gửi lại lời mời">${icon('refresh')} Gửi lại lời mời</button>`;
  } else {
   statusBadge = `<span class="badge" style="background:var(--surface-3);color:var(--muted);font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px;display:inline-flex;align-items:center;gap:4px;">${icon('user')} Tài khoản: Chưa mời</span>`;
   opsHTML = `<button class="btn btn-sm secondary" data-v8="employee-invite" data-employee-id="${emp.id}">${icon('mail')} Mời sử dụng WorkTree</button>`;
  }

  const roleBadge = emp.role ? `<span class="role-badge role-${emp.role}">${T[emp.role] || emp.role}</span>` : '';

  return `<article class="account-row">
   <span class="avatar av-1">${esc(initials(emp.full_name))}</span>
   <div class="account-main">
    <div>
     <strong>${esc(emp.full_name)}</strong>
     ${isYou ? '<span class="you-badge">Bạn</span>' : ''}
     ${roleBadge}
    </div>
    <p>${emp.employee_code ? `<span class="muted">[${esc(emp.employee_code)}]</span> ` : ''}${esc(jobText || 'Chưa phân phòng ban')}</p>
    <div style="margin-top:4px">${statusBadge}</div>
   </div>
   <div class="account-ops">
    ${opsHTML}
   </div>
  </article>`;
 }).join('');
}

function openAddEmployeeDialog(){
 if(!requireAdmin())return;
 accountEditing = null;

 const isCloud = !!window.__worktree_is_cloud_workspace;
 if(!isCloud){
  openAccount(null);
  return;
 }

 const validHomeNodes = (data?.nodes||[]).filter(n => ['company','department','team'].includes(n.type));
 const homeOptions = validHomeNodes.length ? validHomeNodes : (rootNode() ? [rootNode()] : []);
 const homeOptionsHTML = homeOptions.map(n => `<option value="${n.id}">${esc(pathName(n.id) || n.name)} (${TYPES[n.type] || n.type})</option>`).join('');

 const scopePickerHTML = (data?.nodes||[]).map(n => `<label class="scope-option" data-scope-name="${esc(fold(pathName(n.id)))}">
  <input type="checkbox" name="empScope" value="${n.id}">
  <span class="scope-option-main" style="--scope-indent:${Math.min(36,(pathNodes(n.id).length-1)*10)}px">
   ${icon(nodeIcon(n.type))}
   <span class="scope-option-name">${esc(n.name)}</span>
  </span>
  <small>${TYPES[n.type]}</small>
 </label>`).join('');

 $('accountContent').innerHTML = `
  <form id="addEmployeeForm">
   ${dialogHead('Thêm nhân viên','accountTitle','accountDialog')}
   <div class="dialog-scroll">
    <div class="form-error" id="empFormError" role="alert" tabindex="-1" hidden></div>

    <div style="margin:8px 0 12px 0;font-weight:700;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px">
     <span>Thông tin nhân sự</span>
    </div>
    <div class="form-grid">
     ${field('Họ và tên *','newEmpName','text','','required maxlength="180" autocomplete="name" placeholder="VD: Nguyễn Văn A"')}
     ${field('Email','newEmpEmail','email','','maxlength="180" autocomplete="email" placeholder="email@congty.com"')}
     ${field('Mã nhân viên','newEmpCode','text','','maxlength="50" placeholder="VD: NV001"')}
     ${field('Chức danh','newEmpTitle','text','','maxlength="100" placeholder="VD: Chuyên viên kinh doanh"')}
    </div>

    <div style="margin:16px 0 12px 0;font-weight:700;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px">
     <span>Vị trí trong tổ chức</span>
    </div>
    <div class="form-grid">
     <label class="field">
      Phòng ban trực thuộc *
      <select id="newEmpHomeNode" required>
       ${homeOptionsHTML}
      </select>
     </label>
     <div class="field">
      <label style="display:block;margin-bottom:6px;font-size:13px;color:var(--muted)">Trạng thái</label>
      <div style="padding:8px 12px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;font-weight:600;color:var(--green);display:flex;align-items:center;gap:6px;font-size:13px">
       ${icon('check')} Đang làm việc
      </div>
     </div>
    </div>

    <div style="margin:16px 0 12px 0;font-weight:700;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px">
     <span>Quyền truy cập WorkTree</span>
    </div>
    <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:8px 0 12px 0;font-weight:600">
     <input id="empInviteToggle" type="checkbox">
     <span>Mời nhân viên sử dụng WorkTree</span>
    </label>

    <div id="empInviteFields" style="display:none;background:var(--surface-2);padding:16px;border-radius:10px;border:1px solid var(--line);margin-bottom:12px">
     <div class="form-grid">
      ${field('Email đăng nhập *','newEmpInviteEmail','email','','maxlength="180" placeholder="email@congty.com"')}
      <label class="field">
       Vai trò *
       <select id="newEmpRole">
        <option value="member" selected>Nhân viên</option>
        <option value="manager">Quản lý</option>
        <option value="admin">Quản trị viên</option>
        <option value="viewer">Chỉ xem</option>
       </select>
      </label>
      <div class="field full" id="newEmpScopeSection">
       <div class="scope-label">
        <strong>Phạm vi được cấp</strong>
        <small id="newEmpScopeCount"></small>
       </div>
       <p class="field-hint">Chọn một hay nhiều nhánh; quyền tự bao gồm các cấp con.</p>
       <input type="search" id="newEmpScopeSearch" placeholder="Tìm nhánh..." aria-label="Tìm nhánh phân quyền">
       <div class="scope-picker">
        ${scopePickerHTML}
       </div>
      </div>
      <div class="role-explanation full" id="newEmpRoleExplanation"></div>
     </div>
    </div>

   </div>
   <div class="dialog-foot">
    <button type="button" class="btn" data-action="close" data-dialog="accountDialog">Hủy</button>
    <button type="submit" class="btn primary" id="newEmpSubmitBtn">Thêm nhân viên</button>
   </div>
  </form>
 `;

 const inviteToggle = $('empInviteToggle');
 const inviteFields = $('empInviteFields');
 const submitBtn = $('newEmpSubmitBtn');
 const empEmail = $('newEmpEmail');
 const inviteEmail = $('newEmpInviteEmail');
 const roleSelect = $('newEmpRole');
 const homeSelect = $('newEmpHomeNode');
 const scopeSection = $('newEmpScopeSection');

 function updateInviteUI(){
  const isInvite = inviteToggle.checked;
  inviteFields.style.display = isInvite ? 'block' : 'none';
  submitBtn.textContent = isInvite ? 'Thêm nhân viên & gửi lời mời' : 'Thêm nhân viên';
  if(isInvite && !inviteEmail.value.trim() && empEmail.value.trim()){
   inviteEmail.value = empEmail.value.trim();
  }
  updateRoleScopeUI();
 }

 function updateRoleScopeUI(){
  const r = roleSelect.value;
  scopeSection.hidden = (r === 'admin');
  $('newEmpRoleExplanation').innerHTML = `<span class="role-badge role-${r}">${T[r]||r}</span><p>${roleDescription(r)}</p>`;
  const checkedCount = $$('#addEmployeeForm [name="empScope"]:checked').length;
  $('newEmpScopeCount').textContent = checkedCount + ' nhánh';
 }

 if(homeSelect.value){
  const cb = $(`#addEmployeeForm [name="empScope"][value="${homeSelect.value}"]`);
  if(cb) cb.checked = true;
 }

 inviteToggle.addEventListener('change', updateInviteUI);
 empEmail.addEventListener('input', () => {
  if(inviteToggle.checked && !inviteEmail.dataset.userEdited){
   inviteEmail.value = empEmail.value.trim();
  }
 });
 inviteEmail.addEventListener('input', () => {
  inviteEmail.dataset.userEdited = 'true';
 });
 roleSelect.addEventListener('change', updateRoleScopeUI);
 homeSelect.addEventListener('change', () => {
  const allChecked = $$('#addEmployeeForm [name="empScope"]:checked');
  if(allChecked.length <= 1){
   $$('#addEmployeeForm [name="empScope"]').forEach(c => c.checked = false);
   const cb = $(`#addEmployeeForm [name="empScope"][value="${homeSelect.value}"]`);
   if(cb) cb.checked = true;
   updateRoleScopeUI();
  }
 });

 $('newEmpScopeSearch').addEventListener('input', e => {
  const q = fold(e.target.value);
  $$('#addEmployeeForm .scope-option').forEach(el => el.hidden = !el.dataset.scopeName.includes(q));
 });

 $$('#addEmployeeForm [name="empScope"]').forEach(el => el.addEventListener('change', updateRoleScopeUI));

 updateRoleScopeUI();
 $('addEmployeeForm').addEventListener('submit', submitNewEmployee);
 showDialog('accountDialog', '#newEmpName');
}

async function submitNewEmployee(e){
 e.preventDefault();
 const submitBtn = $('newEmpSubmitBtn');
 const errorEl = $('empFormError');
 if(submitBtn.disabled) return;
 submitBtn.disabled = true;
 errorEl.hidden = true;

 try{
  const orgId = window.appState?.activeOrganizationId;
  if(!orgId) throw new Error('Không tìm thấy tổ chức đang hoạt động.');

  const fullName = $('newEmpName').value.trim();
  if(!fullName) throw new Error('Họ và tên nhân viên là bắt buộc.');

  const email = $('newEmpEmail').value.trim() || null;
  const employeeCode = $('newEmpCode').value.trim() || null;
  const jobTitle = $('newEmpTitle').value.trim() || null;
  const homeNodeId = $('newEmpHomeNode').value;
  if(!homeNodeId) throw new Error('Phòng ban trực thuộc là bắt buộc.');

  const invite = $('empInviteToggle').checked;
  let inviteEmail = null;
  let role = 'member';
  let scopeNodeIds = [];

  if(invite){
   inviteEmail = $('newEmpInviteEmail').value.trim().toLowerCase();
   if(!inviteEmail) throw new Error('Email đăng nhập là bắt buộc khi mời sử dụng WorkTree.');
   const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
   if(!emailRegex.test(inviteEmail)) throw new Error('Định dạng email đăng nhập không hợp lệ.');

   role = $('newEmpRole').value;
   if(role === 'owner') throw new Error('Không thể chọn vai trò Chủ sở hữu.');
   if(!['admin','manager','member','viewer'].includes(role)){
    throw new Error('Vai trò không hợp lệ.');
   }

   scopeNodeIds = role === 'admin' ? [] : $$('#addEmployeeForm [name="empScope"]:checked').map(el => el.value);
   if(role !== 'admin' && !scopeNodeIds.length){
    scopeNodeIds = [homeNodeId];
   }
  }

  const res = await window.EmployeeService.createEmployee({
   organizationId: orgId,
   fullName,
   email,
   employeeCode,
   jobTitle,
   homeNodeId,
   invite,
   role,
   scopeNodeIds: scopeNodeIds.length ? scopeNodeIds : [homeNodeId]
  });

  closeDialog('accountDialog', true);
  $('accountContent').innerHTML = '';

  if(typeof window.loadWorkspaceData === 'function'){
   window.loadWorkspaceData(orgId);
  }

  await renderCloudEmployeeDirectory(true);

  if(res.invitationError){
   toast(`Đã thêm nhân viên ${fullName}, nhưng chưa gửi được lời mời: ${res.invitationError}. Bạn có thể gửi lại lời mời sau.`, 'warning');
  } else {
   toast(`Đã thêm nhân viên ${fullName}${invite ? ' và gửi lời mời thành công.' : '.'}`);
  }

 }catch(err){
  console.error('Lỗi khi thêm nhân viên:', err);
  errorEl.textContent = err.message || 'Lỗi không xác định';
  errorEl.hidden = false;
  errorEl.focus({preventScroll:true});
  errorEl.closest('.dialog-scroll').scrollTop = 0;
 }finally{
  submitBtn.disabled = false;
 }
}

function openInviteExistingEmployeeDialog(employeeId){
 if(!requireAdmin()) return;
 const emp = cloudEmployeesWithStatus.find(e => e.id === employeeId);
 if(!emp) return toast('Không tìm thấy nhân sự.', 'error');
 if(emp.accountStatus === 'linked'){
  return toast('Nhân sự này đã được liên kết tài khoản.', 'warning');
 }

 const scopePickerHTML = (data?.nodes||[]).map(n => `<label class="scope-option" data-scope-name="${esc(fold(pathName(n.id)))}">
  <input type="checkbox" name="inviteExistScope" value="${n.id}" ${n.id === emp.home_node_id ? 'checked' : ''}>
  <span class="scope-option-main" style="--scope-indent:${Math.min(36,(pathNodes(n.id).length-1)*10)}px">
   ${icon(nodeIcon(n.type))}
   <span class="scope-option-name">${esc(n.name)}</span>
  </span>
  <small>${TYPES[n.type]}</small>
 </label>`).join('');

 $('accountContent').innerHTML = `
  <form id="inviteExistingForm">
   ${dialogHead('Mời nhân viên sử dụng WorkTree','accountTitle','accountDialog')}
   <div class="dialog-scroll">
    <div class="form-error" id="inviteExistError" role="alert" tabindex="-1" hidden></div>

    <div style="margin:8px 0 12px 0;font-weight:700;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px">
     <span>Thông tin nhân sự</span>
    </div>
    <div style="background:var(--surface-2);padding:12px 16px;border-radius:8px;border:1px solid var(--line);margin-bottom:16px;display:flex;align-items:center;gap:12px;">
     <span class="avatar av-1">${esc(initials(emp.full_name))}</span>
     <div>
      <strong>${esc(emp.full_name)}</strong>
      <div class="muted" style="font-size:12px">${emp.job_title ? esc(emp.job_title) + ' · ' : ''}${esc(nodeName(emp.home_node_id) || 'Chưa phân phòng ban')}</div>
     </div>
    </div>

    <div style="margin:16px 0 12px 0;font-weight:700;color:var(--text);border-bottom:1px solid var(--line);padding-bottom:6px">
     <span>Quyền truy cập WorkTree</span>
    </div>
    <div class="form-grid">
     ${field('Email đăng nhập *','inviteExistEmail','email',emp.email||'','required maxlength="180" placeholder="email@congty.com"')}
     <label class="field">
      Vai trò *
      <select id="inviteExistRole">
       <option value="member" selected>Nhân viên</option>
       <option value="manager">Quản lý</option>
       <option value="admin">Quản trị viên</option>
       <option value="viewer">Chỉ xem</option>
      </select>
     </label>
     <div class="field full" id="inviteExistScopeSection">
      <div class="scope-label">
       <strong>Phạm vi được cấp</strong>
       <small id="inviteExistScopeCount"></small>
      </div>
      <p class="field-hint">Chọn một hay nhiều nhánh; quyền tự bao gồm các cấp con.</p>
      <input type="search" id="inviteExistScopeSearch" placeholder="Tìm nhánh..." aria-label="Tìm nhánh phân quyền">
      <div class="scope-picker">
       ${scopePickerHTML}
      </div>
     </div>
     <div class="role-explanation full" id="inviteExistRoleExplanation"></div>
    </div>
   </div>
   <div class="dialog-foot">
    <button type="button" class="btn" data-action="close" data-dialog="accountDialog">Hủy</button>
    <button type="submit" class="btn primary" id="inviteExistSubmitBtn">Gửi lời mời</button>
   </div>
  </form>
 `;

 const roleSelect = $('inviteExistRole');
 const scopeSection = $('inviteExistScopeSection');

 function updateRoleScopeUI(){
  const r = roleSelect.value;
  scopeSection.hidden = (r === 'admin');
  $('inviteExistRoleExplanation').innerHTML = `<span class="role-badge role-${r}">${T[r]||r}</span><p>${roleDescription(r)}</p>`;
  const checkedCount = $$('#inviteExistingForm [name="inviteExistScope"]:checked').length;
  $('inviteExistScopeCount').textContent = checkedCount + ' nhánh';
 }

 roleSelect.addEventListener('change', updateRoleScopeUI);
 $('inviteExistScopeSearch').addEventListener('input', e => {
  const q = fold(e.target.value);
  $$('#inviteExistingForm .scope-option').forEach(el => el.hidden = !el.dataset.scopeName.includes(q));
 });
 $$('#inviteExistingForm [name="inviteExistScope"]').forEach(el => el.addEventListener('change', updateRoleScopeUI));

 updateRoleScopeUI();

 $('inviteExistingForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('inviteExistSubmitBtn');
  const errEl = $('inviteExistError');
  if(btn.disabled) return;
  btn.disabled = true;
  errEl.hidden = true;

  try{
   const orgId = window.appState?.activeOrganizationId;
   const email = $('inviteExistEmail').value.trim().toLowerCase();
   if(!email) throw new Error('Email đăng nhập là bắt buộc.');
   const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
   if(!emailRegex.test(email)) throw new Error('Định dạng email không hợp lệ.');

   const r = roleSelect.value;
   if(r === 'owner') throw new Error('Không thể chọn vai trò Chủ sở hữu.');

   const scopes = r === 'admin' ? [] : $$('#inviteExistingForm [name="inviteExistScope"]:checked').map(el => el.value);

   await window.EmployeeService.inviteExistingEmployee({
    organizationId: orgId,
    employeeId: emp.id,
    email,
    fullName: emp.full_name,
    homeNodeId: emp.home_node_id,
    role: r,
    scopeNodeIds: scopes.length ? scopes : (emp.home_node_id ? [emp.home_node_id] : [])
   });

   closeDialog('accountDialog', true);
   $('accountContent').innerHTML = '';
   await renderCloudEmployeeDirectory(true);
   toast(`Đã gửi lời mời thành công cho ${emp.full_name}.`);

  }catch(err){
   console.error('Lỗi mời nhân sự:', err);
   errEl.textContent = err.message || 'Lỗi gửi lời mời';
   errEl.hidden = false;
  }finally{
   btn.disabled = false;
  }
 });

 showDialog('accountDialog', '#inviteExistEmail');
}

async function resendEmployeeInvitation(employeeId){
 if(!requireAdmin()) return;
 const emp = cloudEmployeesWithStatus.find(e => e.id === employeeId);
 if(!emp) return toast('Không tìm thấy nhân sự.', 'error');
 const orgId = window.appState?.activeOrganizationId;
 const targetEmail = emp.accountEmail || emp.email;
 if(!targetEmail){
  return openInviteExistingEmployeeDialog(employeeId);
 }

 try{
  toast(`Đang gửi lại lời mời cho ${emp.full_name}...`);
  await window.EmployeeService.inviteExistingEmployee({
   organizationId: orgId,
   employeeId: emp.id,
   email: targetEmail,
   fullName: emp.full_name,
   homeNodeId: emp.home_node_id,
   role: emp.role || 'member',
   scopeNodeIds: emp.home_node_id ? [emp.home_node_id] : []
  });
  await renderCloudEmployeeDirectory(true);
  toast(`Đã gửi lại lời mời thành công cho ${emp.full_name}.`);
 }catch(err){
  console.error('Lỗi gửi lại lời mời:', err);
  toast('Không thể gửi lại lời mời: ' + (err.message || 'Lỗi không xác định'), 'error');
 }
}

function openAccess(tab=accessTab){
 if(!requireAdmin())return;accessTab=tab;$('accessTitle').textContent=window.__worktree_is_cloud_workspace ? 'Nhân sự & tài khoản' : T.accounts;
 const isCloud = !!window.__worktree_is_cloud_workspace;
 const count = isCloud ? (cloudEmployeesWithStatus.length || window.cloudEmployees?.length || 1) : getAccountsList().filter(a=>a.active).length;
 
 $('accessContent').innerHTML=`<div class="access-banner"><div><span class="access-banner-icon">${icon('shield')}</span><h3>Rõ vai trò. Đúng phạm vi.</h3><p>${isCloud ? 'Quản lý nhân sự và phân quyền truy cập không gian làm việc.' : 'Cấp quyền theo công việc thực tế, không chia sẻ một tài khoản chung.'}</p></div><div class="access-stat"><strong>${count}</strong><span>${isCloud ? 'Nhân sự' : T.active}</span></div></div><div class="access-tabs" role="tablist">${[['accounts',isCloud ? 'Nhân sự' : T.accounts],['matrix',T.matrix],['audit',T.audit]].map(([key,label])=>`<button role="tab" aria-selected="${key===tab}" data-v8="access-tab" data-tab="${key}">${label}</button>`).join('')}</div><div id="accessPanel" role="tabpanel">${tab==='matrix'?matrixHTML():tab==='audit'?accessAuditHTML():`<div class="access-toolbar"><label class="access-search">${icon('search')}<input id="accountSearch" type="search" value="${esc(accountQuery)}" placeholder="${isCloud ? 'Tìm nhân sự, chức danh...' : T.searchAccounts}" aria-label="${isCloud ? 'Tìm nhân sự' : T.searchAccounts}"></label><button class="btn primary" data-v8="${isCloud ? 'employee-new' : 'account-new'}">${icon('plus')}${isCloud ? 'Thêm nhân viên' : T.create}</button></div><div id="accountList"></div><p class="view-note">${isCloud ? 'Tài khoản được bảo vệ bởi Supabase Auth & Row-Level Security đa tổ chức.' : T.credentialsHint}</p>`}</div>${isCloud ? '' : `<details class="access-limits"><summary>${icon('info')}${T.local}</summary><p>${T.localWarning}</p></details>`}`;

 if(tab==='accounts'){
  if(isCloud){
   renderCloudEmployeeDirectory();
   $('accountSearch')?.addEventListener('input',e=>{accountQuery=e.target.value;renderCloudEmployeeDirectory();});
  } else {
   renderAccountList();
   $('accountSearch')?.addEventListener('input',e=>{accountQuery=e.target.value;renderAccountList();});
  }
 }
 closeSidebar();showDialog('accessDialog');
}

function renderAccountList(){
 const q=fold(accountQuery),users=getAccountsList().filter(a=>fold(a.name+' '+a.username+' '+(T[a.role]||a.role)).includes(q));
 const curId=session?.id||currentAccount()?.id;
 $('accountList').innerHTML=users.map(a=>`<article class="account-row ${a.active?'':'is-inactive'}"><span class="avatar av-${Math.max(0,ROLES.indexOf(a.role))}">${esc(initials(a.name))}</span><div class="account-main"><div><strong>${esc(a.name)}</strong>${a.id===curId?'<span class="you-badge">Bạn</span>':''}<span class="role-badge role-${a.role}">${T[a.role]||a.role}</span>${a.isCloudUser?'<span class="badge" style="font-size:11px;background:var(--primary-soft);color:var(--primary);padding:2px 6px;border-radius:4px;margin-left:4px">Cloud</span>':''}</div><p>@${esc(a.username)} · ${a.personId?esc(nodeName(a.personId)):T.noPerson}</p><small title="${esc(accountSummary(a))}">${icon('network')}${esc(accountSummary(a))}</small>${a.mustChange?`<span class="access-pending">${T.forceChange}</span>`:''}</div><div class="account-ops"><span class="access-status ${a.active?'active':''}">${a.active?T.active:T.inactive}</span><div><button class="icon-btn" data-v8="account-edit" data-user="${a.id}" ${a.isCloudUser?'disabled':''} title="${a.isCloudUser?'Tài khoản đám mây (Supabase)':T.edit}" aria-label="${T.edit}: ${esc(a.name)}">${icon('edit')}</button><button class="icon-btn" data-v8="account-reset" data-user="${a.id}" ${a.isCloudUser?'disabled':''} title="${a.isCloudUser?'Đổi mật khẩu trên đám mây':T.resetPassword}" aria-label="${T.resetPassword}: ${esc(a.name)}">${icon('key')}</button><button class="icon-btn" data-v8="account-toggle" data-user="${a.id}" ${a.id===curId||a.isCloudUser?'disabled':''} title="${a.active?T.disable:T.enable}" aria-label="${a.active?T.disable:T.enable}: ${esc(a.name)}">${icon(a.active?'lock':'check-circle')}</button></div></div></article>`).join('')||`<p class="empty-state">${T.noResults}</p>`;
}

function openAccount(id=null){
 if(window.__worktree_is_cloud_workspace){
  openAddEmployeeDialog();
  return;
 }
 if(!requireAdmin())return;const a=identity.accounts.find(a=>a.id===id);accountEditing=id;
 const curId=session?.id||currentAccount()?.id;
 $('accountContent').innerHTML=`<form id="accountForm">${dialogHead(a?T.edit:T.newAccount,'accountTitle','accountDialog')}<div class="dialog-scroll"><div class="form-error" id="accountError" role="alert" tabindex="-1" hidden></div><div class="form-grid">${field(T.name,'accountName','text',a?.name||'','required maxlength="180" autocomplete="name"')}${field(T.username,'accountUsername','text',a?.username||'','required maxlength="80" autocomplete="off" autocapitalize="none" spellcheck="false"')}<label class="field">${T.role}<select id="accountRole" ${a?.id===curId?'disabled':''}>${ROLES.map(r=>`<option value="${r}" ${(a?.role||'member')===r?'selected':''}>${T[r]}</option>`).join('')}</select></label><label class="field">${T.person}<select id="accountPerson"><option value="">${T.noPerson}</option>${permittedPeople().map(n=>`<option value="${n.id}" ${n.id===a?.personId?'selected':''}>${esc(n.name)}</option>`).join('')}</select></label>${a?'':`<div class="field full">${passwordField(T.temporary,'accountPassword')}<p class="field-hint">${T.passwordHint}</p><label class="checkbox-label account-force-change"><input id="accountForceChange" type="checkbox" checked><span>${T.forceChange}</span></label></div>`}<div class="field full" id="scopeField"><div class="scope-label"><strong>${T.scope}</strong><small id="scopeSelectedCount"></small></div><p class="field-hint">${T.scopeHint}</p><input type="search" id="scopeSearch" placeholder="Tìm nhánh..." aria-label="Tìm nhánh phân quyền"><div class="scope-picker">${data.nodes.map(n=>`<label class="scope-option" data-scope-name="${esc(fold(pathName(n.id)))}"><input type="checkbox" name="scope" value="${n.id}" ${(a?.scopes||[]).includes(n.id)?'checked':''}><span class="scope-option-main" style="--scope-indent:${Math.min(36,(pathNodes(n.id).length-1)*10)}px">${icon(nodeIcon(n.type))}<span class="scope-option-name">${esc(n.name)}</span></span><small>${TYPES[n.type]}</small></label>`).join('')}</div></div><div class="role-explanation full" id="roleExplanation"></div></div></div><div class="dialog-foot"><button type="button" class="btn" data-action="close" data-dialog="accountDialog">${T.cancel}</button><button type="submit" class="btn primary" id="accountSave">${a?T.save:T.create}</button></div></form>`;
 $('accountForm').addEventListener('submit',saveAccount);$('accountRole').addEventListener('change',updateScopeForm);$('accountPerson').addEventListener('change',()=>{if(!$('accountName').value.trim()&&$('accountPerson').value)$('accountName').value=nodeName(Number($('accountPerson').value));});
 $('scopeSearch').addEventListener('input',e=>{const q=fold(e.target.value);$$('.scope-option').forEach(el=>el.hidden=!el.dataset.scopeName.includes(q));});
 $$('#accountForm [name="scope"]').forEach(el=>el.addEventListener('change',updateScopeForm));updateScopeForm();showDialog('accountDialog','#accountName');
}
function updateScopeForm(){const r=$('accountRole').value;$('scopeField').hidden=r==='admin';$('roleExplanation').innerHTML=`<span class="role-badge role-${r}">${T[r]}</span><p>${roleDescription(r)}</p>`;$('scopeSelectedCount').textContent=$$('#accountForm [name="scope"]:checked').length+' nhánh';}
async function saveAccount(e){
 e.preventDefault();if(!requireAdmin()||$('accountSave').disabled)return;
 $('accountSave').disabled=true;$('accountError').hidden=true;
 try{
  const username=checkUsername($('accountUsername').value),name=$('accountName').value.trim(),role=$('accountRole').value,personId=Number($('accountPerson').value)||null;
  const scopes=role==='admin'?[]:$$('#accountForm [name="scope"]:checked').map(el=>Number(el.value));
  if(!name||!ROLES.includes(role))throw Error(T.name);if(role!=='admin'&&!scopes.length)throw Error(T.scopeRequired);
  if(role==='member'&&!personId)throw Error(T.personRequired);
  if(identity.accounts.some(a=>a.id!==accountEditing&&a.username===username))throw Error(T.duplicateUsername);
  if(personId&&identity.accounts.some(a=>a.id!==accountEditing&&a.personId===personId))throw Error(T.personTaken);
  const curId=session?.id||currentAccount()?.id;
  const original=identity.accounts.find(a=>a.id===accountEditing);if(original?.id===curId&&role!=='admin')throw Error(T.selfGuard);
  const revision=identityRaw;let credential=original?.credential;
  if(!original){if(identity.accounts.length>=500)throw Error('Tối đa 500 tài khoản trong bản cục bộ.');checkPassword($('accountPassword').value);credential=await makeCredential($('accountPassword').value);}
  if(!requireAdmin()||identityRaw!==revision)throw Error(T.scopeChanged);
  const next=clone(identity),a=next.accounts.find(a=>a.id===accountEditing)||{id:'u_'+crypto.randomUUID(),version:0,active:true,createdAt:new Date().toISOString(),failures:0,lockedUntil:0,mustChange:$('accountForceChange')?.checked!==false};
  Object.assign(a,{username,name,role,personId,scopes,credential,version:a.version+1});if(!original)next.accounts.push(a);
  auditEvent(next,original?T.edit:T.create,a.username);writeIdentity(next);
  if(a.id===curId){if(session)session.version=a.version;saveSession();state.currentUser=a.personId;}
  closeDialog('accountDialog',true);$('accountContent').innerHTML='';openAccess('accounts');renderAll(true);toast(T.accountSaved);
 }catch(err){if($('accountError')){$('accountError').textContent=err.message;$('accountError').hidden=false;$('accountError').focus({preventScroll:true});$('accountError').closest('.dialog-scroll').scrollTop=0;}}finally{if($('accountSave'))$('accountSave').disabled=false;}
}
async function toggleAccount(id){
 if(!requireAdmin())return;const a=identity.accounts.find(a=>a.id===id);if(!a)return;const curId=session?.id||currentAccount()?.id;if(a.id===curId)return toast(T.selfGuard,'error');
 if(a.active&&!await ask(T.disable,T.confirmDisable,T.disable,true))return;
 if(!requireAdmin())return;
 const next=clone(identity),u=next.accounts.find(a=>a.id===id);u.active=!u.active;u.version++;u.failures=0;u.lockedUntil=0;
 if(u.active){if(u.role!=='admin'&&(!u.scopes.length||u.scopes.some(id=>!byNode.has(id)))||u.role==='member'&&byNode.get(u.personId)?.type!=='person')return toast(T.linkedGuard,'error');}
 try{auditEvent(next,u.active?T.enable:T.disable,u.username);writeIdentity(next);openAccess('accounts');toast(T.saved);}catch(e){toast(e.message,'error');}
}
function openProfile(){
 if(!requireLogin())return;const a=currentAccount();
 $('profileContent').innerHTML=`${dialogHead(T.account,'profileTitle','profileDialog')}<div class="dialog-scroll"><div class="profile-summary"><span class="avatar av-2">${esc(initials(a.name))}</span><h3>${esc(a.name)}</h3><p>@${esc(a.username)}</p><span class="role-badge role-${a.role}">${T[a.role]}</span></div><div class="profile-scope"><strong>${T.scope}</strong><p>${esc(accountSummary(a))}</p><p class="muted">${roleDescription(a.role)}</p></div><div class="profile-actions"><button class="btn" data-v8="password-change">${icon('key')}${T.changePassword}</button><button class="btn" data-v8="pins-manage">${icon('pin')}${T.managePins}</button>${isAdmin()?`<button class="btn" data-v8="access-tab" data-tab="accounts">${icon('shield')}${T.accounts}</button>`:''}<button class="btn danger" data-v8="logout">${icon('logout')}${T.logout}</button></div><p class="view-note">${T.idle}</p></div>`;
 closeSidebar();showDialog('profileDialog');
}
function openPassword(target=null,forced=false){
 if(!forced&&!requireLogin())return;if(target&&!requireAdmin())return;
 passwordTarget=target;const reset=!!target&&target!==session?.id;
 $('passwordContent').innerHTML=`<form id="passwordForm">${dialogHead(reset?T.resetPassword:T.changePassword,'passwordTitle','passwordDialog')}<div class="dialog-scroll"><div class="form-error" id="passwordError" role="alert" hidden></div>${forced?`<div class="privacy-note">${T.mustChange}</div>`:''}<div class="auth-fields">${!reset&&!forced?passwordField(T.currentPassword,'oldPassword','current-password'):''}${passwordField(reset?T.temporary:T.newPassword,'newPassword')}${passwordField(T.confirmPassword,'newPasswordConfirm')}<p class="field-hint">${T.passwordHint}</p>${reset?`<p class="privacy-note">${T.forceChange}</p>`:''}</div></div><div class="dialog-foot"><button type="button" class="btn" data-action="close" data-dialog="passwordDialog">${T.cancel}</button><button type="submit" class="btn primary" id="passwordSave">${T.save}</button></div></form>`;
 $('passwordForm').addEventListener('submit',e=>savePassword(e,forced,reset));showDialog('passwordDialog',!reset&&!forced?'#oldPassword':'#newPassword');
}
async function savePassword(e,forced,reset){
 e.preventDefault();if($('passwordSave').disabled)return;$('passwordSave').disabled=true;$('passwordError').hidden=true;
 try{
  if(forced&&!pendingUser||!forced&&!requireLogin())throw Error(T.denied);
  if(reset&&!requireAdmin())throw Error(T.denied);
  const curId=session?.id||currentAccount()?.id;
  const id=forced?pendingUser.id:passwordTarget||curId,a=identity.accounts.find(a=>a.id===id);
  if(!a||!a.active||forced&&a.version!==pendingUser.version)throw Error(T.sessionExpired);
  const password=$('newPassword').value;checkPassword(password);if(password!==$('newPasswordConfirm').value)throw Error(T.passwordMismatch);
  const revision=identityRaw;
  if(!reset&&!forced&&!await verifyPassword($('oldPassword').value,a.credential))throw Error(T.badLogin);
  if(await verifyPassword(password,a.credential))throw Error(T.newPasswordDifferent);
  const credential=await makeCredential(password);
  if(localStorage.getItem(ACCESS_KEY)!==revision)throw Error(T.scopeChanged);
  if(!forced&&(reset?!requireAdmin():!requireLogin()))throw Error(T.denied);
  const next=clone(identity),u=next.accounts.find(u=>u.id===id);u.credential=credential;u.mustChange=reset;u.version++;u.failures=0;u.lockedUntil=0;
  auditEvent(next,reset?T.resetPassword:T.changePassword,u.username,forced?u.name:currentAccount().name);writeIdentity(next);
  closeDialog('passwordDialog',true);$('passwordContent').innerHTML='';pendingUser=null;
  if(forced)await enterWorkspace(u);else if(id===curId){if(session){session.version=u.version;saveSession();}}
  if($('accessDialog').open)openAccess();toast(T.passwordSaved);
 }catch(err){if($('passwordError')){$('passwordError').textContent=err.message;$('passwordError').hidden=false;}}finally{if($('passwordSave'))$('passwordSave').disabled=false;}
}
function normalPins(list){const seen=new Set();return (Array.isArray(list)?list:[]).filter(p=>{if(!p||!['node','task'].includes(p.kind)||!(Number.isSafeInteger(p.id)||(typeof p.id==='string'&&p.id.trim()))||seen.has(p.kind+':'+p.id))return false;seen.add(p.kind+':'+p.id);return true;}).slice(0,100).map(p=>({kind:p.kind,id:p.id,urgent:p.urgent===true,createdAt:typeof p.createdAt==='string'?p.createdAt:new Date().toISOString()}));}
function ownPins(){const a=currentAccount();return a?normalPins(pinDB.users[a.id]):[];}
function canPin(kind,id){return kind==='task'?canReadTask(byTask.get(id)):byNode.has(id)&&inScope(id);}
function visiblePins(){return ownPins().filter(p=>canPin(p.kind,p.id));}
function isPinned(kind,id){return ownPins().some(p=>p.kind===kind&&String(p.id)===String(id));}
function savePins(list,remember=true){
 if(!requireLogin())return false;
 try{
  const raw=localStorage.getItem(PIN_KEY);if(raw!==pinRaw){const loaded=JSON.parse(raw||'null');pinDB=loaded?.version===1&&isObject(loaded.users)?loaded:{version:1,users:{}};pinRaw=raw;throw Error(T.scopeChanged);}
   const before=ownPins(),next=clone(pinDB);const curId=session?.id||currentAccount()?.id;if(curId)next.users[curId]=normalPins(list);const packed=JSON.stringify(next);localStorage.setItem(PIN_KEY,packed);pinDB=next;pinRaw=packed;if(remember&&curId)pinUndo={user:curId,list:before};renderPins();decoratePinButtons();return true;
 }catch(e){toast(e.message===T.scopeChanged?T.scopeChanged:T.storageError,'error');renderPins();return false;}
}
function restorePins(pins){savePins(normalPins(pins).filter(p=>canPin(p.kind,p.id)));}
function togglePin(kind,id){
 if(!requireLogin()||!canPin(kind,id))return deny();const list=ownPins(),found=list.some(p=>p.kind===kind&&String(p.id)===String(id));
 if(!found&&list.length>=100)return toast(T.pinsLimit,'error');
 const next=found?list.filter(p=>!(p.kind===kind&&String(p.id)===String(id))):[{kind,id,urgent:false,createdAt:new Date().toISOString()},...list];
 if(savePins(next)){toast(found?T.pinRemoved:T.pinSaved);if($('pinDialog').open)openPins();}
}
function taskPinButton(id){const on=isPinned('task',id);return `<button class="icon-btn task-pin-btn ${on?'is-pinned':''}" data-v8="pin-toggle" data-kind="task" data-id="${id}" aria-pressed="${on}" title="${on?T.unpin:T.pin}" aria-label="${on?T.unpin:T.pin}">${icon('pin')}</button>`;}
function pinTitle(p){return p.kind==='task'?byTask.get(p.id)?.title:byNode.get(p.id)?.name;}
function pinMeta(p){const t=p.kind==='task'?byTask.get(p.id):null;return t?`${byNode.get(t.node)?.name||''} · ${t.status}`:shortPath(p.id);}
function renderPins(){
 if(!currentAccount())return;const pins=visiblePins(),show=pinsExpanded?pins:pins.slice(0,4);
 $('pinSection').innerHTML=`<div class="side-heading pin-heading"><span>${icon('pin')}${T.pins}</span><div><button class="tiny-btn" data-v8="pins-manage" title="${T.managePins}" aria-label="${T.managePins}">${icon('sliders')}</button><button class="tiny-btn" data-v8="pins-manage" title="${T.addPin}" aria-label="${T.addPin}">${icon('plus')}</button></div></div><div class="pin-personal">${T.personal}${pins.length?` <span>${pins.length}</span>`:''}</div>${show.length?show.map((p,i)=>`<div class="pin-shortcut ${p.urgent?'is-urgent':''}"><button class="pin-open" data-v8="pin-open" data-kind="${p.kind}" data-id="${p.id}" title="${esc(pinTitle(p)+' / '+pinMeta(p))}"><span class="pin-type-icon">${icon(p.kind==='task'?'check-circle':'folder')}</span><span><strong>${esc(pinTitle(p))}</strong><small>${p.urgent?T.urgent:p.kind==='task'?T.task:T.project}</small></span>${p.urgent?'<i class="pin-urgent-dot"></i>':''}</button><button class="tiny-btn pin-remove" data-v8="pin-toggle" data-kind="${p.kind}" data-id="${p.id}" aria-label="${T.unpin}: ${esc(pinTitle(p))}" title="${T.unpin}">${icon('x')}</button></div>`).join(''):`<button class="pin-empty" data-v8="pins-manage">${T.pinEmpty}</button>`}${pins.length>4?`<button class="pin-more" data-v8="pins-expand">${pinsExpanded?'Thu gọn':T.allPins+' ('+pins.length+')'}</button>`:''}`;
 const btn=$('pinCurrentNode');if(btn){const on=isPinned('node',state.selected);btn.classList.toggle('is-pinned',on);btn.setAttribute('aria-pressed',String(on));btn.title=on?T.unpin:T.pin;btn.setAttribute('aria-label',btn.title);btn.hidden=!canPin('node',state.selected);}
}
function renderTree(){
 if(!currentAccount())return;const q=fold(state.treeQuery),ids=visibleNodeIds(),matches=new Set(),forced=new Set();
 if(q)visibleNodes().filter(n=>fold(n.name+' '+n.desc).includes(q)).forEach(n=>pathNodes(n.id).forEach(p=>{matches.add(p.id);if(p.parent)forced.add(p.parent);}));
 const counts=new Map();for(const t of readableTasks())for(const n of pathNodes(t.node))counts.set(n.id,(counts.get(n.id)||0)+1);
 const row=(n,depth)=>{
  if(!ids.has(n.id)||q&&!matches.has(n.id))return '';
  const kids=childrenOf(n.id).filter(c=>ids.has(c.id)),open=q?forced.has(n.id):state.expanded.includes(n.id),on=isPinned('node',n.id);
  return `<div class="tree-node ${state.selected===n.id?'selected':''}" style="padding-left:${Math.min(depth*10,60)}px">${kids.length?`<button class="node-expand ${open?'expanded':''}" data-action="tree-toggle" data-id="${n.id}" aria-expanded="${open}" aria-label="${open?'Thu gọn':'Mở'} ${esc(n.name)}">${icon('chevron-right')}</button>`:'<span class="node-spacer"></span>'}<button class="node-select" data-action="select-node" data-id="${n.id}" ${state.selected===n.id?'aria-current="page"':''} title="${esc(pathName(n.id))}">${icon(nodeIcon(n.type))}<span class="tree-name">${esc(n.name.replace(/^Công ty /,''))}</span></button>${canPin('node',n.id)?`<button class="tiny-btn tree-pin ${on?'is-pinned':''}" data-v8="pin-toggle" data-kind="node" data-id="${n.id}" aria-pressed="${on}" title="${on?T.unpin:T.pin}" aria-label="${on?T.unpin:T.pin}: ${esc(n.name)}">${icon('pin')}</button>`:''}<span class="tree-count">${counts.get(n.id)||0}</span></div>${open?kids.map(n=>row(n,depth+1)).join(''):''}`;
 };
 $('orgTree').innerHTML=row(rootNode(),0)||`<div class="tree-empty">${T.noResults}</div>`;
 $('savedViews').innerHTML=state.savedViews.filter(v=>ids.has(v.selected)).map(v=>`<div class="saved-item"><button class="nav-item" data-action="load-view" data-id="${v.id}">${icon('bookmark')}<span>${esc(v.name)}</span></button><button class="tiny-btn" data-action="delete-view" data-id="${v.id}" aria-label="${T.close}" title="${T.close}">${icon('x')}</button></div>`).join('');renderPins();
}
function injectDrawerPin(t){const tools=$('drawerContent').querySelector('.drawer-tools');if(tools)tools.insertAdjacentHTML('afterbegin',taskPinButton(t.id));}
function decoratePinButtons(){
 if(!currentAccount())return;
 $$('#viewContent [data-action="favorite"]').forEach(b=>{
  const rawId=b.dataset.id;
  if(!rawId)return;
  const parent=b.parentElement;
  if(!parent)return;
  const existing=parent.querySelectorAll('.task-pin-btn');
  if(existing.length>1){
   for(let i=1;i<existing.length;i++)existing[i].remove();
  }
  if(existing.length===1){
   existing[0].dataset.id=rawId;
   return;
  }
  b.insertAdjacentHTML('beforebegin',taskPinButton(rawId));
 });
 $$('#viewContent [data-drag-task]').forEach(card=>{
  const rawId=card.dataset.dragTask;
  if(!rawId)return;
  const actions=card.querySelector('.board-card-actions');
  if(actions){
   const strays=card.querySelectorAll('.board-card-header > .task-pin-btn');
   strays.forEach(s=>s.remove());
  }
  const existing=card.querySelectorAll('.task-pin-btn');
  if(existing.length>1){
   for(let i=1;i<existing.length;i++)existing[i].remove();
  }
  if(existing.length===1){
   existing[0].dataset.id=rawId;
   return;
  }
  const b=card.querySelector('[data-action="favorite"]');
  (b||card).insertAdjacentHTML(b?'beforebegin':'afterbegin',taskPinButton(rawId));
 });
 $$('.task-pin-btn,.tree-pin').forEach(b=>{
  const raw=b.dataset.id;
  const on=isPinned(b.dataset.kind||'task',raw);
  b.classList.toggle('is-pinned',on);
  b.setAttribute('aria-pressed',String(on));
  b.title=on?T.unpin:T.pin;
 });
}
function openPins(){
 if(!requireLogin())return;$('pinTitle').textContent=T.pins;const pins=visiblePins();
 $('pinContent').innerHTML=`<p class="pin-description">${T.pinHint}</p><div class="pins-management">${pins.map((p,i)=>`<article class="pin-manage-row"><span class="pin-order">${String(i+1).padStart(2,'0')}</span><button class="pin-manage-open" data-v8="pin-open" data-kind="${p.kind}" data-id="${p.id}"><strong>${esc(pinTitle(p))}</strong><small>${esc(pinMeta(p))}</small></button><div class="pin-manage-controls"><button class="icon-btn ${p.urgent?'pin-urgent-active':''}" data-v8="pin-urgent" data-kind="${p.kind}" data-id="${p.id}" aria-pressed="${p.urgent}" aria-label="${T.urgent}" title="${T.urgent}">${icon('flag')}</button><button class="icon-btn" data-v8="pin-top" data-kind="${p.kind}" data-id="${p.id}" ${i===0?'disabled':''} title="${T.pinTop}" aria-label="${T.pinTop}">${icon('arrow-top')}</button><button class="icon-btn" data-v8="pin-up" data-kind="${p.kind}" data-id="${p.id}" ${i===0?'disabled':''} title="${T.up}" aria-label="${T.up}">${icon('arrow-up')}</button><button class="icon-btn" data-v8="pin-down" data-kind="${p.kind}" data-id="${p.id}" ${i===pins.length-1?'disabled':''} title="${T.down}" aria-label="${T.down}">${icon('arrow-down')}</button><button class="icon-btn" data-v8="pin-toggle" data-kind="${p.kind}" data-id="${p.id}" title="${T.unpin}" aria-label="${T.unpin}">${icon('x')}</button></div></article>`).join('')||`<div class="empty-state mini">${icon('pin')}<p>${T.pinEmpty}</p></div>`}</div>${pinUndo?.user===(session?.id||currentAccount()?.id)?`<button class="link-btn pin-undo" data-v8="pin-undo">${icon('undo')}${T.undo}</button>`:''}<div class="pin-picker-head"><h3>${T.addPin}</h3><span>${T.personal}</span></div><label class="access-search">${icon('search')}<input id="pinSearch" type="search" placeholder="${T.pinSearch}" aria-label="${T.pinSearch}" autocomplete="off"></label><div id="pinSearchResults" class="pin-search-results"></div>`;
 $('pinSearch').addEventListener('input',renderPinSearch);renderPinSearch();showDialog('pinDialog');
}
function renderPinSearch(){
 const q=fold($('pinSearch').value),nodes=data.nodes.filter(n=>canPin('node',n.id)&&!isPinned('node',n.id)&&(!q||fold(pathName(n.id)).includes(q))).sort((a,b)=>(a.type!=='project')-(b.type!=='project')).slice(0,8).map(n=>({kind:'node',id:n.id,title:n.name,meta:TYPES[n.type]}));
 const tasks=readableTasks().filter(t=>!isPinned('task',t.id)&&(!q||fold(t.title+' '+nodeName(t.node)).includes(q))).sort((a,b)=>Number(attention(b))-Number(attention(a))).slice(0,8).map(t=>({kind:'task',id:t.id,title:t.title,meta:t.status}));
 $('pinSearchResults').innerHTML=[...nodes,...tasks].map(p=>`<button class="pin-search-result" data-v8="pin-toggle" data-kind="${p.kind}" data-id="${p.id}">${icon(p.kind==='task'?'check-circle':'folder')}<span><strong>${esc(p.title)}</strong><small>${esc(p.meta)}</small></span>${icon('plus')}</button>`).join('')||`<p class="view-note">${T.noResults}</p>`;
}
function reorderPin(action,kind,id){
 if(!requireLogin())return;const list=ownPins(),visible=visiblePins(),idx=list.findIndex(p=>p.kind===kind&&String(p.id)===String(id)),vi=visible.findIndex(p=>p.kind===kind&&String(p.id)===String(id));if(idx<0||vi<0)return;
 if(action==='pin-urgent')list[idx].urgent=!list[idx].urgent;
 else{let target=action==='pin-top'?0:action==='pin-up'?vi-1:vi+1;if(target<0||target>=visible.length)return;const t=visible[target],to=list.findIndex(p=>p.kind===t.kind&&String(p.id)===String(t.id));const [p]=list.splice(idx,1);list.splice(to,0,p);}
 if(savePins(list)){openPins();renderTree();}
}
function openSettings(){
 if(!requireLogin())return;legacyOpenSettings();
 const sections=$$('.settings-section',$('settingsContent'));
 const profileSection=sections.find(s=>s.querySelector('#profileSelect'));
 if(profileSection){profileSection.innerHTML=`<h3>${icon('shield')}${T.account}</h3><div class="settings-row"><div><strong>${esc(currentAccount().name)}</strong><p>${T[currentAccount().role]} · ${esc(accountSummary(currentAccount()))}</p></div><button class="btn" data-v8="profile">${T.account}</button></div><p>${T.idle}</p>`;}
 if(!isAdmin()){sections.filter((s,i)=>[0,3,4].includes(i)).forEach(s=>s.remove());}
 const last=sections.at(-1);last.innerHTML=`<h3>${icon('info')}WorkTree X V8</h3><p>${T.localWarning}</p><p>JSON công việc không chứa tài khoản hay mật khẩu. Ghim của tài khoản đang xuất được lưu kèm trong personalPins.</p><button class="link-btn" data-v8="help">Hướng dẫn sử dụng ${icon('arrow-right')}</button>`;applyPermissionUI();
}
function openHelp(){
 if(!requireLogin())return;legacyOpenHelp();
 $('infoContent').insertAdjacentHTML('afterbegin',`<section class="help-section"><h3>V8: ${T.account} & ${T.pins}</h3><p>${T.scopeHint}</p><p>${T.pinHint} ${T.managePins}: dùng mũi tên lên/xuống hoặc Đưa lên đầu. Biểu tượng cờ chỉ đánh dấu gấp cho ghim, không đổi mức ưu tiên chung.</p><p>${T.localWarning}</p></section>`);
}
function exportJSON(){
 if(!requireAdmin())return;
 downloadFile(`WorkTree-X-V8-${TODAY}.json`,JSON.stringify({app:'WorkTree X',schemaVersion:8,exportedAt:new Date().toISOString(),timezone:TZ,data,personalPins:ownPins()},null,2),'application/json;charset=utf-8');toast(T.saved+' JSON');
}
function safeSnapshot(){
 if(!requireLogin())return null;
 if(isAdmin())return clone(data);
 const nodes=visibleNodes(),tasks=readableTasks();
 return clone({nodes,tasks:tasks.map(t=>({...t,dependencies:t.dependencies.filter(id=>canReadTask(byTask.get(id)))})),activities:data.activities.filter(canReadActivity)});
}
function permissionForAction(action,id){
 if(['access','new-node','edit-node','node-menu','delete-node','import-json','export-json','restore-backup','reset-demo','accept-recovery'].includes(action))return isAdmin();
 if(action==='new-task')return canCreateTask();
 if(['edit-task','delete-task','duplicate-task'].includes(action))return canManageTask(byTask.get(id));
 if(['complete','favorite','delete-check','timer-toggle'].includes(action))return canUpdateTask(byTask.get(id));
 if(action==='open-task')return canReadTask(byTask.get(id));
 if(action==='export-csv')return canReport();
 if(action==='delete-comment')return canUpdateTask(byTask.get(id));
 return !!currentAccount();
}
function applyPermissionUI(){
 const a=currentAccount();if(!a)return;
 $('profileRole').textContent=T[a.role];$('topAvatar').setAttribute('aria-label',T.account+': '+a.name);
 $('accessNav').hidden=!isAdmin();
 if(!isAdmin()&&state.selected===rootNode().id){$('topScope').textContent=T.allowedScope;$('pageEyebrow').textContent=T.allowedScope.toUpperCase();}
 $$('[data-action]',$('app')).concat($$('[data-action]',$('drawer'))).forEach(b=>{
  const action=b.dataset.action, rawId=b.dataset.id, id=(rawId&&!isNaN(rawId))?Number(rawId):rawId;
  if(['new-node','edit-node','node-menu','delete-node','import-json','export-json','restore-backup','reset-demo','accept-recovery','access','new-task','edit-task','delete-task','duplicate-task','export-csv'].includes(action))b.hidden=!permissionForAction(action,id);
  else if(['complete','favorite','delete-check','timer-toggle','delete-comment'].includes(action)){b.disabled=!permissionForAction(action,id);}
 });
 $$('[data-status-task],[data-owner-task],[data-priority-task],[data-check-task]').forEach(el=>{
  const rawId=el.dataset.statusTask||el.dataset.ownerTask||el.dataset.priorityTask||el.dataset.checkTask;
  const id=(rawId&&!isNaN(rawId))?Number(rawId):rawId,t=byTask.get(id);
  el.disabled=el.hasAttribute('data-owner-task')||el.hasAttribute('data-priority-task')?!canManageTask(t):!canUpdateTask(t);
 });
 const t=byTask.get(drawerId);if(t){
  for(const id of ['checklistForm','commentForm','logForm'])if($(id))$(id).hidden=!canUpdateTask(t);
  if($('drawerAutoProgress'))$('drawerAutoProgress').disabled=!canUpdateTask(t);
  $$('#drawerContent [data-action="delete-comment"]').forEach(b=>{const c=t.comments.find(c=>String(c.id)===String(b.dataset.comment));b.hidden=!canUpdateTask(t)||a.role==='member'&&c?.authorId!==a.personId;});
 }
  if($('bulkOwner'))$('bulkOwner').disabled=!['owner','admin','manager'].includes(a.role);
  if($('bulkStatus'))$('bulkStatus').disabled=a.role==='viewer';
  $$('[data-select-task],#selectPage').forEach(el=>el.disabled=a.role==='viewer');
  $$('[data-drag-task]').forEach(el=>el.draggable=canUpdateTask(byTask.get(el.dataset.dragTask)));
 decoratePinButtons();
}
function handleV8Click(e){
 const v=e.target.closest('[data-v8]'),a=e.target.closest('[data-action]');
 if(v){
  e.preventDefault();e.stopImmediatePropagation();if(v.disabled)return;
  const action=v.dataset.v8,rawId=v.dataset.id,id=(rawId&&!isNaN(rawId))?Number(rawId):rawId,kind=v.dataset.kind,user=v.dataset.user;
  if(action==='toggle-password'){const input=$(v.dataset.target);input.type=input.type==='password'?'text':'password';v.setAttribute('aria-pressed',String(input.type==='text'));return;}
  if(action==='forgot'){authError(T.forgotHelp);return;}
  if(!requireLogin())return;touchSession();
  Promise.resolve().then(async()=>{
   switch(action){
    case 'logout':await logout();break;
    case 'profile':openProfile();break;
    case 'help':openHelp();break;
    case 'access-tab':openAccess(v.dataset.tab);break;
    case 'employee-new':openAddEmployeeDialog();break;
    case 'employee-invite':openInviteExistingEmployeeDialog(v.dataset.employeeId);break;
    case 'employee-resend':await resendEmployeeInvitation(v.dataset.employeeId);break;
    case 'account-new':openAccount();break;
    case 'account-edit':openAccount(user);break;
    case 'account-reset':openPassword(user);break;
    case 'account-toggle':await toggleAccount(user);break;
    case 'password-change':openPassword();break;
    case 'pin-toggle':togglePin(kind,id);renderTree();break;
    case 'pins-manage':openPins();break;
    case 'pins-expand':pinsExpanded=!pinsExpanded;renderPins();break;
    case 'pin-open':if(!canPin(kind,id))return deny();closeDialog('pinDialog',true);closeDialog('profileDialog',true);if(kind==='task'){closeSidebar();openDrawer(id);}else selectNode(id);break;
    case 'pin-up':case 'pin-down':case 'pin-top':case 'pin-urgent':reorderPin(action,kind,id);break;
    case 'pin-undo':if(pinUndo?.user===(session?.id||currentAccount()?.id)){const list=pinUndo.list;if(savePins(list,false)){pinUndo=null;openPins();renderTree();}}break;
   }
  }).catch(err=>toast(err.message,'error'));return;
 }
 if(a){
  const action=a.dataset.action;
  if(!currentAccount()){
   if(action==='close'&&a.dataset.dialog==='passwordDialog')return;
   e.preventDefault();e.stopImmediatePropagation();return;
  }
  if(!requireLogin()){e.preventDefault();e.stopImmediatePropagation();return;}
  touchSession();
  if(action==='access'){e.preventDefault();e.stopImmediatePropagation();openAccess();return;}
  if(action==='pin-node-current'){e.preventDefault();e.stopImmediatePropagation();togglePin('node',state.selected);renderTree();return;}
  if(!permissionForAction(action,Number(a.dataset.id))){e.preventDefault();e.stopImmediatePropagation();deny();}
 }
}
document.addEventListener('click',handleV8Click,true);
document.addEventListener('keydown',e=>{
 if(!currentAccount()){if(e.target.closest('#authScreen,#passwordDialog'))return;e.stopImmediatePropagation();return;}
 if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='l'){e.preventDefault();e.stopImmediatePropagation();logout();return;}
 touchSession();
},true);
document.addEventListener('change',e=>{
 if(!currentAccount())return;
 const el=e.target,id=Number(el.dataset.statusTask||el.dataset.ownerTask||el.dataset.priorityTask||el.dataset.checkTask);
 if(id&&(!(el.dataset.ownerTask||el.dataset.priorityTask)?!canUpdateTask(byTask.get(id)):!canManageTask(byTask.get(id)))){e.stopImmediatePropagation();deny();refreshDrawer();}
},true);
['pointerdown','input','wheel'].forEach(name=>document.addEventListener(name,()=>{if(currentAccount())touchSession();},{capture:true,passive:true}));
window.addEventListener('storage',e=>{
 if(e.key===ACCESS_KEY||e.key===null){refreshIdentity();if(currentAccount()){renderAll(true);if($('accessDialog').open)openAccess();}}
 if(e.key===PIN_KEY){try{const value=JSON.parse(e.newValue||'null');pinDB=value?.version===1&&isObject(value.users)?value:{version:1,users:{}};pinRaw=e.newValue;pinUndo=null;if(currentAccount()){renderPins();decoratePinButtons();}}catch(err){}}
});
function bootV8(){
 loadData();rebuild();readIdentity();hydrateIcons();
 if(typeof $('toastRegion').showPopover==='function')$('toastRegion').setAttribute('popover','manual');
 $('viewTabs').innerHTML=Object.entries(VIEWS).map(([key,[label,ico]])=>`<button class="view-tab" role="tab" id="tab-${key}" aria-selected="${key===state.view}" aria-controls="viewContent" tabindex="${key===state.view?0:-1}" data-action="view" data-view="${key}">${icon(ico)}${label}${key==='list'?'<span class="tab-count">0</span>':''}</button>`).join('');
 window.WorkTree=Object.freeze({version:8,exportJSON,getSnapshot:safeSnapshot,validate:input=>validateData(input)});
 if(window.__WORKTREE_LEGACY_LOCAL_AUTH__){
  let previous=null;try{previous=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');}catch(e){}
  if(!identityIssue&&previous&&Number.isFinite(previous.lastActive)&&Number.isFinite(previous.startedAt)&&Date.now()-previous.lastActive<IDLE_MS&&Date.now()-previous.startedAt<MAX_SESSION_MS){session=previous;if(currentAccount())enterWorkspace(currentAccount(),false,true);else{session=null;renderAuth();}}
  else renderAuth();
 } else {
  // Production Path: Supabase Auth in src/app/app.js handles authoritative session bootstrap
  $('authScreen').hidden=false;$('app').hidden=true;$('app').inert=true;
  if(typeof window.renderSupabaseAuth==='function') window.renderSupabaseAuth();
 }
 let tick=0;setInterval(()=>{if(session||window.__worktree_supabase_user){if(!requireLogin())return;if(state.timer)$$('[data-timer-value]').forEach(el=>el.textContent=elapsedLabel());}if(++tick%30===0&&currentAccount())checkDate();},1000);
 window.openAddEmployeeDialog = openAddEmployeeDialog;
 window.openInviteExistingEmployeeDialog = openInviteExistingEmployeeDialog;
 window.renderCloudEmployeeDirectory = renderCloudEmployeeDirectory;
 window.openAccess = openAccess;
}
bootV8();
