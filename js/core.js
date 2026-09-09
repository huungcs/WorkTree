'use strict';
const SEED = {
  nodes:[
    {id:1,parent:null,type:'company',name:'Công ty Four Group',desc:'Hệ thống điều hành công việc toàn công ty'},
    {id:10,parent:1,type:'department',name:'Phòng Kinh doanh',desc:'Sales, khách hàng và doanh số'},
    {id:11,parent:1,type:'department',name:'Phòng Marketing',desc:'Content, Ads và thương hiệu'},
    {id:12,parent:1,type:'department',name:'Phòng Công nghệ',desc:'Sản phẩm, CRM, Automation'},
    {id:13,parent:1,type:'department',name:'Ban Điều hành',desc:'Mục tiêu, KPI và quản trị'},
    {id:100,parent:10,type:'project',name:'Dự án FourLand',desc:'Vận hành môi giới bất động sản'},
    {id:101,parent:11,type:'project',name:'Marketing Q3',desc:'Chiến dịch tăng trưởng quý 3'},
    {id:102,parent:12,type:'project',name:'CRM nội bộ',desc:'Xây nền tảng quản trị nội bộ'},
    {id:103,parent:12,type:'project',name:'Automation Hub',desc:'Tự động hóa đa phòng ban'},
    {id:200,parent:100,type:'team',name:'Sales Team 1',desc:'Nhóm kinh doanh nhà phố'},
    {id:201,parent:101,type:'team',name:'Content Team',desc:'Sản xuất nội dung'},
    {id:202,parent:101,type:'team',name:'Ads Team',desc:'Quảng cáo và performance'},
    {id:203,parent:102,type:'team',name:'Dev Team',desc:'Phát triển sản phẩm'},
    {id:204,parent:103,type:'team',name:'Automation Team',desc:'Workflow & AI'},
    {id:300,parent:200,type:'person',name:'Nguyễn An',desc:'Sales Executive'},
    {id:301,parent:200,type:'person',name:'Trần Linh',desc:'Sales Executive'},
    {id:302,parent:201,type:'person',name:'Phạm Chi',desc:'Content Executive'},
    {id:303,parent:202,type:'person',name:'Hoàng Vy',desc:'Performance Marketing'},
    {id:304,parent:203,type:'person',name:'Lê Nam',desc:'Full-stack Developer'},
    {id:305,parent:204,type:'person',name:'Minh Khoa',desc:'Automation Engineer'},
    {id:306,parent:13,type:'person',name:'Võ Minh',desc:'Super Admin'}
  ],
  tasks:[
    {id:1,node:100,title:'Rà soát pipeline khách hàng tháng 9',owner:300,status:'Đang làm',priority:'Cao',due:'2026-09-09',estimate:6,actual:3,progress:55,tags:['Sales','Pipeline'],desc:'Kiểm tra lead mới, lịch hẹn, khách nóng và tỷ lệ chốt theo từng nguồn.',dependency:'Không có',checklist:[['Tổng hợp lead mới',true],['Phân nhóm khách nóng',true],['Chốt lịch follow-up',false]]},
    {id:2,node:300,title:'Gọi lại 12 khách đang quan tâm',owner:300,status:'Chưa làm',priority:'Khẩn cấp',due:'2026-09-08',estimate:4,actual:0,progress:15,tags:['Follow-up','Urgent'],desc:'Ưu tiên khách có nhu cầu thuê hoặc mua trong 7 ngày tới.',dependency:'Phụ thuộc task #1',checklist:[['Chuẩn bị danh sách',true],['Gọi khách',false],['Cập nhật CRM',false]]},
    {id:3,node:101,title:'Lập kế hoạch content 14 ngày',owner:302,status:'Chờ duyệt',priority:'Trung bình',due:'2026-09-10',estimate:5,actual:4,progress:85,tags:['Content','Planning'],desc:'Kế hoạch Facebook, Reels, TikTok theo trụ cột nội dung và mục tiêu chuyển đổi.',dependency:'Không có',checklist:[['Research topic',true],['Viết calendar',true],['Trình duyệt',false]]},
    {id:4,node:201,title:'Thiết kế 5 creative mới',owner:302,status:'Đang làm',priority:'Cao',due:'2026-09-11',estimate:8,actual:5,progress:62,tags:['Creative','Design'],desc:'Tạo 5 góc visual khác nhau để test hook và CTR.',dependency:'Phụ thuộc task #3',checklist:[['Creative 1',true],['Creative 2',true],['Creative 3',false],['Creative 4',false],['Creative 5',false]]},
    {id:5,node:102,title:'Hoàn thiện cây phân quyền hệ thống',owner:304,status:'Đang làm',priority:'Khẩn cấp',due:'2026-09-12',estimate:14,actual:8,progress:68,tags:['CRM','Permission','Backend'],desc:'Phân quyền dữ liệu theo Công ty → Phòng ban → Dự án → Nhóm → Cá nhân.',dependency:'Phụ thuộc schema user/role',checklist:[['Role matrix',true],['Scope inheritance',true],['UI quyền',false],['Audit log',false]]},
    {id:6,node:203,title:'Xây màn hình WorkTree',owner:304,status:'Hoàn thành',priority:'Cao',due:'2026-09-07',estimate:10,actual:9,progress:100,tags:['Frontend','UX'],desc:'Cây thư mục nhiều cấp, điều hướng scope và tổng hợp task theo nhánh.',dependency:'Không có',checklist:[['Tree UI',true],['Scope filter',true],['Responsive',true]]},
    {id:7,node:13,title:'Tổng hợp KPI tuần',owner:306,status:'Chưa làm',priority:'Cao',due:'2026-09-09',estimate:3,actual:0,progress:0,tags:['KPI','Management'],desc:'Tổng hợp KPI phòng ban, dự án và các task có rủi ro.',dependency:'Chờ dữ liệu cuối ngày',checklist:[['Sales KPI',false],['Marketing KPI',false],['Tech KPI',false]]},
    {id:8,node:202,title:'Tối ưu CPA chiến dịch lead',owner:303,status:'Đang làm',priority:'Cao',due:'2026-09-10',estimate:6,actual:4,progress:60,tags:['Ads','CPA'],desc:'Rà soát campaign, adset, creative và phân bổ ngân sách.',dependency:'Không có',checklist:[['Audit campaign',true],['Audit creative',true],['Kế hoạch tối ưu',false]]},
    {id:9,node:103,title:'Xây workflow báo cáo tự động',owner:305,status:'Đang làm',priority:'Trung bình',due:'2026-09-13',estimate:8,actual:2,progress:35,tags:['Automation','Reporting'],desc:'Tự động gom KPI từ nhiều nguồn và gửi báo cáo mỗi sáng.',dependency:'Chờ quyền truy cập dữ liệu',checklist:[['Mapping nguồn',true],['Workflow',false],['Test alert',false]]},
    {id:10,node:204,title:'Chuẩn hóa trigger và idempotency',owner:305,status:'Chưa làm',priority:'Trung bình',due:'2026-09-14',estimate:5,actual:0,progress:5,tags:['Automation','Reliability'],desc:'Đảm bảo workflow không chạy trùng và có retry an toàn.',dependency:'Phụ thuộc task #9',checklist:[['Trigger rules',false],['Idempotency key',false],['Retry policy',false]]}
  ]
};

const APP_VERSION=8;
const KEYS={data:'worktree_x_v8_data',backup:'worktree_x_v8_backup',prefs:'worktree_x_v8_prefs',legacy:'worktree_x_v7_data'};
const TZ='Asia/Ho_Chi_Minh';
const STATUS=['Chưa làm','Đang làm','Chờ duyệt','Hoàn thành'];
const PRIORITY=['Khẩn cấp','Cao','Trung bình','Thấp'];
const TYPES={company:'Công ty',department:'Phòng ban',project:'Dự án',team:'Nhóm',person:'Nhân sự',folder:'Thư mục'};
const VIEWS={overview:['Tổng quan','dashboard'],list:['Danh sách','list'],kanban:['Bảng Kanban','kanban'],timeline:['Tiến độ','gantt'],calendar:['Lịch','calendar'],workload:['Tải công việc','chart'],children:['Đơn vị con','folders']};
const ICONS={
 panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="18" width="7" height="3" rx="1"/>',
 'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 circle:'<circle cx="12" cy="12" r="8"/>',
 layers:'<path d="m12 3 10 5-10 5L2 8z"/><path d="m2 12 10 5 10-5M2 16l10 5 10-5"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2M8 18h2"/>',
 inbox:'<path d="M4 4h16l2 11v5H2v-5z"/><path d="M2 15h6l2 3h4l2-3h6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 minus:'<path d="M5 12h14"/>',
 x:'<path d="m6 6 12 12M6 18 18 6"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 chevrons:'<path d="m8 8 4-4 4 4m-8 8 4 4 4-4"/>',
 'chevron-right':'<path d="m9 5 7 7-7 7"/>',
 'chevron-left':'<path d="m15 5-7 7 7 7"/>',
 'chevron-down':'<path d="m5 9 7 7 7-7"/>',
 unfold:'<path d="m8 8 4-4 4 4m-8 8 4 4 4-4M4 12h16"/>',
 shield:'<path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7z"/><path d="m8 12 3 3 5-6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
 'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
 'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 settings:'<path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
 building:'<path d="M3 21h18M5 21V4h14v17M9 8h1m4 0h1M9 12h1m4 0h1M10 21v-5h4v5"/>',
 undo:'<path d="M3 5v6h6M3 11a8 8 0 1 1 3 8"/>',
 redo:'<path d="M21 5v6h-6m6 0a8 8 0 1 0-3 8"/>',
 moon:'<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 20h4"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 sliders:'<path d="M4 6h9m4 0h3M4 12h3m4 0h9M4 18h10m4 0h2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
 bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
 keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/>',
 alert:'<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
 kanban:'<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
 gantt:'<path d="M4 3v18h17M7 7h10M11 12h10M7 17h7"/>',
 chart:'<path d="M4 21V10h4v11M10 21V3h4v18M16 21V7h4v14"/>',
 folders:'<path d="M3 9V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v3M2 10h7l2 3h11l-3 8H4z"/>',
 folder:'<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 network:'<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/>',
 users:'<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 4 6"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 flag:'<path d="M4 22V3m0 0c6-4 10 4 16 0v10c-6 4-10-4-16 0"/>',
 high:'<path d="m6 14 6-6 6 6m-12 5 6-6 6 6"/>',
 equal:'<path d="M6 9h12M6 15h12"/>',
 low:'<path d="m6 8 6 6 6-6"/>',
 sparkles:'<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6zM20 2v4m-2-2h4"/>',
 star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
 edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15z"/>',
 trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
 link:'<path d="m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
 message:'<path d="M21 15a3 3 0 0 1-3 3H7l-5 4V5a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3z"/><path d="M7 7h9M7 12h6"/>',
 enter:'<path d="M20 4v10H4m5-5-5 5 5 5"/>',
 play:'<path d="m7 3 14 9-14 9z"/>',
 stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5m11 0a8 8 0 0 0-14-5M4 12a8 8 0 0 0 14 5"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
 file:'<path d="M14 2H4v20h16V8zM14 2v6h6M8 13h8M8 17h6"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M9 12h6"/>'
};
const $=id=>document.getElementById(id);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,extra='')=>`<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.folder}</svg>`;
function hydrateIcons(root=document){$$('[data-icon]',root).forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
const clone=v=>JSON.parse(JSON.stringify(v));
const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLocaleLowerCase('vi').trim();
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const fmt=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1});
const num=n=>fmt.format(Number(n)||0);
const uid=()=>Date.now()*1000+Math.floor(Math.random()*1000);
const blankFilters=()=>({q:'',status:'',priority:'',owner:'',due:'',favorite:false});
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function dateISO(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=t=>parts.find(p=>p.type===t).value;return `${get('year')}-${get('month')}-${get('day')}`;
}
let TODAY=dateISO();
function dayDate(s){return new Date(`${s}T12:00:00Z`);}
function addDays(s,days){const d=dayDate(s);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function dayDiff(a,b){return Math.round((dayDate(b)-dayDate(a))/86400000);}
function weekday(s){return dayDate(s).getUTCDay();}
function weekStart(s){return addDays(s,-((weekday(s)+6)%7));}
function monthStart(s){return s.slice(0,7)+'-01';}
function addMonths(s,n){const d=dayDate(monthStart(s));d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10);}
function validDate(s){if(!s)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'1900-01-01'||s>'9999-12-31')return false;const d=dayDate(s);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
function formatDate(s,year=false){if(!s)return 'Chưa có hạn';return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',...(year?{year:'numeric'}:{}),timeZone:'UTC'}).format(dayDate(s));}
function timeAgo(s){if(!s)return 'Dữ liệu đã nhập';const ms=Date.now()-new Date(s).getTime();if(!Number.isFinite(ms))return '';if(ms<60000)return 'Vừa xong';if(ms<3600000)return `${Math.floor(ms/60000)} phút trước`;if(ms<86400000)return `${Math.floor(ms/3600000)} giờ trước`;return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:TZ}).format(new Date(s));}
function safeStamp(v){return typeof v==='string'&&v.length<40&&Number.isFinite(Date.parse(v))?v:'';}
function text(v,max,label,required=false){if(v==null&&!required)return '';if(typeof v!=='string')throw Error(`${label} phải là văn bản.`);v=v.trim();if(required&&!v)throw Error(`${label} không được để trống.`);if(v.length>max)throw Error(`${label} vượt quá ${max} ký tự.`);return v;}
function numeric(v,min,max,label,fallback=0){if(v==null||v==='')return fallback;if(typeof v!=='number'&&typeof v!=='string')throw Error(`${label} không hợp lệ.`);const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(`${label} phải từ ${min} đến ${max}.`);return n;}
function numericId(v,label){if(!Number.isSafeInteger(v)||v<=0)throw Error(`${label} phải là số nguyên dương an toàn.`);return v;}
function validateData(input){
 if(!isObject(input))throw Error('Tệp phải chứa một đối tượng JSON.');
 if(input.schemaVersion&&Number(input.schemaVersion)>APP_VERSION)throw Error('Tệp này được tạo bởi phiên bản mới hơn V8.');
 const src=isObject(input.data)?input.data:input;
 if(!Array.isArray(src.nodes)||!Array.isArray(src.tasks))throw Error('Thiếu hai danh sách nodes và tasks.');
 if(!src.nodes.length||src.nodes.length>3000)throw Error('Cần từ 1 đến 3.000 đơn vị.');
 if(src.tasks.length>15000)throw Error('Tối đa 15.000 công việc trong bản cục bộ.');
 const warnings=[];const nodeIds=new Set();const taskIds=new Set();
 const nodes=src.nodes.map(n=>{
  if(!isObject(n))throw Error('Đơn vị không hợp lệ.');
  const id=numericId(n.id,'Mã đơn vị');if(nodeIds.has(id))throw Error(`Trùng mã đơn vị #${id}.`);nodeIds.add(id);
  if(!Object.hasOwn(TYPES,n.type))throw Error(`Loại đơn vị #${id} không hợp lệ.`);
  return {id,parent:n.parent===null?null:numericId(n.parent,'Mã đơn vị cha'),type:n.type,name:text(n.name,180,'Tên đơn vị',true),desc:text(n.desc,10000,'Mô tả đơn vị'),capacity:numeric(n.capacity,0,168,'Năng lực tuần',40)};
 });
 const roots=nodes.filter(n=>n.parent===null);if(roots.length!==1)throw Error('Cây tổ chức phải có đúng một đơn vị gốc.');
 if(roots[0].type!=='company')throw Error('Đơn vị gốc phải có loại company.');
 const byNode=new Map(nodes.map(n=>[n.id,n]));const byParent=new Map();
 for(const n of nodes){
  if(n.parent===n.id)throw Error('Một đơn vị không thể làm cha của chính nó.');
  if(n.parent!==null&&!nodeIds.has(n.parent))throw Error(`Không tìm thấy đơn vị cha của "${n.name}".`);
  if(n.parent!==null){if(!byParent.has(n.parent))byParent.set(n.parent,[]);byParent.get(n.parent).push(n.id);}
 }
 const visited=new Set();const queue=[[roots[0].id,0]];let pos=0;
 while(pos<queue.length){const [id,depth]=queue[pos++];if(visited.has(id))throw Error('Cây tổ chức bị vòng lặp.');if(depth>30)throw Error('Cây tổ chức không được sâu quá 30 cấp.');visited.add(id);for(const cid of byParent.get(id)||[])queue.push([cid,depth+1]);}
 if(visited.size!==nodes.length)throw Error('Cây tổ chức có vòng lặp hoặc nhánh không nối với đơn vị gốc.');
 for(const t of src.tasks){if(!isObject(t))throw Error('Công việc không hợp lệ.');numericId(t.id,'Mã công việc');if(taskIds.has(t.id))throw Error(`Trùng mã công việc #${t.id}.`);taskIds.add(t.id);}
 let repairedOwners=0;
 const tasks=src.tasks.map(t=>{
  if(!nodeIds.has(t.node))throw Error(`Công việc #${t.id} thuộc đơn vị không tồn tại.`);
  if(!STATUS.includes(t.status))throw Error(`Trạng thái công việc #${t.id} không hợp lệ.`);
  if(!PRIORITY.includes(t.priority))throw Error(`Mức ưu tiên công việc #${t.id} không hợp lệ.`);
  let owner=t.owner===null||t.owner==null?null:t.owner;
  if(owner!==null&&byNode.get(owner)?.type!=='person'){owner=null;repairedOwners++;}
  const due=text(t.due,10,'Hạn hoàn thành'),start=text(t.start,10,'Ngày bắt đầu');
  if(!validDate(due)||!validDate(start))throw Error(`Ngày tháng của công việc #${t.id} không hợp lệ.`);
  if(start&&due&&start>due)throw Error(`Ngày bắt đầu sau hạn hoàn thành của công việc #${t.id}.`);
  const tags=t.tags??[];if(!Array.isArray(tags)||tags.length>20)throw Error('Tối đa 20 thẻ cho mỗi công việc.');
  const checks=t.checklist??[];if(!Array.isArray(checks)||checks.length>200)throw Error('Tối đa 200 mục checklist.');
  const comments=t.comments??[];if(!Array.isArray(comments)||comments.length>500)throw Error('Tối đa 500 bình luận cho mỗi công việc.');
  const logs=t.logs??[];if(!Array.isArray(logs)||logs.length>1000)throw Error('Tối đa 1.000 lần ghi giờ cho mỗi công việc.');
  const dependency=text(t.dependency,1000,'Ghi chú phụ thuộc');
  let dependencies=t.dependencies;
  if(dependencies===undefined)dependencies=[...dependency.matchAll(/#(\d+)/g)].map(m=>Number(m[1])).filter(id=>taskIds.has(id)&&id!==t.id);
  if(!Array.isArray(dependencies)||dependencies.length>200)throw Error('Danh sách phụ thuộc không hợp lệ.');
  dependencies=[...new Set(dependencies.map(v=>numericId(v,'Mã phụ thuộc')))];
  if(dependencies.includes(t.id))throw Error('Công việc không thể phụ thuộc chính nó.');
  if(dependencies.some(id=>!taskIds.has(id)))throw Error(`Công việc #${t.id} có phụ thuộc không tồn tại.`);
  return {
   id:t.id,node:t.node,title:text(t.title,240,'Tên công việc',true),owner,status:t.status,priority:t.priority,due,start,
   estimate:numeric(t.estimate,0,10000,'Giờ ước tính'),actual:numeric(t.actual,0,10000,'Giờ đã làm'),
   progress:t.status==='Hoàn thành'?100:Math.round(numeric(t.progress,0,100,'Tiến độ')),
   desc:text(t.desc,20000,'Mô tả công việc'),tags:[...new Set(tags.map(x=>text(x,40,'Thẻ',true)))],
   dependency,dependencies,checklist:checks.map(x=>{
    if(!Array.isArray(x)||x.length<2||typeof x[1]!=='boolean')throw Error('Mục checklist phải có tên và giá trị true / false.');
    return [text(x[0],400,'Nội dung checklist',true),x[1]];
   }),autoProgress:t.autoProgress===true,favorite:t.favorite===true,
   comments:comments.map(c=>{if(!isObject(c))throw Error('Bình luận không hợp lệ.');return {id:numericId(c.id,'Mã bình luận'),author:text(c.author,180,'Tên người bình luận',true),authorId:nodeIds.has(c.authorId)?c.authorId:null,text:text(c.text,2000,'Nội dung bình luận',true),at:safeStamp(c.at)};}),
   logs:logs.map(l=>{if(!isObject(l))throw Error('Bản ghi thời gian không hợp lệ.');return {id:numericId(l.id,'Mã ghi giờ'),hours:numeric(l.hours,0,10000,'Số giờ'),note:text(l.note,500,'Ghi chú giờ'),at:safeStamp(l.at),author:text(l.author,180,'Người ghi giờ')};}),
   createdAt:safeStamp(t.createdAt),updatedAt:safeStamp(t.updatedAt),
   resumeProgress:numeric(t.resumeProgress,0,100,'Tiến độ trước hoàn thành',0),
   resumeStatus:STATUS.includes(t.resumeStatus)&&t.resumeStatus!=='Hoàn thành'?t.resumeStatus:'Đang làm'
  };
 });
 const indegree=new Map(tasks.map(t=>[t.id,t.dependencies.length]));const dependents=new Map();
 tasks.forEach(t=>t.dependencies.forEach(id=>{if(!dependents.has(id))dependents.set(id,[]);dependents.get(id).push(t.id);}));
 const ready=tasks.filter(t=>!t.dependencies.length).map(t=>t.id);let processed=0;
 for(let i=0;i<ready.length;i++){processed++;for(const id of dependents.get(ready[i])||[]){indegree.set(id,indegree.get(id)-1);if(indegree.get(id)===0)ready.push(id);}}
 if(processed!==tasks.length)throw Error('Các công việc đang phụ thuộc vòng lẫn nhau. Hãy bỏ ít nhất một liên kết trong vòng.');
 if(repairedOwners)warnings.push(`${repairedOwners} công việc có người phụ trách không còn tồn tại đã được chuyển thành "Chưa giao".`);
 const activities=(Array.isArray(src.activities)?src.activities:[]).slice(-500).filter(isObject).map(a=>({
  id:Number.isSafeInteger(a.id)?a.id:uid(),at:safeStamp(a.at),actor:text(typeof a.actor==='string'?a.actor:'',180,'Người thao tác'),action:text(typeof a.action==='string'?a.action:'',300,'Hoạt động'),taskId:taskIds.has(a.taskId)?a.taskId:null,nodeId:nodeIds.has(a.nodeId)?a.nodeId:null,title:text(typeof a.title==='string'?a.title:'',240,'Tên trong nhật ký')
 }));
 return {data:{nodes,tasks,activities},warnings};
}
let data,byNode=new Map(),byTask=new Map(),byParent=new Map(),subtreeCache=new Map();
let storageIssue='',storageProtected=false,lastRaw=null,externalRaw=null;
let migrationMessage='',pendingImport=null,editingTask=null,editingNode=null,drawerId=null,dirtyTask=false,dirtyNode=false;
let history=[],future=[],confirmResolver=null,commandOptions=[],commandIndex=0,returnFocus=new Map();
let state={
 selected:1,view:'overview',includeChildren:true,collapsed:false,mobileOpen:false,filterOpen:false,filters:blankFilters(),sort:'smart',page:1,pageSize:15,
 focusTab:'attention',expanded:[1,10,11,12,13],treeQuery:'',theme:'light',density:'comfortable',currentUser:306,savedViews:[],
 timelineStart:addDays(TODAY,-2),timelineDays:14,calendarMonth:monthStart(TODAY),workloadWeek:weekStart(TODAY),timer:null,selectedTasks:new Set()
};
function getAvatarIndex(id) {
 if (typeof id === 'number') return Math.abs(id) % 6;
 if (typeof id === 'string') {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
   hash = ((hash << 5) - hash) + id.charCodeAt(i);
   hash |= 0;
  }
  return Math.abs(hash) % 6;
 }
 return 0;
}
function rebuild(){
 if(!data || !Array.isArray(data.nodes)) return;
 byNode=new Map(data.nodes.map(n=>[n.id,n]));byTask=new Map(data.tasks.map(t=>[t.id,t]));byParent=new Map();subtreeCache=new Map();
 data.nodes.forEach(n=>{if(!byParent.has(n.parent))byParent.set(n.parent,[]);byParent.get(n.parent).push(n);});
 if(!byNode.has(state.selected))state.selected=rootNode()?.id ?? null;
 if(!byNode.has(state.currentUser)||(byNode.get(state.currentUser)?.type!=='person' && !window.__worktree_is_cloud_workspace))state.currentUser=people()[0]?.id??null;
 if(state.filters.owner&&state.filters.owner!=='unassigned'&&!byNode.has(state.filters.owner)&&!window.employeesById?.has(state.filters.owner))state.filters.owner='';
 state.selectedTasks=new Set([...state.selectedTasks].filter(id=>byTask.has(id)));
 if(state.timer&&!byTask.has(state.timer.taskId))state.timer=null;
}
function rootNode(){return data?.nodes?.find(n=>n.parent===null) || null;}
function childrenOf(id){return byParent.get(id)||[];}
function subtree(id){
 if(subtreeCache.has(id))return subtreeCache.get(id);
 const ids=new Set([id]),stack=[id];while(stack.length){for(const n of childrenOf(stack.pop())){if(!ids.has(n.id)){ids.add(n.id);stack.push(n.id);}}}
 subtreeCache.set(id,ids);return ids;
}
function people(){
 if (window.__worktree_is_cloud_workspace && Array.isArray(window.cloudEmployees)) {
  return window.cloudEmployees;
 }
 return permittedPeople();
}
function nodeName(id){
 return byNode.get(id)?.name || window.employeesById?.get(id)?.full_name || window.employeesById?.get(id)?.name || 'Chưa giao';
}
function person(){return currentPerson();}

function initials(name){return String(name||'?').trim().split(/\s+/).slice(-2).map(x=>x[0]||'').join('').toUpperCase();}
function avatar(id,extra=''){
 const name=nodeName(id);
 const colorIdx=getAvatarIndex(id);
 return `<span class="avatar av-${colorIdx} ${extra}" title="${esc(name)}" aria-label="${esc(name)}">${esc(id?initials(name):'?')}</span>`;
}
function nodeIcon(type){return {company:'building',department:'network',project:'folder',team:'users',person:'user',folder:'folder'}[type]||'folder';}
function pathNodes(id){const arr=[];let n=byNode.get(id);const seen=new Set();while(n&&!seen.has(n.id)){arr.unshift(n);seen.add(n.id);n=byNode.get(n.parent);}return arr;}
function pathName(id){return pathNodes(id).map(n=>n.name).join(' / ');}
function shortPath(id){const p=pathNodes(id);return p.slice(p.length>1?1:0).map(n=>n.name).join(' / ');}
function statusClass(s){return ['s-todo','s-doing','s-review','s-done'][STATUS.indexOf(s)]||'s-todo';}
function priorityClass(p){return ['p-urgent','p-high','p-medium','p-low'][PRIORITY.indexOf(p)]||'p-medium';}
function priorityIcon(p){return ['flag','high','equal','low'][PRIORITY.indexOf(p)]||'equal';}
function statusBadge(s){return `<span class="status ${statusClass(s)}">${esc(s)}</span>`;}
function priorityBadge(p){return `<span class="priority ${priorityClass(p)}">${icon(priorityIcon(p))}${esc(p)}</span>`;}
function progressBar(p,green=false){return `<div class="progress-wrap"><div class="progress ${green?'green':''}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ"><i style="width:${p}%"></i></div><span>${p}%</span></div>`;}
function blockers(t,source=byTask){return (t.dependencies||[]).map(id=>source.get(id)).filter(d=>d&&d.status!=='Hoàn thành');}
function isLate(t){return t.status!=='Hoàn thành'&&!!t.due&&t.due<TODAY;}
function isToday(t){return t.status!=='Hoàn thành'&&t.due===TODAY;}
function attention(t){return t.status!=='Hoàn thành'&&(isLate(t)||isToday(t)||t.priority==='Khẩn cấp'||blockers(t).length>0);}
function dateLabel(t,withIcon=false){
 const late=isLate(t),today=isToday(t);let label=t.due?formatDate(t.due,t.due.slice(0,4)!==TODAY.slice(0,4)):'Chưa có hạn';
 if(today)label='Hôm nay';else if(t.status!=='Hoàn thành'&&t.due===addDays(TODAY,1))label='Ngày mai';
 return `<span class="date-text ${late?'late':today?'today':''}" title="${esc(t.due?(late?`Quá hạn ${dayDiff(t.due,TODAY)} ngày · `:'')+formatDate(t.due,true):'Chưa đặt hạn hoàn thành')}">${withIcon?icon(late?'alert':'calendar'):''}${esc(label)}</span>`;
}
function avgProgress(arr){return arr.length?Math.round(arr.reduce((s,t)=>s+t.progress,0)/arr.length):0;}
function filterObject(f){
 if(!isObject(f))return blankFilters();
 return {q:typeof f.q==='string'?f.q.slice(0,240):'',status:STATUS.includes(f.status)?f.status:'',priority:PRIORITY.includes(f.priority)?f.priority:'',
 owner:f.owner==='unassigned'?'unassigned':String(f.owner??'').match(/^\d+$/)?String(f.owner):'',
 due:['late','today','week','unscheduled','attention'].includes(f.due)?f.due:'',favorite:f.favorite===true};
}
function legacyLoadPrefs(){
 try{
  const p=JSON.parse(localStorage.getItem(KEYS.prefs)||'null');if(!isObject(p))return;
  if(Number.isSafeInteger(p.selected))state.selected=p.selected;if(Object.hasOwn(VIEWS,p.view))state.view=p.view;
  if(typeof p.includeChildren==='boolean')state.includeChildren=p.includeChildren;
  state.collapsed=p.collapsed===true;state.filterOpen=p.filterOpen===true;state.filters=filterObject(p.filters);
  if(['smart','due','priority','title','updated'].includes(p.sort))state.sort=p.sort;
  if([15,30,50].includes(p.pageSize))state.pageSize=p.pageSize;
  if(['light','dark','auto'].includes(p.theme))state.theme=p.theme;if(['comfortable','compact'].includes(p.density))state.density=p.density;
  if(Number.isSafeInteger(p.currentUser))state.currentUser=p.currentUser;
  if(Array.isArray(p.expanded))state.expanded=p.expanded.filter(Number.isSafeInteger).slice(0,3000);
  if(Array.isArray(p.savedViews))state.savedViews=p.savedViews.slice(0,20).filter(v=>isObject(v)&&typeof v.name==='string'&&Number.isSafeInteger(v.id)&&Number.isSafeInteger(v.selected)&&Object.hasOwn(VIEWS,v.view)).map(v=>({id:v.id,name:v.name.slice(0,60),selected:v.selected,view:v.view,includeChildren:v.includeChildren!==false,filters:filterObject(v.filters),sort:['smart','due','priority','title','updated'].includes(v.sort)?v.sort:'smart'}));
  if(isObject(p.timer)&&Number.isSafeInteger(p.timer.taskId)&&Number.isFinite(p.timer.startedAt)&&p.timer.startedAt>0&&p.timer.startedAt<Date.now()+60000)state.timer={taskId:p.timer.taskId,startedAt:p.timer.startedAt};
 }catch(e){/* A damaged preference file must never prevent opening the workspace. */}
}
function loadData(){
 if(window.__worktree_is_cloud_workspace){
  data = { nodes: [], tasks: [], activities: [] };
  return;
 }
 try{
  lastRaw=localStorage.getItem(KEYS.data);
  if(lastRaw){try{data=validateData(JSON.parse(lastRaw)).data;return;}catch(e){
    storageProtected=true;storageIssue='Dữ liệu chính không đọc được. Đang dùng bản phục hồi; chưa ghi đè dữ liệu gốc.';
    try{const backup=localStorage.getItem(KEYS.backup);if(backup){data=validateData(JSON.parse(backup)).data;return;}}catch(_){}
    data=validateData(SEED).data;storageIssue='Dữ liệu lưu bị lỗi và chưa có bản phục hồi hợp lệ. Đang mở dữ liệu mẫu; tệp lưu gốc chưa bị ghi đè.';return;
  }}
  const old=(localStorage.getItem(KEYS.legacy)||localStorage.getItem('worktree_x_v5_editable'));
  if(old){try{const result=validateData(JSON.parse(old));data=result.data;migrationMessage='Đã chuyển dữ liệu V5/V6/V7 sang V8. Bản cũ được giữ nguyên.';if(result.warnings.length)migrationMessage+=' '+result.warnings.join(' ');return;}catch(e){storageIssue='Dữ liệu V5/V6 không hợp lệ. Đang mở dữ liệu mẫu; khóa dữ liệu cũ được giữ nguyên.';}}
 }catch(e){storageIssue='Trình duyệt không cho phép lưu cục bộ. Các thay đổi chỉ nằm trong phiên này; hãy xuất JSON để giữ dữ liệu.';}
 if(storageIssue&&!storageProtected&&!migrationMessage)migrationMessage=storageIssue;
 data=validateData(SEED).data;
}
function prefsObject(){return {selected:state.selected,view:state.view,includeChildren:state.includeChildren,collapsed:state.collapsed,filterOpen:state.filterOpen,filters:state.filters,sort:state.sort,pageSize:state.pageSize,theme:state.theme,density:state.density,currentUser:state.currentUser,expanded:state.expanded,savedViews:state.savedViews,timer:state.timer};}
function legacySavePrefs(){try{localStorage.setItem(KEYS.prefs,JSON.stringify(prefsObject()));}catch(e){/* Dataset save status is handled independently. */}}
function persistData(force=false){
 if(window.__worktree_is_cloud_workspace){
  if($('saveStatus')) $('saveStatus').textContent='Đồng bộ đám mây Supabase';
  if($('saveDot')) $('saveDot').classList.remove('error');
  return true;
 }
 if(storageProtected&&!force){renderStorage();return false;}
 try{
  const current=localStorage.getItem(KEYS.data);
  if(!force&&current!==lastRaw){externalRaw=current;renderStorage();return false;}
  const packed=JSON.stringify({schemaVersion:APP_VERSION,app:'WorkTree X',revision:uid(),savedAt:new Date().toISOString(),data});
  if(current&&!storageProtected)localStorage.setItem(KEYS.backup,current);
  localStorage.setItem(KEYS.data,packed);lastRaw=packed;storageProtected=false;externalRaw=null;storageIssue='';
  $('saveStatus').textContent='Đã lưu trên trình duyệt này';$('saveDot').classList.remove('error');renderStorage();return true;
 }catch(e){storageIssue='Không lưu được dữ liệu (bộ nhớ đầy hoặc bị chặn). Thay đổi vẫn ở trong phiên này. Hãy xuất JSON ngay.';renderStorage();return false;}
}
function renderStorage(){
 const banner=$('storageBanner');const problem=externalRaw!==null?'Dữ liệu đã thay đổi ở một tab khác. Tải bản mới trước khi sửa tiếp để tránh ghi đè.':storageIssue;
 banner.hidden=!problem;
 if(problem)banner.innerHTML=`${icon('alert')}<span>${esc(problem)}</span>${externalRaw!==null?'<button class="btn" data-action="load-external">Tải bản mới</button>':''}${storageProtected?'<button class="btn" data-action="accept-recovery">Dùng bản đang mở</button>':''}<button class="btn" data-action="export-json">Sao lưu JSON</button>`;
 $('saveStatus').textContent=problem?'Chưa xác nhận lưu · Nên xuất JSON':'Đã lưu trên trình duyệt này';
 $('saveDot').classList.toggle('error',!!problem);
}
function applyTheme(){
 const dark=state.theme==='dark'||(state.theme==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
 document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.dataset.density=state.density;
 $('themeBtn').innerHTML=icon(dark?'sun':'moon');$('themeBtn').title=dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';
 document.querySelector('meta[name="theme-color"]').content=dark?'#111622':'#f7f8fb';
}
function applySidebar(){
 const mobile=innerWidth<=900;
 const expanded=mobile?state.mobileOpen:!state.collapsed;
 const toggleLabel=mobile?(expanded?'Đóng thanh điều hướng':'Mở thanh điều hướng'):(expanded?'Thu gọn thanh điều hướng':'Mở rộng thanh điều hướng');
 $$('[data-action="sidebar"]').forEach(button=>{
  button.setAttribute('aria-controls','sidebar');
  button.setAttribute('aria-expanded',String(expanded));
  button.setAttribute('aria-label',toggleLabel);
  button.title=toggleLabel+(mobile?'':' (Ctrl+B)');
 });
 $('app').classList.toggle('collapsed',!mobile&&state.collapsed);
 $('sidebar').classList.toggle('mobile-open',mobile&&state.mobileOpen);
 $('sidebarScrim').hidden=!(mobile&&state.mobileOpen);
 $('sidebar').inert=mobile&&!state.mobileOpen;
 $('mainShell').inert=mobile&&state.mobileOpen;
 if(mobile&&state.mobileOpen){$('sidebar').setAttribute('role','dialog');$('sidebar').setAttribute('aria-modal','true');}
 else{$('sidebar').removeAttribute('role');$('sidebar').removeAttribute('aria-modal');}
 document.body.style.overflow=mobile&&state.mobileOpen?'hidden':'';
}
function toggleSidebar(){
 if(innerWidth<=900){state.mobileOpen=!state.mobileOpen;applySidebar();if(state.mobileOpen){returnFocus.set('sidebar',document.activeElement);$('sidebar').querySelector('button')?.focus();}else returnFocus.get('sidebar')?.focus();}
 else{
  const focusWasToggle=document.activeElement?.matches('[data-action="sidebar"]');
  state.collapsed=!state.collapsed;applySidebar();savePrefs();
  if(focusWasToggle)document.querySelector(state.collapsed?'.topbar .menu-toggle':'.sidebar .collapse-control')?.focus({preventScroll:true});
 }
}
function closeSidebar(restore=false){const wasOpen=state.mobileOpen;state.mobileOpen=false;applySidebar();if(restore)returnFocus.get('sidebar')?.focus();else if(wasOpen)$('mainContent').focus({preventScroll:true});}
function toast(message,kind='success',undo=false){
 const el=document.createElement('div');el.className='toast'+(kind==='error'?' error':'');el.setAttribute('role',kind==='error'?'alert':'status');
 el.innerHTML=`${icon(kind==='error'?'alert':'check-circle')}<span class="toast-message">${esc(message)}</span>${undo?'<button data-action="undo">Hoàn tác</button>':''}<button class="toast-close" aria-label="Đóng thông báo">×</button>`;
 el.querySelector('.toast-close').addEventListener('click',()=>el.remove());
 $('toastRegion').append(el);if(typeof $('toastRegion').showPopover==='function'){try{if(!$('toastRegion').matches(':popover-open'))$('toastRegion').showPopover();}catch(e){}}while($('toastRegion').children.length>3)$('toastRegion').firstElementChild.remove();
 let timer=setTimeout(()=>el.remove(),undo?8500:5500);el.addEventListener('mouseenter',()=>clearTimeout(timer));el.addEventListener('mouseleave',()=>{timer=setTimeout(()=>el.remove(),2500);});
}
function showDialog(id,focusSelector){
 const el=$(id);if(!el.open){returnFocus.set(id,document.activeElement);el.showModal();}
 if(focusSelector)requestAnimationFrame(()=>el.querySelector(focusSelector)?.focus());
}
function closeDialog(id,force=false){
 if(!force&&((id==='taskDialog'&&dirtyTask)||(id==='nodeDialog'&&dirtyNode))){
  ask('Bỏ thay đổi chưa lưu?','Nội dung đang nhập sẽ không được lưu. Công việc và dữ liệu đã lưu trước đó vẫn giữ nguyên.','Bỏ thay đổi',true).then(ok=>{if(ok)closeDialog(id,true);});return;
 }
 const el=$(id);if(!el?.open)return;el.close();if(id==='drawer')drawerId=null;
 if(id==='taskDialog')dirtyTask=false;if(id==='nodeDialog')dirtyNode=false;
 const prev=returnFocus.get(id);if(prev?.isConnected&&!prev.closest('[inert]'))prev.focus({preventScroll:true});
}
function ask(title,message,okLabel='Xác nhận',danger=false,extra=''){
 if(confirmResolver){confirmResolver(false);confirmResolver=null;}
 $('confirmTitle').textContent=title;$('confirmText').textContent=message;
 $('confirmOk').textContent=okLabel;$('confirmOk').className='btn '+(danger?'danger':'primary');
 $('confirmIcon').classList.toggle('danger',danger);$('confirmExtra').innerHTML=extra?`<div class="confirm-extra">${esc(extra)}</div>`:'';
 showDialog('confirmDialog','#confirmCancel');
 return new Promise(resolve=>{confirmResolver=resolve;});
}
function resolveConfirm(result){const resolve=confirmResolver;confirmResolver=null;closeDialog('confirmDialog',true);if(resolve)resolve(result);}
function ensureWritable(){
 if(!requireLogin())return false;
 if(externalRaw!==null){toast('Có dữ liệu mới từ tab khác. Hãy bấm “Tải bản mới” trước.','error');return false;}
 try{const current=localStorage.getItem(KEYS.data);if(current!==lastRaw&&!storageProtected){externalRaw=current??'';renderStorage();toast('Phát hiện thay đổi từ tab khác. Chưa ghi đè dữ liệu.','error');return false;}}catch(e){}
 return true;
}
function commit(label,change,options={}){
 if(!ensureWritable())return false;
 const before=clone(data),candidate=clone(data);try{
  change(candidate);
  const result=validateData(candidate);assertMutation(before,result.data);data=result.data;
  const t=options.taskId?data.tasks.find(t=>t.id===options.taskId):null;
  data.activities.push({id:uid(),at:new Date().toISOString(),actor:person().name,action:label.slice(0,300),taskId:t?.id??null,nodeId:options.nodeId??null,title:t?.title??options.title??''});
  data.activities=data.activities.slice(-500);
  history.push({data:before,label});if(history.length>(data.tasks.length>2000?5:20))history.shift();future=[];
  rebuild();const saved=persistData();savePrefs();renderAll(true);
  if($('drawer').open){if(byTask.has(drawerId))refreshDrawer();else closeDialog('drawer',true);}
  if(!options.quiet)toast(saved?label:`${label} · chưa lưu bền vững`,saved?'success':'error',true);
  return true;
 }catch(e){data=before;rebuild();if(options.onError)options.onError(e);else toast(e.message||'Không thể thực hiện thay đổi.','error');return false;}
}
function undo(){
 if(!history.length){toast('Chưa có thay đổi để hoàn tác.');return;}
 if(!ensureWritable())return;
 try{assertMutation(data,history.at(-1).data);}catch(e){toast(e.message,'error');return;}
 const item=history.pop();future.push({data:clone(data),label:item.label});data=item.data;rebuild();persistData();savePrefs();renderAll(true);
 if($('drawer').open){if(byTask.has(drawerId))refreshDrawer();else closeDialog('drawer',true);}
 toast('Đã hoàn tác: '+item.label);
}
function redo(){
 if(!future.length){toast('Chưa có thao tác để làm lại.');return;}if(!ensureWritable())return;
 try{assertMutation(data,future.at(-1).data);}catch(e){toast(e.message,'error');return;}
 const item=future.pop();history.push({data:clone(data),label:item.label});data=item.data;rebuild();persistData();savePrefs();renderAll(true);
 if($('drawer').open&&byTask.has(drawerId))refreshDrawer();toast('Đã làm lại: '+item.label);
}
function touch(t){t.updatedAt=new Date().toISOString();}
function setTaskStatus(t,status,lookup){
 if(!STATUS.includes(status))throw Error('Trạng thái không hợp lệ.');
 if(status==='Hoàn thành'){
  if(t.autoProgress&&t.checklist.some(c=>!c[1]))throw Error('Checklist chưa hoàn tất. Hoàn tất checklist hoặc tắt chế độ tự tính trước.');
  const b=blockers(t,lookup);if(b.length)throw Error(`Chưa thể hoàn thành "${t.title}". Cần hoàn thành trước: ${b.map(x=>canReadTask(x)?x.title:T.hiddenDependency).slice(0,3).join('; ')}.`);
  if(t.status!=='Hoàn thành'){t.resumeProgress=t.progress;t.resumeStatus=t.status;}t.progress=100;
 }else if(t.status==='Hoàn thành'){t.progress=Math.min(99,t.resumeProgress||0);}
 t.status=status;touch(t);
}
function changeStatus(id,status){
 if(window.__worktree_is_cloud_workspace){
  if(!requireLogin()||!canUpdateTask(byTask.get(id)))return deny();
  const t=byTask.get(id);if(!t||t.status===status)return;
  const prevStatus=t.status,prevProgress=t.progress;

  // Optimistic UI update
  t.status=status;
  if(status==='Hoàn thành')t.progress=100;
  rebuild();
  renderView();
  if($('drawer').open&&drawerId===id)renderDrawer();

  (async()=>{
   try{
    if(window.TaskService){
     const res=await window.TaskService.updateStatus(id,status);
     if(res&&res.isLatest&&res.task){
      const idx=data.tasks.findIndex(x=>x.id===id);
      if(idx!==-1)data.tasks[idx]=res.task;
      rebuild();
      renderView();
      if($('drawer').open&&drawerId===id)renderDrawer();
      toast(`Đã đổi trạng thái thành ${status}`,'success',true);
     }
    }
   }catch(err){
    // Rollback on failure
    t.status=prevStatus;
    t.progress=prevProgress;
    rebuild();
    renderView();
    if($('drawer').open&&drawerId===id)renderDrawer();
    toast(err.message||'Không thể đổi trạng thái công việc.','error');
   }
  })();
  return;
 }
 if(!requireLogin()||!canUpdateTask(byTask.get(id)))return deny();
 const t=byTask.get(id);if(!t||t.status===status)return;
 const ok=commit(`Đổi trạng thái thành ${status}`,d=>{const map=new Map(d.tasks.map(t=>[t.id,t]));setTaskStatus(map.get(id),status,map);},{taskId:id});
 if(!ok){renderView();if($('drawer').open)refreshDrawer();}
}
async function toggleFavorite(id){
 if(window.__worktree_is_cloud_workspace){
  if(window.__starMutationBusy) return;
  window.__starMutationBusy = true;
  const orgId = window.appState?.activeOrganizationId;
  if(!orgId){
   window.__starMutationBusy = false;
   return toast('Không tìm thấy không gian làm việc.', 'error');
  }
  try {
   const res = await window.StarService.toggleStar({ organizationId: orgId, taskId: id });
   const isStarred = res.starred === true;
   if(isStarred) {
    if(window.__worktree_starred_task_ids) window.__worktree_starred_task_ids.add(id);
    if(window.appState?.starredTaskIds) window.appState.starredTaskIds.add(id);
   } else {
    if(window.__worktree_starred_task_ids) window.__worktree_starred_task_ids.delete(id);
    if(window.appState?.starredTaskIds) window.appState.starredTaskIds.delete(id);
   }
   const t = byTask.get(id);
   if(t) {
    t.favorite = isStarred;
   }
   document.querySelectorAll(`[data-action="favorite"][data-id="${id}"]`).forEach(b => {
    b.classList.toggle('is-favorite', isStarred);
    b.setAttribute('aria-pressed', String(isStarred));
    b.title = isStarred ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao';
    b.setAttribute('aria-label', (isStarred ? 'Bỏ sao: ' : 'Đánh dấu sao: ') + (t?.title || ''));
   });
   if($('drawer')?.open && window.__taskDetailData?.taskId === id) {
    const drawerFav = $('drawer')?.querySelector('.drawer-tools .favorite-btn');
    if(drawerFav) {
     drawerFav.classList.toggle('is-favorite', isStarred);
     drawerFav.setAttribute('aria-pressed', String(isStarred));
     drawerFav.title = isStarred ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao';
    }
   }
   toast(isStarred ? 'Đã đánh dấu sao' : 'Bỏ đánh dấu sao');
   if(state.filters.favorite) {
    renderView();
   }
  } catch(err) {
   console.error('Lỗi khi cập nhật đánh dấu sao đám mây:', err);
   toast(err.message || 'Không thể cập nhật đánh dấu sao.', 'error');
  } finally {
   window.__starMutationBusy = false;
  }
  return;
 }
 if(!byTask.has(id))return;commit(byTask.get(id).favorite?'Bỏ đánh dấu sao':'Đã đánh dấu sao',d=>{const t=d.tasks.find(t=>t.id===id);t.favorite=!t.favorite;touch(t);},{taskId:id,quiet:true});
}
function currentScopeTasks(){const ids=state.includeChildren?subtree(state.selected):new Set([state.selected]);return readableTasks().filter(t=>ids.has(t.node));}
function filteredTasks(){
 const f=state.filters,q=fold(f.q);let arr=currentScopeTasks().filter(t=>{
  if(f.status&&t.status!==f.status)return false;if(f.priority&&t.priority!==f.priority)return false;
  if(f.owner&&(f.owner==='unassigned'?t.owner!==null:String(t.owner)!==f.owner))return false;
  if(f.favorite&&!t.favorite)return false;
  if(f.due==='late'&&!isLate(t))return false;if(f.due==='today'&&!isToday(t))return false;
  if(f.due==='week'&&(t.status==='Hoàn thành'||!t.due||t.due<TODAY||t.due>addDays(TODAY,6)))return false;
  if(f.due==='unscheduled'&&t.due)return false;if(f.due==='attention'&&!attention(t))return false;
  if(q&&!fold(`${t.title} ${t.desc} ${t.tags.join(' ')} ${nodeName(t.owner)} ${pathName(t.node)} #${t.id}`).includes(q))return false;
  return true;
 });
 const due=t=>t.due||'9999-12-31',pr=t=>PRIORITY.indexOf(t.priority);
 const cmp=(a,b)=>{
  if(state.sort==='title')return a.title.localeCompare(b.title,'vi');
  if(state.sort==='updated')return (b.updatedAt||'').localeCompare(a.updatedAt||'')||String(b.id).localeCompare(String(a.id));
  if(state.sort==='priority')return pr(a)-pr(b)||due(a).localeCompare(due(b));
  if(state.sort==='due')return due(a).localeCompare(due(b))||pr(a)-pr(b);
  return (a.status==='Hoàn thành')-(b.status==='Hoàn thành')||Number(isLate(b))-Number(isLate(a))||Number(isToday(b))-Number(isToday(a))||pr(a)-pr(b)||due(a).localeCompare(due(b))||String(a.id).localeCompare(String(b.id));
 };
 return arr.sort(cmp);
}
function filterCount(){const f=state.filters;return [f.status,f.priority,f.owner,f.due,f.favorite].filter(Boolean).length;}
function setView(view){
 if(!Object.hasOwn(VIEWS,view))return;state.view=view;state.page=1;state.selectedTasks.clear();savePrefs();renderAll();closeSidebar();
 $('liveStatus').textContent='Đang xem '+VIEWS[view][0];
}
function selectNode(id){
 if(!requireLogin()||!visibleNodeIds().has(id))return;state.selected=id;state.page=1;state.selectedTasks.clear();
 for(const n of pathNodes(id)){if(n.parent!==null&&!state.expanded.includes(n.parent))state.expanded.push(n.parent);}
 closeSidebar();savePrefs();renderAll(true);
}
function navigate(which){
 state.selected=rootNode().id;state.includeChildren=true;state.filters=blankFilters();state.page=1;state.selectedTasks.clear();
 if(which==='mine'){if(!person().id){toast('Thêm nhân sự trước khi chọn hồ sơ của tôi.','error');openSettings();return;}state.filters.owner=String(person().id);state.view='list';}
 else if(which==='attention'){state.view='list';state.filters.due='attention';}
 else state.view=Object.hasOwn(VIEWS,which)?which:'overview';
 closeSidebar();syncFilters();savePrefs();renderAll(true);
}
function clearFilters(){state.filters=blankFilters();state.page=1;state.selectedTasks.clear();syncFilters();savePrefs();renderAll();}
function updateFilter(key,value){state.filters[key]=value;state.page=1;state.selectedTasks.clear();savePrefs();renderAll();}
function applyPreset(values,view='list'){Object.assign(state.filters,values);state.view=view;state.page=1;state.selectedTasks.clear();syncFilters();savePrefs();renderAll();}

function syncFilters(options=false){
 if(options||!$('filterStatus').options.length||$('filterStatus').options.length===1){
  $('filterStatus').innerHTML='<option value="">Tất cả trạng thái</option>'+STATUS.map(s=>`<option>${esc(s)}</option>`).join('');
  $('filterPriority').innerHTML='<option value="">Tất cả ưu tiên</option>'+PRIORITY.map(s=>`<option>${esc(s)}</option>`).join('');
  $('filterOwner').innerHTML='<option value="">Tất cả nhân sự</option><option value="unassigned">Chưa giao</option>'+people().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
 }
 const f=state.filters;
 for(const [id,value] of Object.entries({taskSearch:f.q,filterStatus:f.status,filterPriority:f.priority,filterOwner:f.owner,filterDue:f.due,sortBy:state.sort})){if($(id).value!==value)$(id).value=value;}
 $('filterFavorite').checked=f.favorite;$('includeChildren').checked=state.includeChildren;
 $('advancedFilters').hidden=!state.filterOpen;$('filterBtn').setAttribute('aria-expanded',String(state.filterOpen));
 const count=filterCount();$('filterCount').hidden=!count;$('filterCount').textContent=count;
}
function legacyRenderTree(){
 const q=fold(state.treeQuery),visible=new Set(),forcedOpen=new Set();
 if(q){data.nodes.filter(n=>fold(n.name+' '+n.desc).includes(q)).forEach(n=>pathNodes(n.id).forEach(p=>{visible.add(p.id);if(p.parent!==null)forcedOpen.add(p.parent);}));}
 const counts=new Map(data.nodes.map(n=>[n.id,0]));
 for(const t of data.tasks){for(const n of pathNodes(t.node))counts.set(n.id,(counts.get(n.id)||0)+1);}
 const expanded=new Set(state.expanded);
 const row=(n,depth)=>{
  if(q&&!visible.has(n.id))return '';
  const kids=childrenOf(n.id),open=q?forcedOpen.has(n.id):expanded.has(n.id);
  const selected=state.selected===n.id;
  return `<div class="tree-node ${selected?'selected':''}" style="padding-left:${Math.min(depth*12,72)}px">
   ${kids.length?`<button class="node-expand ${open?'expanded':''}" data-action="tree-toggle" data-id="${n.id}" aria-expanded="${open}" aria-label="${esc((open?'Thu gọn ':'Mở rộng ')+n.name)}">${icon('chevron-right')}</button>`:'<span class="node-spacer"></span>'}
   <button class="node-select" data-action="select-node" data-id="${n.id}" ${selected?'aria-current="page"':''} title="${esc(pathName(n.id))}">${icon(nodeIcon(n.type))}<span class="tree-name">${esc(n.name.replace(/^Công ty /,''))}</span></button>
   <span class="tree-count" title="Tổng công việc trong nhánh">${counts.get(n.id)||0}</span>
  </div>${open?kids.map(c=>row(c,depth+1)).join(''):''}`;
 };
 const root=rootNode();
 $('orgTree').innerHTML=root ? (row(root,0)||(q?'<div class="tree-empty">Không tìm thấy đơn vị phù hợp.</div>':'')) : '<div class="tree-empty">Chưa có dữ liệu đơn vị.</div>';
 $('savedViews').innerHTML=state.savedViews.length?state.savedViews.map(v=>`<div class="saved-item"><button class="nav-item" data-action="load-view" data-id="${v.id}" title="${esc(v.name)}">${icon('bookmark')}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(v.name)}</span></button><button class="tiny-btn" data-action="delete-view" data-id="${v.id}" title="Xóa góc nhìn" aria-label="${esc('Xóa góc nhìn '+v.name)}">${icon('x')}</button></div>`).join(''):'<div class="saved-empty">Lưu bộ lọc bạn thường dùng.</div>';
}
function renderShell(arr){
 const root=rootNode();
 if(!root) return;
 const node=byNode.get(state.selected)||root,user=person()||{id:1,name:'Người dùng'};
 const ws=(root.name||'').replace(/^Công ty /,'');
 $('workspaceName').textContent=ws;$('topWorkspace').textContent=ws;
 document.querySelector('.workspace-avatar').textContent=initials(ws);
 $('profileName').textContent=user.name;$('userAvatar').textContent=initials(user.name);$('topAvatar').textContent=initials(user.name);
 $('topAvatar').setAttribute('aria-label','Hồ sơ cục bộ: '+user.name);
 $('topScope').textContent=node.id===root.id?'Toàn công ty':node.name;
 const mine=state.filters.owner===String(user.id)&&node.id===root.id;
 const attentionView=state.filters.due==='attention'&&node.id===root.id;
 let title=node.id!==root.id?node.name:state.view==='overview'?'Tổng quan công việc':state.view==='list'?'Tất cả công việc':VIEWS[state.view][0];
 if(mine&&state.view==='list')title='Công việc của tôi';
 if(attentionView&&state.view==='list')title='Công việc cần chú ý';
 $('pageTitle').textContent=title;
 $('pageEyebrow').textContent=node.id===root.id?'KHÔNG GIAN ĐIỀU HÀNH':`${TYPES[node.type]} · ${VIEWS[state.view][0]}`.toUpperCase();
 const subtitles={overview:'Tập trung đúng việc. Phối hợp đúng nhịp.',list:'Một danh sách rõ ràng, không bỏ sót điều quan trọng.',kanban:'Nhìn rõ luồng công việc. Kéo thả để cập nhật trạng thái.',timeline:'Kết nối công việc với thời gian, nhìn trước những điểm nghẽn.',calendar:'Sắp xếp thời hạn, chủ động từng ngày.',workload:'Hiểu năng lực đội ngũ. Phân bổ công việc có cơ sở.',children:'Mọi phòng ban, dự án và nhân sự trong một cấu trúc thống nhất.'};
 $('pageSubtitle').textContent=node.id===root.id?subtitles[state.view]:(node.desc||subtitles[state.view]);
 const displayDate=new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:TZ}).format(new Date());
 $('todayLabel').textContent=displayDate[0].toUpperCase()+displayDate.slice(1);
 $('breadcrumbs').innerHTML=pathNodes(state.selected).map((n,i,a)=>`${i?'<span class="crumb-arrow" aria-hidden="true">/</span>':''}<button class="crumb ${i===a.length-1?'current':''}" data-action="select-node" data-id="${n.id}" title="${esc(n.name)}" ${i===a.length-1?'aria-current="location"':''}>${i===0?icon('building'):''}<span>${esc(n.name.replace(/^Công ty /,''))}</span></button>`).join('');
 const all=readableTasks(),mineCount=all.filter(t=>t.owner===user.id&&t.status!=='Hoàn thành').length,attentionCount=all.filter(attention).length;
 $('allCount').textContent=all.length;$('mineCount').textContent=mineCount;$('attentionCount').textContent=attentionCount;
 $('notificationDot').hidden=!attentionCount;document.querySelector('.notification-btn').setAttribute('aria-label',`Nhắc việc: ${attentionCount} công việc cần chú ý`);
 $$('.primary-nav .nav-item').forEach(b=>{
  const kind=b.dataset.nav;
  const active=node.id===root.id&&(kind==='mine'?mine&&state.view==='list':kind==='attention'?attentionView&&state.view==='list':kind===state.view&&!(state.view==='list'&&(mine||attentionView)));
  b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
 $$('#viewTabs .view-tab').forEach(b=>{const active=b.dataset.view===state.view;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;const badge=b.querySelector('.tab-count');if(badge)badge.textContent=arr.length;});
 $('viewContent').setAttribute('role','tabpanel');$('viewContent').setAttribute('aria-labelledby','tab-'+state.view);$('viewContent').setAttribute('aria-label',VIEWS[state.view][0]);$('undoBtn').disabled=!history.length;
 const dueLabels={late:'Quá hạn',today:'Đến hạn hôm nay',week:'7 ngày tới',unscheduled:'Chưa có hạn',attention:'Cần chú ý'},f=state.filters,chips=[];
 if(f.q)chips.push(['q','Tìm: '+f.q]);if(f.status)chips.push(['status',f.status]);if(f.priority)chips.push(['priority',f.priority]);
 if(f.owner)chips.push(['owner',f.owner==='unassigned'?'Chưa giao':nodeName(Number(f.owner))]);
 if(f.due)chips.push(['due',dueLabels[f.due]]);if(f.favorite)chips.push(['favorite','Đã đánh dấu sao']);
 $('activeFilters').hidden=!chips.length;
 $('activeFilters').innerHTML=`<span>${arr.length} kết quả</span>`+chips.map(([key,label])=>`<button class="filter-chip" data-action="remove-filter" data-key="${key}" aria-label="${esc('Bỏ lọc '+label)}">${esc(label)}${icon('x')}</button>`).join('')+`<button class="link-btn" data-action="clear-filters">Xóa tất cả</button>`;
 document.title=`${title} · WorkTree X`;
}
function emptyState(title,desc,action='new-task',label='Tạo công việc',mini=false,ico='inbox'){
 return `<div class="empty-state ${mini?'mini':''}"><div class="empty-icon">${icon(ico)}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p>${action?`<button class="btn ${mini?'small soft':'primary'}" data-action="${action}">${icon(action==='clear-filters'?'refresh':'plus')}${esc(label)}</button>`:''}</div>`;
}
function activityHTML(items,mini=false){
 items=items.filter(canReadActivity);
 if(!items.length)return `<div class="empty-state mini"><div class="empty-icon">${icon('clock')}</div><h3>Chưa có hoạt động mới</h3><p>Nhật ký sẽ xuất hiện khi bạn cập nhật công việc trong không gian này.</p></div>`;
 return `<div class="activity-list">${items.map(a=>`<div class="activity-item"><span class="activity-mark">${icon(a.taskId?'check-circle':'network')}</span><div class="activity-text"><strong>${esc(a.actor||'Người dùng cục bộ')}</strong> · ${esc(a.action)}${a.taskId&&byTask.has(a.taskId)?`<br><button data-action="open-task" data-id="${a.taskId}">${esc(a.title||byTask.get(a.taskId).title)}</button>`:''}<small>${esc(timeAgo(a.at))}</small></div></div>`).join('')}</div>`;
}
function focusRow(t){
 return `<div class="focus-item"><button class="task-check ${t.status==='Hoàn thành'?'done':''}" data-action="complete" data-id="${t.id}" title="${esc(t.status==='Hoàn thành'?'Mở lại công việc':'Đánh dấu hoàn thành')}" aria-label="${esc((t.status==='Hoàn thành'?'Mở lại: ':'Hoàn thành: ')+t.title)}">${t.status==='Hoàn thành'?icon('check'):''}</button>
 <div class="focus-body"><button class="focus-title" data-action="open-task" data-id="${t.id}">${esc(t.title)}</button><div class="focus-meta"><span title="${esc(pathName(t.node))}">${esc(nodeName(t.node))}</span><span class="meta-dot"></span>${dateLabel(t)}${blockers(t).length?'<span class="meta-dot"></span><span>Chờ phụ thuộc</span>':''}${t.tags.slice(0,1).map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div></div>
 <div class="focus-side">${taskPinButton(t.id)}${priorityBadge(t.priority)}${avatar(t.owner)}</div></div>`;
}
function renderOverview(arr){
 const total=arr.length,doing=arr.filter(t=>t.status==='Đang làm').length,done=arr.filter(t=>t.status==='Hoàn thành').length,late=arr.filter(isLate).length,dueToday=arr.filter(isToday).length,needs=arr.filter(attention);
 const percent=total?Math.round(done/total*100):0,hours=arr.reduce((s,t)=>s+t.estimate,0);
 const kpis=[
  {label:'Tổng công việc',value:total,icon:'layers',class:'',key:'all',foot:`${num(hours)} giờ ước tính`,pct:100,note:`${visibleChildren(state.selected).length} đơn vị con`},
  {label:'Đang thực hiện',value:doing,icon:'clock',class:'blue',key:'doing',foot:`${total?Math.round(doing/total*100):0}% tổng công việc`,pct:total?doing/total*100:0,note:'Đang làm'},
  {label:'Đã hoàn thành',value:done,icon:'check-circle',class:'green',key:'done',foot:`${percent}% công việc đã xong`,pct:percent,note:'Hoàn thành'},
  {label:'Cần chú ý',value:needs.length,icon:'flag',class:'amber',key:'attention',foot:late?`${late} quá hạn · ${dueToday} hạn hôm nay`:`${dueToday} việc đến hạn hôm nay`,pct:0,note:late?'Quá hạn':'Ưu tiên'}
 ];
 let html=`<div class="kpi-grid">${kpis.map(k=>`<button class="panel kpi ${k.class}" data-action="kpi" data-kind="${k.key}" title="${esc('Xem '+k.label.toLowerCase())}"><div class="kpi-top"><span class="kpi-label">${k.label}</span><span class="kpi-icon">${icon(k.icon)}</span></div><div class="kpi-value">${k.value}${k.key==='done'&&total?`<span class="trend-pill green">${icon('check')} ${percent}%</span>`:''}${k.key==='attention'&&late?`<span class="trend-pill red">${late} quá hạn</span>`:''}</div><div class="kpi-bottom"><span>${esc(k.foot)}</span>${k.key!=='attention'?`<span class="mini-progress"><i style="width:${k.pct}%"></i></span>`:icon('arrow-up-right')}</div></button>`).join('')}</div>`;
 const focusArr=(state.focusTab==='attention'?needs:arr.filter(t=>t.status!=='Hoàn thành')).slice(0,6);
 const projects=visibleChildren(state.selected);
 const projectRows=projects.slice(0,6).map((n,i)=>{
  const set=subtree(n.id),ts=arr.filter(t=>set.has(t.node)),dn=ts.filter(t=>t.status==='Hoàn thành').length,p=avgProgress(ts);
  return `<tr><td><div class="project-cell"><span class="project-symbol sym-${i%4}">${icon(nodeIcon(n.type))}</span><button data-action="select-node" data-id="${n.id}">${esc(n.name)}<small>${esc(TYPES[n.type])}</small></button></div></td><td>${progressBar(p,p===100&&ts.length>0)}</td><td class="number-cell">${dn}<span class="muted"> / ${ts.length}</span></td><td style="text-align:right">${ts.some(isLate)?`<span class="trend-pill red">${ts.filter(isLate).length} quá hạn</span>`:`<span class="trend-pill ${ts.length?'green':''}" style="${ts.length?'':'color:var(--muted);background:var(--surface-3)'}">${ts.length?'Trong hạn':'Chưa có việc'}</span>`}</td></tr>`;
 }).join('');
 const taskIds=new Set(arr.map(t=>t.id)),scopeIds=subtree(state.selected);
 const events=data.activities.filter(a=>a.taskId?taskIds.has(a.taskId):state.selected===rootNode().id||scopeIds.has(a.nodeId)).slice(-4).reverse();
 const noOwners=arr.filter(t=>t.owner===null&&t.status!=='Hoàn thành').length,blocked=arr.filter(t=>t.status!=='Hoàn thành'&&blockers(t).length).length;
 let insight,insightAction,insightLabel;
 if(late){insight=`Có ${late} công việc đang quá hạn. Hãy xác nhận tiến độ và điều chỉnh cam kết trước khi nhận thêm việc mới.`;insightAction='insight-late';insightLabel='Xem việc quá hạn';}
 else if(dueToday){insight=`Có ${dueToday} công việc đến hạn hôm nay${blocked?` và ${blocked} việc đang chờ phụ thuộc`:''}. Kiểm tra đầu ra và người chịu trách nhiệm để kết thúc ngày rõ ràng.`;insightAction='insight-today';insightLabel='Xem việc hôm nay';}
 else if(noOwners){insight=`Có ${noOwners} công việc chưa được giao cho ai. Chỉ định người phụ trách để không bỏ sót đầu việc.`;insightAction='insight-unassigned';insightLabel='Phân công công việc';}
 else if(blocked){insight=`${blocked} công việc đang chờ đầu việc khác hoàn thành. Xử lý các phụ thuộc trước để giữ nhịp làm việc.`;insightAction='insight-attention';insightLabel='Xem điểm cần chú ý';}
 else{insight=total?'Chưa có công việc quá hạn trong phạm vi này. Dành một nhịp rà soát thời hạn và năng lực đội ngũ cho kế hoạch sắp tới.':'Bắt đầu bằng một công việc rõ mục tiêu, người phụ trách và thời hạn. Những chỉ số ở đây được tính từ dữ liệu bạn nhập.';insightAction=total?'insight-workload':'new-task';insightLabel=total?'Xem tải công việc':'Tạo công việc đầu tiên';}
 const counts=STATUS.map(s=>arr.filter(t=>t.status===s).length),colors=['var(--line-strong)','var(--blue)','var(--amber)','var(--green)'];let offset=0;
 const circles=counts.map((c,i)=>{const amount=total?c/total*100:0;const out=`<circle cx="88" cy="88" r="69" fill="none" stroke="${colors[i]}" stroke-width="12" pathLength="100" stroke-dasharray="${Math.max(0,amount-.7)} ${100-Math.max(0,amount-.7)}" stroke-dashoffset="${-offset}" stroke-linecap="round"/>`;offset+=amount;return c?out:'';}).join('');
 html+=`<div class="overview-main"><div class="overview-left"><section class="panel focus-panel"><div class="panel-head"><div><h2>${icon('target')}Tiêu điểm công việc</h2><p>Ưu tiên rõ ràng cho nhịp làm việc hôm nay</p></div><div class="focus-tabs" role="group" aria-label="Nhóm công việc tiêu điểm"><button class="${state.focusTab==='attention'?'active':''}" data-action="focus-tab" data-kind="attention" aria-pressed="${state.focusTab==='attention'}">Cần chú ý</button><button class="${state.focusTab==='active'?'active':''}" data-action="focus-tab" data-kind="active" aria-pressed="${state.focusTab==='active'}">Đang mở</button></div></div>
 <div class="focus-items">${focusArr.length?focusArr.map(focusRow).join(''):emptyState(total?'Mọi việc đang trong tầm kiểm soát':'Không có công việc phù hợp',total?'Không có công việc thuộc nhóm tiêu điểm này. Chuyển sang danh sách để xem toàn bộ.':'Tạo công việc mới hoặc nới lỏng bộ lọc hiện tại.',total?'view-list':filterCount()||state.filters.q?'clear-filters':'new-task',total?'Xem danh sách':filterCount()||state.filters.q?'Xóa bộ lọc':'Tạo công việc',true,'check-circle')}</div><div class="focus-footer"><button data-action="view-list">Xem tất cả ${total} công việc ${icon('arrow-right')}</button></div></section>
 <section class="panel"><div class="panel-head"><div><h2>Tiến độ theo đơn vị</h2><p>Tiến độ trung bình của công việc · theo bộ lọc hiện tại</p></div><button class="link-btn" data-action="view-children">Tất cả đơn vị ${icon('arrow-up-right')}</button></div><div class="panel-body">${projects.length?`<div style="overflow:auto"><table class="project-table"><thead><tr><th>Đơn vị / dự án</th><th>Tiến độ</th><th>Hoàn tất</th><th style="text-align:right">Thời hạn</th></tr></thead><tbody>${projectRows}</tbody></table></div>${arr.filter(t=>t.node===state.selected).length?`<p class="view-note">${arr.filter(t=>t.node===state.selected).length} công việc được gán trực tiếp vào đơn vị đang chọn, không nằm trong các nhánh trên.</p>`:''}`:emptyState('Chưa có đơn vị con','Tạo nhóm, dự án hoặc nhân sự để tổ chức công việc rõ ràng hơn.','new-node','Thêm đơn vị',true,'network')}</div></section></div>
 <div class="overview-right"><section class="panel status-panel"><div class="panel-head"><div><h2>Nhịp độ hoàn thành</h2><p>Phân bổ theo trạng thái hiện tại</p></div><span style="color:var(--muted)" title="Tỷ lệ hoàn thành = số công việc Hoàn thành / tổng công việc">${icon('info')}</span></div><div class="panel-body"><div class="donut-block"><svg viewBox="0 0 176 176" role="img" aria-label="${percent}% công việc hoàn thành; ${counts.map((v,i)=>`${STATUS[i]}: ${v}`).join(', ')}"><circle cx="88" cy="88" r="69" fill="none" stroke="var(--surface-3)" stroke-width="12"/>${circles}</svg><div class="donut-center"><strong>${total?percent+'%':'—'}</strong><span>đã hoàn thành</span></div></div><p class="donut-footnote">${done} trên ${total} công việc trong phạm vi</p><div class="status-legend">${STATUS.map((s,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[i]}"></span>${s}<b>${counts[i]}</b></div>`).join('')}</div></div></section>
 <section class="panel insight-panel"><div class="insight-title">${icon('sparkles')}Gợi ý hành động</div><p>${esc(insight)}</p><button class="link-btn" data-action="${insightAction}">${insightLabel}${icon('arrow-right')}</button><p class="insight-note">Phân tích bằng quy tắc từ dữ liệu · Không dùng AI</p></section>
 <section class="panel activity-panel"><div class="panel-head"><h2>Hoạt động gần đây</h2><span style="color:var(--muted)" title="Nhật ký thao tác cục bộ">${icon('clock')}</span></div><div class="panel-body">${activityHTML(events,true)}</div></section></div></div>`;
 return html;
}
function taskRow(t){
 return `<tr class="${state.selectedTasks.has(t.id)?'selected':''}">
 <td><input type="checkbox" data-select-task="${t.id}" aria-label="${esc('Chọn '+t.title)}" ${state.selectedTasks.has(t.id)?'checked':''}></td>
 <td class="task-name-cell"><div class="task-name-line"><button class="task-check ${t.status==='Hoàn thành'?'done':''}" data-action="complete" data-id="${t.id}" aria-label="${esc((t.status==='Hoàn thành'?'Mở lại: ':'Hoàn thành: ')+t.title)}">${t.status==='Hoàn thành'?icon('check'):''}</button><button class="task-name ${t.status==='Hoàn thành'?'done-title':''}" data-action="open-task" data-id="${t.id}">${esc(t.title)}</button></div><div class="task-sub-line"><span class="path-label" title="${esc(pathName(t.node))}">${esc(shortPath(t.node))}</span>${t.tags.slice(0,2).map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}${blockers(t).length?`<span title="Đang chờ công việc phụ thuộc">${icon('link')}</span>`:''}</div></td>
 <td><div class="owner-cell">${avatar(t.owner)}<span>${esc(nodeName(t.owner))}</span></div></td>
 <td><select class="inline-status ${statusClass(t.status)}" data-status-task="${t.id}" aria-label="${esc('Trạng thái: '+t.title)}">${STATUS.map(s=>`<option ${s===t.status?'selected':''}>${esc(s)}</option>`).join('')}</select></td>
 <td>${priorityBadge(t.priority)}</td>
 <td>${dateLabel(t,true)}</td>
 <td><div class="table-progress">${progressBar(t.progress,t.status==='Hoàn thành')}</div></td>
 <td style="color:var(--subtle);font-size:10px">${num(t.actual)}<span class="muted"> / ${num(t.estimate)}h</span></td>
 <td><button class="icon-btn small favorite-btn ${t.favorite?'is-favorite':''}" data-action="favorite" data-id="${t.id}" aria-pressed="${t.favorite}" title="${t.favorite?'Bỏ đánh dấu sao':'Đánh dấu sao'}" aria-label="${esc((t.favorite?'Bỏ sao: ':'Đánh dấu sao: ')+t.title)}">${icon('star')}</button></td></tr>`;
}
function renderList(arr){
 const pages=Math.max(1,Math.ceil(arr.length/state.pageSize));state.page=clamp(state.page,1,pages);
 const start=(state.page-1)*state.pageSize,shown=arr.slice(start,start+state.pageSize),selected=state.selectedTasks.size;
 const allChecked=shown.length&&shown.every(t=>state.selectedTasks.has(t.id));
 let html=`<section class="panel table-panel"><div class="table-toolbar"><span><strong>${arr.length} công việc</strong> <span class="muted">· ${esc(byNode.get(state.selected).name)}</span></span><div class="right"><span class="muted">Chỉnh trạng thái ngay trên bảng</span><button class="icon-btn small" data-action="density" title="Đổi độ giãn cách bảng" aria-label="Đổi độ giãn cách bảng">${icon('sliders')}</button></div></div>`;
 if(selected)html+=`<div class="bulk-bar"><strong>Đã chọn ${selected} việc</strong><select id="bulkStatus" aria-label="Đổi trạng thái cho các công việc đã chọn"><option value="">Đổi trạng thái...</option>${STATUS.map(s=>`<option>${esc(s)}</option>`).join('')}</select><select id="bulkOwner" aria-label="Đổi người phụ trách cho các công việc đã chọn"><option value="">Giao cho...</option><option value="unassigned">Chưa giao</option>${people().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><button class="btn danger" data-action="bulk-delete">${icon('trash')}Xóa</button><span class="spacer"></span><button class="link-btn" data-action="clear-selection">Bỏ chọn</button></div>`;
 html+=arr.length?`<div class="table-wrap"><table class="task-table"><thead><tr><th><input id="selectPage" type="checkbox" aria-label="Chọn tất cả công việc trên trang hiện tại" ${allChecked?'checked':''}></th><th>Công việc</th><th>Phụ trách</th><th>Trạng thái</th><th>Ưu tiên</th><th>Thời hạn</th><th>Tiến độ</th><th>Giờ đã làm / dự tính</th><th><span class="sr-only">Đánh dấu</span></th></tr></thead><tbody>${shown.map(taskRow).join('')}</tbody></table></div>`:emptyState('Không có công việc phù hợp','Thử thay đổi từ khóa, xóa bộ lọc hoặc tạo một công việc mới.',filterCount()||state.filters.q?'clear-filters':'new-task',filterCount()||state.filters.q?'Xóa bộ lọc':'Tạo công việc');
 html+=`<div class="pagination"><span>${arr.length?`${start+1}–${Math.min(start+state.pageSize,arr.length)} trên ${arr.length}`:'0 công việc'}</span><div class="pagination-controls"><label for="pageSize" class="sr-only">Số công việc mỗi trang</label><select id="pageSize">${[15,30,50].map(n=>`<option value="${n}" ${state.pageSize===n?'selected':''}>${n} / trang</option>`).join('')}</select><button class="icon-btn" data-action="page-prev" ${state.page===1?'disabled':''} aria-label="Trang trước">${icon('chevron-left')}</button><span>${state.page} / ${pages}</span><button class="icon-btn" data-action="page-next" ${state.page===pages?'disabled':''} aria-label="Trang sau">${icon('chevron-right')}</button></div></div></section>`;
 return html;
}
function boardCard(t){
 const checks=t.checklist.length,checked=t.checklist.filter(c=>c[1]).length;
 return `<article class="board-card" draggable="true" data-drag-task="${t.id}" aria-label="${esc(t.title)}"><div class="board-card-header">${priorityBadge(t.priority)}<div class="board-card-actions"><button class="icon-btn small favorite-btn ${t.favorite?'is-favorite':''}" data-action="favorite" data-id="${t.id}" title="${t.favorite?'Bỏ đánh dấu sao':'Đánh dấu sao'}" aria-label="${esc('Đánh dấu sao: '+t.title)}" aria-pressed="${t.favorite}">${icon('star')}</button></div></div><button class="task-name" data-action="open-task" data-id="${t.id}">${esc(t.title)}</button><div class="board-path" title="${esc(pathName(t.node))}">${esc(nodeName(t.node))}</div><div class="tags">${t.tags.slice(0,3).map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}${blockers(t).length?`<span class="tag" style="color:var(--amber)">${icon('link')} Chờ phụ thuộc</span>`:''}</div><div class="progress" role="progressbar" aria-label="Tiến độ" aria-valuenow="${t.progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${t.progress}%;${t.status==='Hoàn thành'?'background:var(--green)':''}"></i></div><div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;color:var(--muted);margin-bottom:8px">${dateLabel(t,true)}<span title="Checklist đã xong">${checks?`${checked}/${checks} mục`:t.progress+'%'}</span></div><div class="board-footer">${avatar(t.owner)}<select data-status-task="${t.id}" aria-label="${esc('Chuyển trạng thái: '+t.title)}">${STATUS.map(s=>`<option ${t.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div></article>`;
}
function renderKanban(arr){
 return `<div class="board" aria-label="Bảng Kanban">${STATUS.map((s,i)=>{
  const cards=arr.filter(t=>t.status===s);
  return `<section class="board-column" data-drop-status="${esc(s)}" aria-label="${esc(s)}"><div class="board-column-head"><span class="legend-dot" style="background:${['var(--muted)','var(--blue)','var(--amber)','var(--green)'][i]}"></span>${esc(s)}<span class="count">${cards.length}</span><button class="icon-btn" data-action="new-task" data-status="${esc(s)}" aria-label="${esc('Thêm công việc '+s)}">${icon('plus')}</button></div>${cards.length?cards.slice(0,75).map(boardCard).join(''):'<div class="board-empty">Kéo công việc vào đây<br>hoặc tạo một đầu việc mới.</div>'}${cards.length>75?`<button class="link-btn" data-action="board-more" data-status="${esc(s)}">Xem ${cards.length-75} việc còn lại</button>`:''}<button class="board-add" data-action="new-task" data-status="${esc(s)}">${icon('plus')}Thêm công việc</button></section>`;
 }).join('')}</div><p class="view-note">${icon('info')}Kéo thả giữa các cột để đổi trạng thái. Trên điện thoại hoặc bàn phím, dùng ô trạng thái trên từng thẻ. Không thể hoàn thành khi công việc phụ thuộc vẫn đang mở.</p>`;
}
function inferredStart(t){
 if(t.start)return t.start;if(!t.due)return '';
 let d=t.due,left=Math.max(0,Math.ceil(t.estimate/8)-1),guard=0;
 while(left>0&&guard++<1800){d=addDays(d,-1);if(weekday(d)!==0&&weekday(d)!==6)left--;}
 return d;
}
function renderTimeline(arr){
 const n=state.timelineDays,start=state.timelineStart,end=addDays(start,n-1),days=Array.from({length:n},(_,i)=>addDays(start,i));
 const shown=arr.slice(0,150),headers=days.map(d=>`<div class="gantt-header gantt-day ${d===TODAY?'today':''} ${[0,6].includes(weekday(d))?'weekend':''}"><span>${['CN','T2','T3','T4','T5','T6','T7'][weekday(d)]}</span><br><strong>${formatDate(d)}</strong></div>`).join('');
 let grid=`<div class="gantt-header gantt-name-header">Công việc / Phụ trách</div>${headers}`;
 for(const t of shown){
  const ts=inferredStart(t),te=t.due;let bar='';
  if(ts&&te&&ts<=end&&te>=start){
   const left=clamp(dayDiff(start,ts),0,n),right=clamp(dayDiff(start,te)+1,0,n),width=Math.max(0,right-left);
   bar=`<button class="gantt-bar ${t.status==='Hoàn thành'?'completed':isLate(t)?'overdue':''} ${!t.start?'inferred':''}" data-action="open-task" data-id="${t.id}" style="left:calc(${left/n*100}% + 3px);width:calc(${width/n*100}% - 6px);--done:${t.progress}%" title="${esc(t.title+' · '+formatDate(ts,true)+' → '+formatDate(te,true)+(!t.start?' · Ngày bắt đầu ước tính':''))}" aria-label="${esc(t.title+', '+t.progress+' phần trăm')}">${width>1?esc(t.title):''}</button>`;
  }
  grid+=`<div class="gantt-label"><button data-action="open-task" data-id="${t.id}" title="${esc(t.title)}">${esc(t.title)}</button><small>${esc(nodeName(t.owner))}${!te?' · Chưa có hạn':te<start||ts>end?' · Ngoài khoảng xem':''}</small></div><div class="gantt-track" style="grid-column:span ${n};grid-template-columns:repeat(${n},1fr)">${days.map(d=>`<div class="gantt-cell ${d===TODAY?'today':''} ${[0,6].includes(weekday(d))?'weekend':''}"></div>`).join('')}${bar}</div>`;
 }
 return `<section class="panel table-panel"><div class="timeline-toolbar"><h2>${formatDate(start,true)} – ${formatDate(end,true)}</h2><div class="period-nav"><button class="btn small" data-action="timeline-today">Hôm nay</button><button class="icon-btn" data-action="timeline-prev" aria-label="Khoảng thời gian trước">${icon('chevron-left')}</button><button class="icon-btn" data-action="timeline-next" aria-label="Khoảng thời gian sau">${icon('chevron-right')}</button><select id="timelineDays" class="toolbar-select" aria-label="Số ngày hiển thị">${[14,28].map(d=>`<option value="${d}" ${n===d?'selected':''}>${d} ngày</option>`).join('')}</select></div></div>${shown.length?`<div class="gantt-wrap"><div class="gantt-grid" style="grid-template-columns:245px repeat(${n},minmax(43px,1fr));min-width:${245+n*43}px">${grid}</div></div>`:emptyState('Chưa có công việc trong phạm vi','Thêm công việc và đặt ngày để theo dõi lịch thực hiện.','new-task','Thêm công việc')}</section><p class="view-note">${icon('info')}Đường viền nét đứt: ngày bắt đầu được ước tính ngược từ hạn và số giờ dự kiến (8 giờ/ngày làm việc), không phải ngày bắt đầu đã xác nhận. Việc chưa có hạn được giữ trong danh sách nhưng không vẽ thanh.${arr.length>150?` Đang hiển thị 150/${arr.length} việc; dùng bộ lọc để thu hẹp.`:''}</p>`;
}
function renderCalendar(arr){
 const month=state.calendarMonth,first=weekStart(month),monthEnd=addDays(addMonths(month,1),-1);
 const cellCount=Math.ceil((dayDiff(first,monthEnd)+1)/7)*7,days=Array.from({length:cellCount},(_,i)=>addDays(first,i)),byDate=new Map();
 arr.filter(t=>t.due).forEach(t=>{if(!byDate.has(t.due))byDate.set(t.due,[]);byDate.get(t.due).push(t);});
 const title=new Intl.DateTimeFormat('vi-VN',{month:'long',year:'numeric',timeZone:'UTC'}).format(dayDate(month));
 return `<section class="panel table-panel"><div class="calendar-toolbar"><h2>${esc(title[0].toUpperCase()+title.slice(1))}</h2><div class="period-nav"><button class="btn small" data-action="calendar-today">Tháng này</button><button class="icon-btn" data-action="calendar-prev" aria-label="Tháng trước">${icon('chevron-left')}</button><button class="icon-btn" data-action="calendar-next" aria-label="Tháng sau">${icon('chevron-right')}</button></div></div><div class="calendar-overflow"><div class="calendar-grid">${['THỨ HAI','THỨ BA','THỨ TƯ','THỨ NĂM','THỨ SÁU','THỨ BẢY','CHỦ NHẬT'].map(s=>`<div class="calendar-day-heading">${s}</div>`).join('')}${days.map(d=>{
  const tasks=byDate.get(d)||[];
  return `<div class="calendar-cell ${d.slice(0,7)!==month.slice(0,7)?'outside':''} ${d===TODAY?'today':''}"><div class="calendar-day-top"><button class="day-number" data-action="calendar-day" data-date="${d}" title="${formatDate(d,true)}" aria-label="${formatDate(d,true)} · ${tasks.length} công việc">${Number(d.slice(-2))}</button><button class="calendar-add" data-action="new-task" data-due="${d}" aria-label="${esc('Tạo công việc đến hạn '+formatDate(d,true))}">${icon('plus')}</button></div>${tasks.slice(0,3).map(t=>`<button class="calendar-event ${t.status==='Hoàn thành'?'completed':isLate(t)?'overdue':''}" data-action="open-task" data-id="${t.id}" title="${esc(t.title+' · '+nodeName(t.owner))}">${esc(t.title)}</button>`).join('')}${tasks.length>3?`<button class="calendar-more" data-action="calendar-day" data-date="${d}">+${tasks.length-3} công việc</button>`:''}</div>`;
 }).join('')}</div></div><div class="calendar-unscheduled">${icon('info')}Lịch hiển thị ngày đến hạn.${arr.some(t=>!t.due)?`<button class="link-btn" data-action="insight-unscheduled">${arr.filter(t=>!t.due).length} công việc chưa có hạn</button>`:''}</div></section>`;
}
function countWorkdays(start,end){
 const days=dayDiff(start,end)+1;if(days<=0)return 0;
 const full=Math.floor(days/7),rest=days%7;let count=full*5;
 for(let i=0;i<rest;i++){const w=(weekday(start)+i)%7;if(w!==0&&w!==6)count++;}
 return count;
}
function allocation(t,week){
 const rem=Math.max(0,t.estimate-t.actual),out=Array(7).fill(0);if(!t.due||t.status==='Hoàn thành'||!rem)return out;
 const start=inferredStart(t),end=t.due,count=countWorkdays(start,end);
 if(!count){const ix=dayDiff(week,end);if(ix>=0&&ix<7)out[ix]=rem;return out;}
 for(let i=0;i<7;i++){const d=addDays(week,i);if(d>=start&&d<=end&&![0,6].includes(weekday(d)))out[i]=rem/count;}
 return out;
}
function renderWorkload(arr){
 const week=state.workloadWeek,end=addDays(week,6),scope=state.includeChildren?subtree(state.selected):new Set([state.selected]);
 let members=people().filter(p=>scope.has(p.id)||arr.some(t=>t.owner===p.id));
 if(state.filters.owner&&state.filters.owner!=='unassigned')members=members.filter(p=>String(p.id)===state.filters.owner);
 if(state.filters.owner==='unassigned')members=[];
 const active=arr.filter(t=>t.status!=='Hoàn thành'),unassigned=active.filter(t=>t.owner===null),unscheduled=active.filter(t=>!t.due);
 const html=members.map(p=>{
  const tasks=active.filter(t=>t.owner===p.id),values=Array(7).fill(0);
  tasks.forEach(t=>allocation(t,week).forEach((v,i)=>values[i]+=v));
  const hours=values.reduce((s,v)=>s+v,0),cap=p.capacity,load=cap?Math.round(hours/cap*100):0,backlog=tasks.filter(t=>!t.due).reduce((s,t)=>s+Math.max(0,t.estimate-t.actual),0);
  const label=cap===0?'Chưa đặt năng lực':load>100?`Vượt năng lực · ${load}%`:load>80?`Tải cao · ${load}%`:`Còn dư địa · ${load}%`;
  const max=Math.max(cap/5,...values,1);
  return `<article class="panel person-card"><div class="person-head">${avatar(p.id)}<div class="person-info"><h3>${esc(p.name)}</h3><p title="${esc(p.desc)}">${esc(p.desc||TYPES.person)}</p></div><button class="icon-btn" data-action="edit-node" data-id="${p.id}" title="Sửa năng lực tuần" aria-label="${esc('Sửa năng lực của '+p.name)}">${icon('settings')}</button></div><div class="capacity-line"><span>Giờ còn lại phân bổ trong tuần</span><strong>${num(hours)}<small> / ${num(cap)}h</small></strong></div><div class="progress"><i style="width:${cap?Math.min(100,load):hours?100:0}%;background:${cap&&load>100?'var(--red)':cap&&load>80?'var(--amber)':'var(--primary)'}"></i></div><span class="capacity-pill ${cap&&load>100?'over':cap&&load>80?'high':''}">${label}</span><div class="week-bars" aria-label="Phân bổ giờ theo ngày">${values.map((v,i)=>`<div class="week-bar ${v>(i<5?cap/5:0)&&v>0?'over':''}" title="${formatDate(addDays(week,i))}: ${num(v)}h"><i style="height:${v/max*47}px"></i><span>${['T2','T3','T4','T5','T6','T7','CN'][i]}</span></div>`).join('')}</div><div class="person-foot"><span>${tasks.length} việc đang mở</span><button data-action="owner-tasks" data-id="${p.id}">Xem công việc →</button></div>${backlog||tasks.some(isLate)?`<p class="view-note">${backlog?`${num(backlog)}h chưa xếp lịch.`:''}${tasks.some(isLate)?` ${tasks.filter(isLate).length} việc đang quá hạn.`:''}</p>`:''}</article>`;
 }).join('');
 return `<section class="panel"><div class="workload-toolbar"><div><h2>Tuần ${formatDate(week)} – ${formatDate(end,true)}</h2></div><div class="period-nav"><button class="btn small" data-action="workload-today">Tuần này</button><button class="icon-btn" data-action="workload-prev" aria-label="Tuần trước">${icon('chevron-left')}</button><button class="icon-btn" data-action="workload-next" aria-label="Tuần sau">${icon('chevron-right')}</button></div></div></section>${members.length?`<div class="workload-grid">${html}</div>`:emptyState('Không có nhân sự phù hợp','Thêm nhân sự hoặc thay đổi phạm vi và bộ lọc.','new-node','Thêm nhân sự',false,'users')}${unassigned.length?`<section class="panel insight-panel" style="margin-top:15px"><div class="insight-title">${icon('user')}${unassigned.length} công việc chưa có người phụ trách</div><p>${num(unassigned.reduce((s,t)=>s+Math.max(0,t.estimate-t.actual),0))} giờ còn lại chưa được phân bổ cho nhân sự.</p><button class="link-btn" data-action="insight-unassigned">Xem để phân công ${icon('arrow-right')}</button></section>`:''}<p class="view-note">${icon('info')}Giờ còn lại = max(ước tính − đã làm, 0), phân bổ đều trên ngày làm việc giữa ngày bắt đầu và hạn. Thiếu ngày bắt đầu: ước tính ngược với 8h/ngày. Chỉ có cuối tuần: phân bổ vào ngày đến hạn. ${unscheduled.length} việc chưa có hạn được tách khỏi tải tuần. Đây là ước tính theo lịch, không phải chấm công hay lịch sử năng suất.</p>`;
}
function renderChildren(arr){
 const nodes=visibleChildren(state.selected);
 return `<div class="folder-grid">${nodes.map((n,i)=>{
  const tasks=arr.filter(t=>subtree(n.id).has(t.node)),p=avgProgress(tasks),done=tasks.filter(t=>t.status==='Hoàn thành').length;
  return `<article class="panel folder-card"><div class="folder-card-top"><span class="project-symbol sym-${i%4}">${icon(nodeIcon(n.type))}</span><button class="icon-btn small" data-action="edit-node" data-id="${n.id}" title="Chỉnh sửa đơn vị" aria-label="${esc('Sửa '+n.name)}">${icon('more')}</button></div><div><h3><button data-action="select-node" data-id="${n.id}">${esc(n.name)}</button></h3><p>${esc(n.desc||TYPES[n.type])}</p></div><div class="folder-meta"><span>${tasks.length} công việc · ${done} hoàn thành</span><span>${visibleChildren(n.id).length} cấp con</span></div>${progressBar(p,p===100&&tasks.length>0)}<button class="link-btn" data-action="select-node" data-id="${n.id}">Mở không gian ${icon('arrow-right')}</button></article>`;
 }).join('')}<button class="add-folder" data-action="new-node">${icon('plus')}Thêm đơn vị con<span style="font-size:9px">Phòng ban · Dự án · Nhân sự</span></button></div><p class="view-note">${icon('info')}Số công việc và tiến độ tuân theo phạm vi, tùy chọn “Bao gồm cấp con” và các bộ lọc đang áp dụng.</p>`;
}
function renderView(arr=filteredTasks()){
 if(!currentAccount())return;
 const functions={overview:renderOverview,list:renderList,kanban:renderKanban,timeline:renderTimeline,calendar:renderCalendar,workload:renderWorkload,children:renderChildren};
 $('viewContent').innerHTML=functions[state.view](arr);
 if($('selectPage')){
  const shown=arr.slice((state.page-1)*state.pageSize,state.page*state.pageSize),count=shown.filter(t=>state.selectedTasks.has(t.id)).length;
  $('selectPage').indeterminate=count>0&&count<shown.length;
 }
 applyPermissionUI();
}
function renderAll(tree=false){
 if(!currentAccount())return;
 const arr=filteredTasks();syncFilters(tree);renderShell(arr);renderView(arr);if(tree)renderTree();renderTimer();renderPins();applyPermissionUI();
}

const drawerDrafts=new Map();
function optionNodes(selected,exclude=new Set()){
 return data.nodes.filter(n=>!exclude.has(n.id)&&canPlaceTask(n.id)).map(n=>`<option value="${n.id}" ${n.id===selected?'selected':''}>${esc('— '.repeat(Math.min(8,pathNodes(n.id).length-1))+n.name)}</option>`).join('');
}
function optionPeople(selected,includeEmpty=true){
 return (includeEmpty?`<option value="" ${selected===null?'selected':''}>Chưa giao</option>`:'')+people().map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');
}
function showFormError(id,message){$(id).textContent=message;$(id).hidden=false;$(id).scrollIntoView({block:'nearest'});}
function openTaskForm(id=null,preset={}){
 if(!requireLogin()||!(id?canManageTask(byTask.get(id)):canCreateTask()))return deny();
 if($('taskDialog').open&&dirtyTask){ask('Bỏ biểu mẫu đang nhập?','Nội dung công việc chưa lưu sẽ bị bỏ để mở biểu mẫu khác.','Bỏ & tiếp tục',true).then(ok=>{if(ok){dirtyTask=false;closeDialog('taskDialog',true);openTaskForm(id,preset);}});return;}
 const t=id?byTask.get(id):null;if(id&&!t){toast('Không tìm thấy công việc.','error');return;}
 editingTask=id;dirtyTask=false;$('taskForm').reset();$('taskFormError').hidden=true;
 $('taskDialogTitle').textContent=t?'Chỉnh sửa công việc':'Tạo công việc mới';$('taskFormEyebrow').textContent=t?'CHI TIẾT & KẾ HOẠCH':'TỔ CHỨC CÔNG VIỆC';
 $('taskSubmit').textContent=t?'Lưu thay đổi':'Tạo công việc';
 $('tNode').innerHTML=optionNodes(t?.node??preset.node??state.selected);
 $('tOwner').innerHTML=optionPeople(t?t.owner:preset.owner??(byNode.get(state.selected)?.type==='person'?state.selected:null));
 $('tStatus').innerHTML=STATUS.map(s=>`<option ${s===(t?.status||preset.status||'Chưa làm')?'selected':''}>${esc(s)}</option>`).join('');
 $('tPriority').innerHTML=PRIORITY.map(p=>`<option ${p===(t?.priority||'Trung bình')?'selected':''}>${esc(p)}</option>`).join('');
 const due=t?t.due:preset.due??addDays(TODAY,3);
 $('tTitle').value=t?.title||'';$('tDesc').value=t?.desc||'';$('tStart').value=t?t.start:due&&due<TODAY?due:TODAY;$('tDue').value=due;
 $('tEstimate').value=t?.estimate??4;$('tActual').value=t?.actual??0;$('tProgress').value=t?.progress??(preset.status==='Hoàn thành'?100:0);
 $('tTags').value=t?.tags.join(', ')||'';$('tDependencyNote').value=t?.dependency||'';
 $('tDependencies').innerHTML=readableTasks().filter(x=>x.id!==id).map(x=>`<option value="${x.id}" ${t?.dependencies.includes(x.id)?'selected':''}>${esc(x.title)} · ${esc(x.status)}</option>`).join('');
 $('tAutoProgress').checked=t?.autoProgress||false;$('tProgress').disabled=!!(t?.autoProgress&&t?.checklist.length);
 $('progressHint').textContent=$('tProgress').disabled?'Được tính từ checklist.':'Chuyển Hoàn thành sẽ đặt 100%.';
 $('taskAdvanced').open=!!(t?.dependencies.length||t?.autoProgress);
 closeSidebar();showDialog('taskDialog','#tTitle');
}
function saveTask(event){
 if(window.__worktree_is_cloud_workspace){
  event.preventDefault();
  if(!$('taskForm').reportValidity())return;
  const title=$('tTitle').value.trim(),start=$('tStart').value||null,due=$('tDue').value||null,status=$('tStatus').value;
  if(start&&due&&start>due){showFormError('taskFormError','Ngày bắt đầu không được sau hạn hoàn thành.');$('tDue').focus();return;}
  const isNew=!editingTask;
  const nodeId=$('tNode').value;
  const ownerId=$('tOwner').value||null;
  const priority=$('tPriority').value;
  const estimate=Math.round((Number($('tEstimate').value)||0)*60);
  const desc=$('tDesc').value.trim();
  const tags=$('tTags').value.split(',').map(x=>x.trim()).filter(Boolean);

  const submitBtn=$('taskSubmit');
  const prevText=submitBtn?submitBtn.textContent:'Lưu';
  if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Đang lưu...';}
  $('taskFormError').hidden=true;

  (async()=>{
   try{
    if(isNew){
     const created=await window.TaskService.createTask({
      nodeId,
      title,
      description:desc,
      priority,
      primaryAssigneeId:ownerId,
      dueDate:due,
      startDate:start,
      estimateMinutes:estimate,
      tags
     });
     if(created){
       const selectedDeps=Array.from($('tDependencies').selectedOptions).map(o=>o.value).filter(Boolean);
       if(window.DependencyService && selectedDeps.length){
        for(const depId of selectedDeps){
         try{ await window.DependencyService.addDependency({ taskId: created.id, dependsOnTaskId: depId }); }catch(e){}
        }
        created.dependencies = selectedDeps;
       }
       data.tasks.unshift(created);
       rebuild();
       renderAll(true);
       dirtyTask=false;
       closeDialog('taskDialog',true);
       openDrawer(created.id);
       toast('Đã tạo công việc thành công.','success');
     }
    }else{
     const t=byTask.get(editingTask);
     const updates={};
     if(title!==(t?.title||''))updates.title=title;
     if(desc!==(t?.desc||''))updates.description=desc;
     if(nodeId!==(t?.node||''))updates.node_id=nodeId;
     if(ownerId!==(t?.owner||null))updates.primary_assignee_id=ownerId;
     if(status!==(t?.status||''))updates.status=status;
     if(priority!==(t?.priority||''))updates.priority=priority;
     if((start||null)!==(t?.start||null))updates.start_date=start;
     if((due||null)!==(t?.due||null))updates.due_date=due;
     if(estimate!==(Math.round((t?.estimate||0)*60)))updates.estimate_minutes=estimate;
     const oldTags=(t?.tags||[]).join(',');
     if(tags.join(',')!==oldTags)updates.tags=tags;

     const updated=await window.TaskService.updateTask(editingTask,updates,t?.updatedAt||null);
     if(updated){
       const selectedDeps=Array.from($('tDependencies').selectedOptions).map(o=>o.value).filter(Boolean);
       if(window.DependencyService && t){
        const oldDeps = (t.dependencies||[]).map(String);
        const toAdd = selectedDeps.filter(id => !oldDeps.includes(id));
        const toDel = oldDeps.filter(id => !selectedDeps.includes(id));
        for(const depId of toAdd){
         try{ await window.DependencyService.addDependency({ taskId: editingTask, dependsOnTaskId: depId }); }catch(e){}
        }
        for(const depId of toDel){
         try{ await window.DependencyService.deleteDependency({ taskId: editingTask, dependsOnTaskId: depId }); }catch(e){}
        }
        updated.dependencies = selectedDeps;
       }
       const idx=data.tasks.findIndex(x=>x.id===editingTask);
       if(idx!==-1)data.tasks[idx]=updated;
       rebuild();
       renderAll(true);
       dirtyTask=false;
       closeDialog('taskDialog',true);
       if($('drawer').open&&drawerId===editingTask)renderDrawer();
       toast('Đã lưu thay đổi công việc.','success');
     }
    }
   }catch(err){
    showFormError('taskFormError',err.message||'Không thể lưu công việc.');
   }finally{
    if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=prevText;}
   }
  })();
  return;
 }
 if(!requireLogin()||!(editingTask?canManageTask(byTask.get(editingTask)):canCreateTask())){event.preventDefault();return deny();}
 event.preventDefault();if(!$('taskForm').reportValidity())return;
 const id=editingTask||uid(),isNew=!editingTask;
 const title=$('tTitle').value.trim(),start=$('tStart').value,due=$('tDue').value,status=$('tStatus').value;
 if(start&&due&&start>due){showFormError('taskFormError','Ngày bắt đầu không được sau hạn hoàn thành.');$('tDue').focus();return;}
 const tags=$('tTags').value.split(',').map(x=>x.trim()).filter(Boolean),deps=Array.from($('tDependencies').selectedOptions).map(o=>Number(o.value));
 const ok=commit(isNew?'Đã tạo công việc':'Đã lưu thay đổi công việc',d=>{
  let t=d.tasks.find(t=>t.id===id);
  if(!t){t={id,checklist:[],comments:[],logs:[],favorite:false,createdAt:new Date().toISOString(),resumeProgress:0,resumeStatus:'Đang làm'};d.tasks.unshift(t);}
  const oldStatus=t.status,oldProgress=t.progress??0;
  Object.assign(t,{title,node:Number($('tNode').value),owner:$('tOwner').value?Number($('tOwner').value):null,start,due,priority:$('tPriority').value,estimate:Number($('tEstimate').value),actual:Number($('tActual').value),desc:$('tDesc').value.trim(),tags,dependencies:deps,dependency:$('tDependencyNote').value.trim(),autoProgress:$('tAutoProgress').checked});
  t.progress=t.autoProgress&&t.checklist.length?Math.round(t.checklist.filter(c=>c[1]).length/t.checklist.length*100):Number($('tProgress').value);
  if(status==='Hoàn thành'){
   const map=new Map(d.tasks.map(x=>[x.id,x]));
   const pending=blockers(t,map);if(pending.length)throw Error('Cần hoàn thành công việc phụ thuộc trước: '+pending.map(x=>canReadTask(x)?x.title:T.hiddenDependency).slice(0,3).join('; '));
   if(t.autoProgress&&t.checklist.some(c=>!c[1]))throw Error('Checklist chưa hoàn tất. Hoàn tất checklist hoặc tắt chế độ tự tính trước khi đặt Hoàn thành.');
   if(oldStatus!=='Hoàn thành'){t.resumeProgress=oldProgress;t.resumeStatus=oldStatus||'Chưa làm';}
   t.progress=100;
  }
  t.status=status;touch(t);
 },{taskId:id,onError:e=>showFormError('taskFormError',e.message)});
 if(ok){dirtyTask=false;closeDialog('taskDialog',true);if(isNew)openDrawer(id);else if($('drawer').open)refreshDrawer();}
}
function syncChecklist(t){
 if(!t.autoProgress)return;
 t.progress=t.checklist.length?Math.round(t.checklist.filter(c=>c[1]).length/t.checklist.length*100):0;
 if(t.status==='Hoàn thành'&&t.progress<100)t.status='Đang làm';
 touch(t);
}
function storeDrawerDraft(){
 if(!drawerId)return;
 const values={};for(const id of ['newChecklist','commentText','logHours','logNote'])if($(id))values[id]=$(id).value;
 drawerDrafts.set(drawerId,values);
}
function resolveCommentAuthor(userId){
 if(!userId)return 'Thành viên';
 if(window.__worktree_supabase_user&&window.__worktree_supabase_user.id===userId){
  return window.__worktree_supabase_user.name||'Tôi';
 }
 if(window.cloudEmployees&&window.cloudEmployees.length){
  const emp=window.cloudEmployees.find(e=>e.id===userId||e.user_id===userId);
  if(emp)return emp.name||emp.full_name||'Thành viên';
 }
 if(typeof data!=='undefined'&&data.employees&&data.employees.length){
  const emp=data.employees.find(e=>e.id===userId);
  if(emp)return emp.name||'Thành viên';
 }
 return 'Thành viên';
}

window.__taskDetailData={
 taskId:null,
 checklist:[],
 dependencies:[],
 comments:[],
 logs:[],
 loading:{checklist:false,dependencies:false,comments:false,logs:false},
 errors:{checklist:null,dependencies:null,comments:null,logs:null}
};

function openDrawer(id){
 if(!requireLogin()||!canReadTask(byTask.get(id)))return deny();
 if(!byTask.has(id)){toast('Công việc này không còn tồn tại.','error');return;}
 if($('drawer').open)storeDrawerDraft();
 drawerId=id;

 if(window.__worktree_is_cloud_workspace){
  window.__taskDetailLoadGen=(window.__taskDetailLoadGen||0)+1;
  const thisGen=window.__taskDetailLoadGen;
  const currentTaskId=id;
  const currentOrgId=window.__active_org_id||(window.__worktree_supabase_user?.organization?.id);

  window.__taskDetailData={
   taskId:id,
   checklist:[],
   dependencies:[],
   comments:[],
   logs:[],
   loading:{checklist:true,dependencies:true,comments:true,logs:true},
   errors:{checklist:null,dependencies:null,comments:null,logs:null}
  };

  renderDrawer();
  showDialog('drawer');
  requestAnimationFrame(()=>$('drawerTitle')?.focus({preventScroll:true}));

  Promise.allSettled([
   window.ChecklistService?window.ChecklistService.getItems(id,currentOrgId):Promise.resolve([]),
   window.DependencyService?window.DependencyService.getDependencies(id,currentOrgId):Promise.resolve([]),
   window.CommentService?window.CommentService.getComments(id,currentOrgId):Promise.resolve([]),
   window.TimeEntryService?window.TimeEntryService.getTimeEntries(id,currentOrgId):Promise.resolve([])
  ]).then(([checkRes,depRes,comRes,timeRes])=>{
   if(thisGen!==window.__taskDetailLoadGen||drawerId!==currentTaskId)return;
   if(currentOrgId&&window.__active_org_id&&currentOrgId!==window.__active_org_id)return;

   const detail=window.__taskDetailData;
   detail.loading={checklist:false,dependencies:false,comments:false,logs:false};

   if(checkRes.status==='fulfilled'){
    detail.checklist=(checkRes.value||[]).map(c=>({id:c.id,text:c.content,done:c.is_done,sort_order:c.sort_order}));
   }else{
    detail.errors.checklist=checkRes.reason?.message||'Không thể tải checklist.';
   }

   if(depRes.status==='fulfilled'){
    detail.dependencies=depRes.value||[];
   }else{
    detail.errors.dependencies=depRes.reason?.message||'Không thể tải phụ thuộc.';
   }

   if(comRes.status==='fulfilled'){
    detail.comments=(comRes.value||[]).map(c=>({
     id:c.id,
     text:c.body,
     author:resolveCommentAuthor(c.author_user_id),
     authorId:c.author_user_id,
     at:c.created_at
    }));
   }else{
    detail.errors.comments=comRes.reason?.message||'Không thể tải bình luận.';
   }

   if(timeRes.status==='fulfilled'){
    detail.logs=(timeRes.value||[]).map(l=>({
     id:l.id,
     hours:(l.minutes||0)/60,
     note:l.note,
     at:l.created_at,
     author:resolveCommentAuthor(l.user_id)
    }));
   }else{
    detail.errors.logs=timeRes.reason?.message||'Không thể tải nhật ký thời gian.';
   }

   const t=byTask.get(currentTaskId);
   if(t){
    if(checkRes.status==='fulfilled'){
     t.checklist=detail.checklist.map(c=>[c.text,c.done]);
     t.checklist_total=detail.checklist.length;
     t.checklist_done=detail.checklist.filter(c=>c.done).length;
    }
    if(depRes.status==='fulfilled'){
     t.dependencies=detail.dependencies.map(d=>d.depends_on_task_id);
    }
    if(comRes.status==='fulfilled') t.comments=detail.comments;
    if(timeRes.status==='fulfilled') t.logs=detail.logs;
   }

   refreshDrawer();
  });
  return;
 }

 renderDrawer();
 showDialog('drawer');
 requestAnimationFrame(()=>$('drawerTitle')?.focus({preventScroll:true}));
}

function refreshDrawer(){
 if(!$('drawer').open||!byTask.has(drawerId))return;
 storeDrawerDraft();
 const focused=document.activeElement,focusId=focused?.id,scroll=$('drawer').querySelector('.drawer-body')?.scrollTop||0;
 const start=focused&&typeof focused.selectionStart==='number'?focused.selectionStart:null;
 renderDrawer();
 const body=$('drawer').querySelector('.drawer-body');
 if(body)body.scrollTop=scroll;
 if(focusId&&$(focusId)){
  try{
   $(focusId).focus({preventScroll:true});
   if(start!==null)$(focusId).setSelectionRange(start,start);
  }catch(e){}
 }
}

function renderDrawer(){
 const t=byTask.get(drawerId);if(!t)return;
 const isCloud=window.__worktree_is_cloud_workspace===true;
 const detail=window.__taskDetailData||{loading:{},errors:{},checklist:[],dependencies:[],comments:[],logs:[]};

 const checks=isCloud?(t.checklist_done??t.checklist.filter(c=>c[1]).length):(t.checklist.filter(c=>c[1]).length);
 const checkTotal=isCloud?(t.checklist_total??t.checklist.length):(t.checklist.length);
 const pending=blockers(t);
 const events=data.activities.filter(a=>a.taskId===t.id).slice(-6).reverse();

 // Checklist HTML
 let checklistHTML='';
 if(isCloud&&detail.loading?.checklist){
  checklistHTML='<div class="drawer-skeleton" style="padding:12px 0;font-size:11px;color:var(--muted)">Đang tải checklist từ đám mây...</div>';
 }else if(isCloud&&detail.errors?.checklist){
  checklistHTML=`<div class="drawer-error" style="padding:8px 0;font-size:11px;color:var(--red)"><p>${esc(detail.errors.checklist)}</p><button class="btn small" type="button" data-action="retry-child" data-child="checklist" data-id="${t.id}">Thử lại</button></div>`;
 }else if(isCloud&&detail.checklist?.length){
  checklistHTML=detail.checklist.map((c,i)=>`
   <div class="checklist-row ${c.done?'completed':''}">
    <label>
     <input type="checkbox" data-check-task="${t.id}" data-check-index="${i}" data-item-id="${c.id}" ${c.done?'checked':''}>
     <span>${esc(c.text)}</span>
    </label>
    <button class="icon-btn" data-action="delete-check" data-id="${t.id}" data-index="${i}" data-item-id="${c.id}" title="Xóa mục checklist" aria-label="${esc('Xóa '+c.text)}">${icon('x')}</button>
   </div>`).join('');
 }else if(!isCloud&&t.checklist.length){
  checklistHTML=t.checklist.map((c,i)=>`
   <div class="checklist-row ${c[1]?'completed':''}">
    <label>
     <input type="checkbox" data-check-task="${t.id}" data-check-index="${i}" ${c[1]?'checked':''}>
     <span>${esc(c[0])}</span>
    </label>
    <button class="icon-btn" data-action="delete-check" data-id="${t.id}" data-index="${i}" title="Xóa mục checklist" aria-label="${esc('Xóa '+c[0])}">${icon('x')}</button>
   </div>`).join('');
 }else{
  checklistHTML='<p class="muted" style="font-size:11px">Chia đầu việc lớn thành các bước nhỏ, dễ hoàn thành.</p>';
 }

 // Dependencies HTML
 let dependenciesHTML='';
 if(isCloud&&detail.loading?.dependencies){
  dependenciesHTML='<div class="drawer-skeleton" style="padding:12px 0;font-size:11px;color:var(--muted)">Đang tải liên kết phụ thuộc...</div>';
 }else if(isCloud&&detail.errors?.dependencies){
  dependenciesHTML=`<div class="drawer-error" style="padding:8px 0;font-size:11px;color:var(--red)"><p>${esc(detail.errors.dependencies)}</p><button class="btn small" type="button" data-action="retry-child" data-child="dependencies" data-id="${t.id}">Thử lại</button></div>`;
 }else if(isCloud&&detail.dependencies?.length){
  dependenciesHTML=detail.dependencies.map(d=>{
   const depTask=byTask.get(d.depends_on_task_id);
   if(!depTask)return `<p class="muted">Công việc #${d.depends_on_task_id}</p>`;
   const isDone=depTask.status==='Hoàn thành';
   return `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
     <button class="dependency-item ${isDone?'resolved':'blocked'}" style="flex:1" data-action="open-task" data-id="${depTask.id}">
      ${icon(isDone?'check-circle':'link')}
      <span>${esc(depTask.title)}</span>
     </button>
     <button class="icon-btn" data-action="delete-dependency" data-task-id="${t.id}" data-dep-id="${depTask.id}" title="Hủy phụ thuộc">${icon('x')}</button>
    </div>`;
  }).join('');
 }else if(!isCloud&&t.dependencies.length){
  dependenciesHTML=t.dependencies.map(id=>{
   const d=byTask.get(id);
   if(!canReadTask(d))return `<p class="muted">${T.hiddenDependency}</p>`;
   return `<button class="dependency-item ${d.status==='Hoàn thành'?'resolved':'blocked'}" data-action="open-task" data-id="${id}">${icon(d.status==='Hoàn thành'?'check-circle':'link')}<span>${esc(d.title)}</span></button>`;
  }).join('');
 }else{
  dependenciesHTML='<p class="muted" style="font-size:11px">Không có liên kết phụ thuộc.</p>';
 }

 // Add inline dependency form for Cloud mode
 const existingDepIds=new Set(isCloud?(detail.dependencies||[]).map(d=>d.depends_on_task_id):t.dependencies);
 const availableDeps=readableTasks().filter(x=>x.id!==t.id&&!existingDepIds.has(x.id));
 const dependencyFormHTML=availableDeps.length?`
  <form id="dependencyForm" class="inline-form" style="margin-top:8px">
   <select id="newDepTask" style="flex:1;min-width:180px;height:32px;font-size:11px" aria-label="Chọn công việc cần phụ thuộc">
    <option value="">-- Thêm công việc phụ thuộc --</option>
    ${availableDeps.map(x=>`<option value="${x.id}">${esc(x.title)} · ${esc(x.status)}</option>`).join('')}
   </select>
   <button class="btn small" type="submit">${icon('plus')}Liên kết</button>
  </form>`:'';

 // Logs HTML
 let logsHTML='';
 const currentLogs=isCloud?(detail.logs||[]):t.logs;
 if(isCloud&&detail.loading?.logs){
  logsHTML='<div class="drawer-skeleton" style="padding:12px 0;font-size:11px;color:var(--muted)">Đang tải nhật ký thời gian...</div>';
 }else if(isCloud&&detail.errors?.logs){
  logsHTML=`<div class="drawer-error" style="padding:8px 0;font-size:11px;color:var(--red)"><p>${esc(detail.errors.logs)}</p><button class="btn small" type="button" data-action="retry-child" data-child="logs" data-id="${t.id}">Thử lại</button></div>`;
 }else if(currentLogs.length){
  logsHTML=`<div class="log-list">${currentLogs.slice(-6).reverse().map(l=>`
   <div class="log-row">
    <span>${esc(l.note||'Ghi thời gian')} · ${esc(l.author||'Thành viên')}</span>
    <span style="display:flex;align-items:center;gap:6px">
     <span>${num(l.hours)}h · ${esc(timeAgo(l.at))}</span>
     <button class="icon-btn small" data-action="delete-log" data-id="${t.id}" data-log-id="${l.id}" title="Xóa bản ghi">${icon('x')}</button>
    </span>
   </div>`).join('')}</div>`;
 }

 // Comments HTML
 let commentsHTML='';
 const currentComments=isCloud?(detail.comments||[]):t.comments;
 if(isCloud&&detail.loading?.comments){
  commentsHTML='<div class="drawer-skeleton" style="padding:12px 0;font-size:11px;color:var(--muted)">Đang tải bình luận...</div>';
 }else if(isCloud&&detail.errors?.comments){
  commentsHTML=`<div class="drawer-error" style="padding:8px 0;font-size:11px;color:var(--red)"><p>${esc(detail.errors.comments)}</p><button class="btn small" type="button" data-action="retry-child" data-child="comments" data-id="${t.id}">Thử lại</button></div>`;
 }else if(currentComments.length){
  commentsHTML=currentComments.map(c=>`
   <div class="comment">
    <span class="avatar av-${Math.abs(hashId(c.authorId||c.author||0))%6}">${esc(initials(c.author||'TV'))}</span>
    <div class="comment-body">
     <div class="comment-meta">
      <strong>${esc(c.author||'Thành viên')}</strong>
      <time>${esc(timeAgo(c.at))}</time>
      <button class="icon-btn" data-action="delete-comment" data-id="${t.id}" data-comment="${c.id}" title="Xóa bình luận" aria-label="Xóa bình luận">${icon('x')}</button>
     </div>
     <div class="comment-text">${esc(c.text)}</div>
    </div>
   </div>`).join('');
 }

 const html=`<div class="drawer-top"><span class="drawer-ref">${icon('check-circle')}CÔNG VIỆC · ${t.id<100000?'#'+t.id:'WT-'+String(t.id).slice(-6)}</span><div class="drawer-tools"><button class="icon-btn favorite-btn ${t.favorite?'is-favorite':''}" data-action="favorite" data-id="${t.id}" aria-pressed="${t.favorite}" title="Đánh dấu sao" aria-label="Đánh dấu sao công việc">${icon('star')}</button><button class="icon-btn" data-action="duplicate-task" data-id="${t.id}" title="Nhân bản công việc" aria-label="Nhân bản công việc">${icon('copy')}</button><button class="icon-btn" data-action="delete-task" data-id="${t.id}" title="Xóa công việc" aria-label="Xóa công việc">${icon('trash')}</button><button class="icon-btn" data-action="close" data-dialog="drawer" title="Đóng (Esc)" aria-label="Đóng chi tiết công việc">${icon('x')}</button></div></div>
 <div class="drawer-body"><div class="drawer-title-block"><button class="task-check ${t.status==='Hoàn thành'?'done':''}" data-action="complete" data-id="${t.id}" aria-label="${t.status==='Hoàn thành'?'Mở lại công việc':'Đánh dấu hoàn thành'}">${t.status==='Hoàn thành'?icon('check'):''}</button><h2 id="drawerTitle" tabindex="-1">${esc(t.title)}</h2></div><div class="drawer-path">${icon('folder')}<span>${esc(pathName(t.node))}</span></div>
 <div class="drawer-meta"><label for="drawerStatus">${icon('circle')}Trạng thái</label><select id="drawerStatus" class="${statusClass(t.status)}" data-status-task="${t.id}">${STATUS.map(s=>`<option ${t.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select>
 <label for="drawerOwner">${icon('user')}Người phụ trách</label><select id="drawerOwner" data-owner-task="${t.id}">${optionPeople(t.owner)}</select>
 <label for="drawerPriority">${icon('flag')}Mức ưu tiên</label><select id="drawerPriority" data-priority-task="${t.id}">${PRIORITY.map(p=>`<option ${t.priority===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
 <span class="meta-label">${icon('calendar')}Thời gian</span><span>${t.start?formatDate(t.start,true):'Chưa đặt bắt đầu'} → ${dateLabel(t)}</span>
 <span class="meta-label">${icon('chart')}Tiến độ</span>${progressBar(t.progress,t.status==='Hoàn thành')}
 <span class="meta-label">${icon('clock')}Giờ thực hiện</span><span>${num(t.actual)} / ${num(t.estimate)} giờ <span class="muted">(đã làm / dự tính)</span></span>
 <span class="meta-label">${icon('bookmark')}Phân loại</span><div class="tags">${t.tags.length?t.tags.map(tag=>`<span class="tag">${esc(tag)}</span>`).join(''):'<span class="muted">Chưa có thẻ</span>'}</div></div>
 ${pending.length?`<div class="drawer-note">${icon('link')}<span>Đang chờ ${pending.length} công việc phụ thuộc. Cần hoàn thành các việc bên dưới trước khi đóng công việc này.</span></div>`:''}
 <section class="drawer-section"><h3>Mô tả</h3><div class="drawer-description">${t.desc?esc(t.desc):'<span class="muted">Chưa có mô tả. Bấm Chỉnh sửa để bổ sung mục tiêu và đầu ra.</span>'}</div></section>
 <section class="drawer-section"><h3>Checklist <small>${checks}/${checkTotal} đã xong</small></h3>${checklistHTML}<form id="checklistForm" class="inline-form"><input id="newChecklist" aria-label="Mục checklist mới" required maxlength="400" placeholder="Thêm một bước nhỏ..."><button class="btn" type="submit">${icon('plus')}Thêm</button></form><label class="checkbox-label" style="margin-top:12px;font-size:10px;color:var(--muted)"><input type="checkbox" id="drawerAutoProgress" ${t.autoProgress?'checked':''}>Tự tính tiến độ theo checklist</label></section>
 <section class="drawer-section"><h3>Phụ thuộc</h3>${dependenciesHTML}${t.dependency&&t.dependency!=='Không có'?`<p class="view-note">Ghi chú: ${esc(t.dependency)}</p>`:''}${dependencyFormHTML}</section>
 <section class="drawer-section"><h3>Ghi thời gian <small>Thời gian bấm giờ được ghi khi dừng</small></h3><form id="logForm" class="inline-form"><input id="logHours" type="number" min="0.01" max="24" step="0.01" required placeholder="Giờ" aria-label="Số giờ vừa thực hiện" style="max-width:95px"><input id="logNote" maxlength="500" placeholder="Ghi chú công việc..." aria-label="Ghi chú thời gian"><button type="submit" class="btn">Ghi giờ</button></form>${logsHTML}</section>
 <section class="drawer-section"><h3>Bình luận <small>${currentComments.length} bình luận ${isCloud?'trên đám mây':'cục bộ'}</small></h3>${commentsHTML}<form id="commentForm" class="comment-compose"><textarea id="commentText" required maxlength="5000" placeholder="Ghi lại trao đổi, quyết định hoặc lưu ý..." aria-label="Nội dung bình luận"></textarea><div><small>${isCloud?'Lưu đám mây':'Chỉ lưu cục bộ'} · Ctrl/Cmd + Enter để gửi</small><button class="btn primary small" type="submit">${icon('message')}Gửi bình luận</button></div></form></section>
 <section class="drawer-section"><h3>Nhật ký thay đổi</h3>${activityHTML(events)}</section></div>
 <div class="drawer-footer"><div class="timer-info">${state.timer?.taskId===t.id?'<span class="timer-live"></span>':icon('clock')}<strong ${state.timer?.taskId===t.id?'data-timer-value':''}>${state.timer?.taskId===t.id?elapsedLabel():num(t.actual)+'h'}</strong></div><button class="btn ${state.timer?.taskId===t.id?'danger':''}" data-action="timer-toggle" data-id="${t.id}" ${t.status==='Hoàn thành'&&state.timer?.taskId!==t.id?'disabled title="Mở lại công việc trước khi bấm giờ"':''}>${icon(state.timer?.taskId===t.id?'stop':'play')}${state.timer?.taskId===t.id?'Dừng':'Bấm giờ'}</button><button class="btn primary" data-action="edit-task" data-id="${t.id}">${icon('edit')}Chỉnh sửa</button></div>`;

 $('drawerContent').innerHTML=html;injectDrawerPin(t);applyPermissionUI();
 const draft=drawerDrafts.get(drawerId);if(draft){for(const [id,v] of Object.entries(draft))if($(id))$(id).value=v;}
}

async function addChecklist(event){
 event.preventDefault();
 const id=drawerId;
 const input=$('newChecklist');
 const value=input?.value.trim();
 if(!value)return;

 if(window.__worktree_is_cloud_workspace){
  const btn=event.target.querySelector('button[type="submit"]');
  if(btn)btn.disabled=true;
  try{
   await window.ChecklistService.addItem({taskId:id,content:value});
   input.value='';
   drawerDrafts.delete(id);
   const items=await window.ChecklistService.getItems(id);
   window.__taskDetailData.checklist=items.map(c=>({id:c.id,text:c.content,done:c.is_done,sort_order:c.sort_order}));
   const t=byTask.get(id);
   if(t){
    t.checklist=window.__taskDetailData.checklist.map(c=>[c.text,c.done]);
    t.checklist_total=items.length;
    t.checklist_done=items.filter(c=>c.is_done).length;
   }
   refreshDrawer();
   toast('Đã thêm mục checklist.','success',true);
  }catch(err){
   toast(err.message||'Không thể thêm mục checklist.','error');
  }finally{
   if(btn)btn.disabled=false;
  }
  return;
 }

 if(commit('Đã thêm mục checklist',d=>{const t=d.tasks.find(t=>t.id===id);t.checklist.push([value,false]);syncChecklist(t);touch(t);},{taskId:id})){
  $('newChecklist').value='';drawerDrafts.delete(id);$('newChecklist').focus();
 }
}

async function changeChecklist(id,index,checked,itemId){
 if(window.__worktree_is_cloud_workspace){
  try{
   const resolvedId=itemId||window.__taskDetailData?.checklist?.[index]?.id;
   if(!resolvedId)throw new Error('Không xác định được mục checklist cần cập nhật.');
   await window.ChecklistService.toggleItem({itemId:resolvedId,taskId:id,isDone:checked});
   if(window.__taskDetailData?.checklist?.[index]){
    window.__taskDetailData.checklist[index].done=checked;
   }
   const t=byTask.get(id);
   if(t&&t.checklist[index]){
    t.checklist[index][1]=checked;
   }
   refreshDrawer();
  }catch(err){
   toast(err.message||'Không thể cập nhật trạng thái checklist.','error');
   refreshDrawer();
  }
  return;
 }

 commit('Đã cập nhật checklist',d=>{const t=d.tasks.find(t=>t.id===id);if(!t.checklist[index])throw Error('Mục checklist không tồn tại.');t.checklist[index][1]=checked;syncChecklist(t);touch(t);},{taskId:id,quiet:true});
}

async function deleteChecklist(id,index,itemId){
 if(window.__worktree_is_cloud_workspace){
  try{
   const resolvedId=itemId||window.__taskDetailData?.checklist?.[index]?.id;
   if(!resolvedId)throw new Error('Không xác định được mục checklist cần xóa.');
   await window.ChecklistService.deleteItem({itemId:resolvedId,taskId:id});
   const items=await window.ChecklistService.getItems(id);
   window.__taskDetailData.checklist=items.map(c=>({id:c.id,text:c.content,done:c.is_done,sort_order:c.sort_order}));
   const t=byTask.get(id);
   if(t){
    t.checklist=window.__taskDetailData.checklist.map(c=>[c.text,c.done]);
    t.checklist_total=items.length;
    t.checklist_done=items.filter(c=>c.is_done).length;
   }
   refreshDrawer();
   toast('Đã xóa mục checklist.','success',true);
  }catch(err){
   toast(err.message||'Không thể xóa mục checklist.','error');
  }
  return;
 }

 commit('Đã xóa mục checklist',d=>{const t=d.tasks.find(t=>t.id===id);t.checklist.splice(index,1);syncChecklist(t);touch(t);},{taskId:id});
}

async function addDependencyForm(event){
 event.preventDefault();
 const id=drawerId;
 const select=$('newDepTask');
 const depId=select?.value;
 if(!depId)return;
 const btn=event.target.querySelector('button[type="submit"]');
 if(btn)btn.disabled=true;

 try{
  if(window.__worktree_is_cloud_workspace){
   await window.DependencyService.addDependency({taskId:id,dependsOnTaskId:depId});
   const deps=await window.DependencyService.getDependencies(id);
   window.__taskDetailData.dependencies=deps||[];
   const t=byTask.get(id);
   if(t) t.dependencies=(deps||[]).map(d=>d.depends_on_task_id);
   refreshDrawer();
   toast('Đã thêm liên kết phụ thuộc.','success',true);
  }else{
   commit('Đã thêm phụ thuộc',d=>{
    const t=d.tasks.find(t=>t.id===id);
    const depNum=Number(depId);
    if(!t.dependencies.includes(depNum))t.dependencies.push(depNum);
    touch(t);
   },{taskId:id});
  }
 }catch(err){
  toast(err.message||'Không thể thêm liên kết phụ thuộc.','error');
 }finally{
  if(btn)btn.disabled=false;
 }
}

async function deleteDependencyInline(taskId,depId){
 if(!taskId||!depId)return;
 try{
  if(window.__worktree_is_cloud_workspace){
   await window.DependencyService.deleteDependency({taskId,dependsOnTaskId:depId});
   const deps=await window.DependencyService.getDependencies(taskId);
   window.__taskDetailData.dependencies=deps||[];
   const t=byTask.get(taskId);
   if(t) t.dependencies=(deps||[]).map(d=>d.depends_on_task_id);
   refreshDrawer();
   toast('Đã hủy liên kết phụ thuộc.','success',true);
  }else{
   commit('Đã xóa phụ thuộc',d=>{
    const t=d.tasks.find(t=>t.id===taskId);
    t.dependencies=t.dependencies.filter(x=>x!==Number(depId));
    touch(t);
   },{taskId});
  }
 }catch(err){
  toast(err.message||'Không thể hủy phụ thuộc.','error');
 }
}

async function addComment(event){
 event.preventDefault();
 const id=drawerId;
 const textarea=$('commentText');
 const value=textarea?.value.trim();
 if(!value){textarea?.focus();return;}

 if(window.__worktree_is_cloud_workspace){
  const btn=event.target.querySelector('button[type="submit"]');
  if(btn)btn.disabled=true;
  try{
   await window.CommentService.addComment({taskId:id,body:value});
   textarea.value='';
   drawerDrafts.delete(id);
   const comments=await window.CommentService.getComments(id);
   window.__taskDetailData.comments=comments.map(c=>({
    id:c.id,
    text:c.body,
    author:resolveCommentAuthor(c.author_user_id),
    authorId:c.author_user_id,
    at:c.created_at
   }));
   const t=byTask.get(id);
   if(t) t.comments=window.__taskDetailData.comments;
   refreshDrawer();
   toast('Đã gửi bình luận thành công.','success',true);
  }catch(err){
   toast(err.message||'Không thể gửi bình luận.','error');
  }finally{
   if(btn)btn.disabled=false;
  }
  return;
 }

 if(commit('Đã thêm bình luận',d=>{const t=d.tasks.find(t=>t.id===id);t.comments.push({id:uid(),author:person().name,authorId:person().id,text:value,at:new Date().toISOString()});touch(t);},{taskId:id})){
  $('commentText').value='';drawerDrafts.delete(id);$('commentText').focus();
 }
}

async function deleteComment(id,commentId){
 if(!await ask('Xóa bình luận?','Bình luận sẽ bị xóa vĩnh viễn khỏi hệ thống.','Xóa bình luận',true))return;

 if(window.__worktree_is_cloud_workspace){
  try{
   await window.CommentService.deleteComment(commentId);
   const comments=await window.CommentService.getComments(id);
   window.__taskDetailData.comments=comments.map(c=>({
    id:c.id,
    text:c.body,
    author:resolveCommentAuthor(c.author_user_id),
    authorId:c.author_user_id,
    at:c.created_at
   }));
   const t=byTask.get(id);
   if(t) t.comments=window.__taskDetailData.comments;
   refreshDrawer();
   toast('Đã xóa bình luận.','success',true);
  }catch(err){
   toast(err.message||'Không thể xóa bình luận.','error');
  }
  return;
 }

 commit('Đã xóa bình luận',d=>{const t=d.tasks.find(t=>t.id===id);t.comments=t.comments.filter(c=>c.id!==commentId);touch(t);},{taskId:id});
}

async function logHours(event){
 event.preventDefault();
 const id=drawerId;
 const hoursInput=$('logHours');
 const noteInput=$('logNote');
 const hours=Number(hoursInput?.value);
 const note=noteInput?.value.trim()||'';
 if(!hours||hours<.01||hours>24)return;

 if(window.__worktree_is_cloud_workspace){
  const btn=event.target.querySelector('button[type="submit"]');
  if(btn)btn.disabled=true;
  try{
   await window.TimeEntryService.logTime({taskId:id,hours,note});
   hoursInput.value='';
   if(noteInput)noteInput.value='';
   drawerDrafts.delete(id);
   const entries=await window.TimeEntryService.getTimeEntries(id);
   window.__taskDetailData.logs=entries.map(l=>({
    id:l.id,
    hours:(l.minutes||0)/60,
    note:l.note,
    at:l.created_at,
    author:resolveCommentAuthor(l.user_id)
   }));
   refreshDrawer();
   toast(`Đã ghi ${num(hours)} giờ thực hiện lên đám mây.`,'success',true);
  }catch(err){
   toast(err.message||'Không thể ghi thời gian.','error');
  }finally{
   if(btn)btn.disabled=false;
  }
  return;
 }

 if(commit('Đã ghi '+num(hours)+' giờ thực hiện',d=>{const t=d.tasks.find(t=>t.id===id);t.actual=Math.round((t.actual+hours)*1e6)/1e6;t.logs.push({id:uid(),hours,note,at:new Date().toISOString(),author:person().name});touch(t);},{taskId:id})){
  $('logHours').value='';$('logNote').value='';drawerDrafts.delete(id);
 }
}

async function deleteLog(id,logId){
 if(!await ask('Xóa bản ghi thời gian?','Bản ghi này sẽ bị xóa khỏi đám mây và tổng giờ làm việc sẽ được tính lại tự động.','Xóa bản ghi',true))return;

 if(window.__worktree_is_cloud_workspace){
  try{
   await window.TimeEntryService.deleteTimeEntry(logId,id);
   const entries=await window.TimeEntryService.getTimeEntries(id);
   window.__taskDetailData.logs=entries.map(l=>({
    id:l.id,
    hours:(l.minutes||0)/60,
    note:l.note,
    at:l.created_at,
    author:resolveCommentAuthor(l.user_id)
   }));
   refreshDrawer();
   toast('Đã xóa bản ghi thời gian.','success',true);
  }catch(err){
   toast(err.message||'Không thể xóa bản ghi thời gian.','error');
  }
  return;
 }

 commit('Đã xóa bản ghi giờ',d=>{
  const t=d.tasks.find(t=>t.id===id);
  const entry=t.logs.find(l=>l.id===logId);
  if(entry) t.actual=Math.max(0,Math.round((t.actual-entry.hours)*1e6)/1e6);
  t.logs=t.logs.filter(l=>l.id!==logId);
  touch(t);
 },{taskId:id});
}

async function retryLoadChild(id,childType){
 if(!id||!window.__taskDetailData||window.__taskDetailData.taskId!==id)return;
 const orgId=window.__active_org_id||(window.__worktree_supabase_user?.organization?.id);
 window.__taskDetailData.loading[childType]=true;
 window.__taskDetailData.errors[childType]=null;
 refreshDrawer();

 try{
  if(childType==='checklist'&&window.ChecklistService){
   const items=await window.ChecklistService.getItems(id,orgId);
   window.__taskDetailData.checklist=items.map(c=>({id:c.id,text:c.content,done:c.is_done,sort_order:c.sort_order}));
   const t=byTask.get(id);
   if(t){
    t.checklist=window.__taskDetailData.checklist.map(c=>[c.text,c.done]);
    t.checklist_total=items.length;
    t.checklist_done=items.filter(c=>c.is_done).length;
   }
  }else if(childType==='dependencies'&&window.DependencyService){
   const deps=await window.DependencyService.getDependencies(id,orgId);
   window.__taskDetailData.dependencies=deps||[];
   const t=byTask.get(id);
   if(t) t.dependencies=(deps||[]).map(d=>d.depends_on_task_id);
  }else if(childType==='comments'&&window.CommentService){
   const coms=await window.CommentService.getComments(id,orgId);
   window.__taskDetailData.comments=coms.map(c=>({
    id:c.id,
    text:c.body,
    author:resolveCommentAuthor(c.author_user_id),
    authorId:c.author_user_id,
    at:c.created_at
   }));
   const t=byTask.get(id);
   if(t) t.comments=window.__taskDetailData.comments;
  }else if(childType==='logs'&&window.TimeEntryService){
   const entries=await window.TimeEntryService.getTimeEntries(id,orgId);
   window.__taskDetailData.logs=entries.map(l=>({
    id:l.id,
    hours:(l.minutes||0)/60,
    note:l.note,
    at:l.created_at,
    author:resolveCommentAuthor(l.user_id)
   }));
   const t=byTask.get(id);
   if(t) t.logs=window.__taskDetailData.logs;
  }
 }catch(err){
  window.__taskDetailData.errors[childType]=err.message||'Không thể tải dữ liệu.';
 }finally{
  window.__taskDetailData.loading[childType]=false;
  refreshDrawer();
 }
}

function elapsedLabel(){
 if(!state.timer)return '00:00:00';const seconds=Math.max(0,Math.floor(((state.timer.pausedAt||Date.now())-state.timer.startedAt)/1000));
 return `${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}

function renderTimer(){
 const t=state.timer?byTask.get(state.timer.taskId):null;$('timerDock').hidden=!t;
 if(t)$('timerDock').innerHTML=`<button class="timer-open" data-action="open-task" data-id="${t.id}"><span class="timer-live"></span><span><strong data-timer-value>${elapsedLabel()}</strong><small>${esc(t.title)}</small></span></button><button class="icon-btn" data-action="timer-stop" title="Dừng và ghi thời gian" aria-label="Dừng và ghi thời gian">${icon('stop')}</button>`;
}

async function stopTimer(){
 if(!state.timer)return true;
 const timer={...state.timer},t=byTask.get(timer.taskId);
 if(!t){state.timer=null;savePrefs();renderTimer();return true;}

 const hours=Math.max(0,Math.round(((timer.pausedAt||Date.now())-timer.startedAt)/3600000*1e6)/1e6);
 const minutes=Math.max(1,Math.round(((timer.pausedAt||Date.now())-timer.startedAt)/60000));

 if(hours>12&&!await ask('Xác nhận thời gian bấm giờ',`Bộ đếm đã chạy ${num(hours)} giờ. Ghi toàn bộ thời gian này cho "${t.title}"?`,'Ghi thời gian'))return false;

 if(window.__worktree_is_cloud_workspace){
  try{
   await window.TimeEntryService.logTime({
    taskId:timer.taskId,
    minutes:minutes,
    note:'Bộ đếm thời gian'
   });
   state.timer=null;
   savePrefs();
   renderTimer();
   if($('drawer').open&&drawerId===timer.taskId){
    const entries=await window.TimeEntryService.getTimeEntries(timer.taskId);
    window.__taskDetailData.logs=entries.map(l=>({
     id:l.id,
     hours:(l.minutes||0)/60,
     note:l.note,
     at:l.created_at,
     author:resolveCommentAuthor(l.user_id)
    }));
    refreshDrawer();
   }
   toast(`Đã dừng và ghi ${num(hours)} giờ thực hiện lên đám mây.`,'success',true);
   return true;
  }catch(err){
   toast(err.message||'Không thể lưu thời gian bấm giờ.','error');
   return false;
  }
 }

 const ok=commit('Đã dừng và ghi '+num(hours)+' giờ',d=>{
  const task=d.tasks.find(x=>x.id===timer.taskId);task.actual=Math.round((task.actual+hours)*1e6)/1e6;task.logs.push({id:uid(),hours,note:'Bộ đếm thời gian',at:new Date().toISOString(),author:person().name});touch(task);
 },{taskId:timer.taskId});
 if(ok){state.timer=null;savePrefs();renderTimer();if($('drawer').open)refreshDrawer();}
 return ok;
}

async function toggleTimer(id){
 if(!requireLogin()||!canUpdateTask(byTask.get(id)))return deny();
 const t=byTask.get(id);if(!t)return;
 if(state.timer?.taskId===id){await stopTimer();return;}
 if(t.status==='Hoàn thành'){toast('Mở lại công việc trước khi bấm giờ.','error');return;}
 if(state.timer){if(!await ask('Chuyển bộ đếm công việc?','Dừng và ghi thời gian của công việc đang chạy trước khi bắt đầu công việc này.','Dừng & chuyển'))return;if(!await stopTimer())return;}
 state.timer={taskId:id,startedAt:Date.now()};savePrefs();renderTimer();if($('drawer').open)refreshDrawer();toast('Đã bắt đầu bấm giờ. Thời gian sẽ được ghi khi bạn bấm Dừng.');
}
async function duplicateTask(id){
 if(window.__worktree_is_cloud_workspace){
  if(!requireLogin()||!canManageTask(byTask.get(id)))return deny();
  const source=byTask.get(id);if(!source)return;
  try{
   const created=await window.TaskService.createTask({
    nodeId:source.node,
    title:(source.title.slice(0,225)+' (bản sao)').slice(0,240),
    description:source.desc,
    priority:source.priority,
    primaryAssigneeId:source.owner,
    dueDate:source.due||null,
    startDate:source.start||null,
    estimateMinutes:Math.round((source.estimate||0)*60),
    tags:source.tags
   });
   if(created){
    data.tasks.unshift(created);
    rebuild();
    renderAll(true);
    openDrawer(created.id);
    toast('Đã nhân bản công việc thành công.','success');
   }
  }catch(e){
   toast(e.message||'Không thể nhân bản công việc.','error');
  }
  return;
 }
 if(!requireLogin()||!canManageTask(byTask.get(id)))return deny();
 const source=byTask.get(id);if(!source)return;const newId=uid();
 if(commit('Đã nhân bản công việc',d=>{
  const t=clone(source);t.id=newId;t.title=(source.title.slice(0,225)+' (bản sao)').slice(0,240);t.status='Chưa làm';t.progress=0;t.actual=0;t.checklist=t.checklist.map(c=>[c[0],false]);t.comments=[];t.logs=[];t.favorite=false;t.createdAt=new Date().toISOString();t.updatedAt=t.createdAt;t.resumeProgress=0;t.resumeStatus='Chưa làm';d.tasks.unshift(t);
 },{taskId:newId}))openDrawer(newId);
}
async function deleteTasks(ids){
 if(window.__worktree_is_cloud_workspace){
  if(!requireLogin()||!ids.every(id=>canManageTask(byTask.get(id))))return deny();
  const existing=ids.filter(id=>byTask.has(id));if(!existing.length)return;
  const name=existing.length===1?`"${byTask.get(existing[0]).title}"`:`${existing.length} công việc`;
  if(!await ask('Xóa công việc?',`Lưu trữ và ẩn ${name} khỏi danh sách công việc đang thực hiện.`,'Xóa công việc',true))return;

  let successCount=0,failedCount=0,lastErr='';
  const archivedIds=new Set();
  for(const id of existing){
   try{
    await window.TaskService.archiveTask(id);
    successCount++;
    archivedIds.add(id);
   }catch(e){
    failedCount++;
    lastErr=e.message;
   }
  }
  if(successCount>0){
   data.tasks=data.tasks.filter(t=>!archivedIds.has(t.id));
   state.selectedTasks.clear();
   if($('drawer').open&&archivedIds.has(drawerId))closeDialog('drawer',true);
   rebuild();
   renderAll(true);
  }
  if(failedCount>0){
   toast(`Đã xóa ${successCount} công việc. ${failedCount} công việc không thể xóa: ${lastErr}`,'error');
  }else{
   toast(`Đã xóa ${successCount} công việc.`,'success');
  }
  return;
 }
 if(!requireLogin()||!ids.every(id=>canManageTask(byTask.get(id))))return deny();
 const existing=ids.filter(id=>byTask.has(id));if(!existing.length)return;
 const linked=data.tasks.filter(t=>!existing.includes(t.id)&&t.dependencies.some(id=>existing.includes(id))).length;
 const name=existing.length===1?`"${byTask.get(existing[0]).title}"`:`${existing.length} công việc`;
 if(!await ask('Xóa công việc?',`Xóa ${name}, gồm checklist, bình luận và thời gian đã ghi.${linked?`\n${linked} công việc khác sẽ được bỏ liên kết phụ thuộc tới các việc bị xóa.`:''}${state.timer&&existing.includes(state.timer.taskId)?'\nBộ đếm của công việc bị xóa sẽ dừng mà không ghi thêm giờ.':''}\nBạn có thể hoàn tác thao tác này trong phiên hiện tại.`,'Xóa công việc',true))return;
 const set=new Set(existing);
 if(commit(`Đã xóa ${existing.length} công việc`,d=>{
  d.tasks=d.tasks.filter(t=>!set.has(t.id));
  d.tasks.forEach(t=>{if(t.dependencies.some(id=>set.has(id))){t.dependencies=t.dependencies.filter(id=>!set.has(id));if(t.dependency)t.dependency=(t.dependency.slice(0,870)+' · Một công việc phụ thuộc đã bị xóa.');touch(t);}});
 },{title:existing.length===1?byTask.get(existing[0])?.title:''})){
  state.selectedTasks.clear();if(state.timer&&set.has(state.timer.taskId))state.timer=null;savePrefs();renderAll(true);
 }
}
function openNodeForm(id=null,type=null){
 if(!requireAdmin())return;
 if($('nodeDialog').open&&dirtyNode){ask('Bỏ thay đổi đơn vị chưa lưu?','Biểu mẫu đang nhập sẽ bị bỏ để mở đơn vị khác.','Bỏ & tiếp tục',true).then(ok=>{if(ok){dirtyNode=false;closeDialog('nodeDialog',true);openNodeForm(id,type);}});return;}
 const n=id?byNode.get(id):null;if(id&&!n)return;
 editingNode=id;dirtyNode=false;$('nodeForm').reset();$('nodeFormError').hidden=true;
 $('nodeDialogTitle').textContent=n?'Chỉnh sửa đơn vị':'Thêm đơn vị con';$('nName').value=n?.name||'';$('nDesc').value=n?.desc||'';$('nCapacity').value=n?.capacity??40;
 const isRoot=n?.parent===null;
 $('nType').innerHTML=Object.entries(TYPES).filter(([key])=>isRoot||(key!=='company'&&(!window.__worktree_is_cloud_workspace||key!=='person'))).map(([key,label])=>`<option value="${key}" ${key===(n?.type||type||(state.view==='workload'?'department':'department'))?'selected':''}>${esc(label)}</option>`).join('');
 $('nType').disabled=isRoot;
 $('nParent').innerHTML=isRoot?'<option value="">Đơn vị gốc · Không có cấp cha</option>':optionNodes(n?.parent??state.selected,n?subtree(n.id):new Set());
 $('nParent').disabled=isRoot;$('capacityField').hidden=$('nType').value!=='person';
 $('deleteNodeBtn').hidden=!n||isRoot;closeSidebar();showDialog('nodeDialog','#nName');
}
function saveNode(event){
 if(window.__worktree_is_cloud_workspace){
  event.preventDefault();
  if(!requireAdmin())return deny();
  if(!$('nodeForm').reportValidity())return;

  const name=$('nName').value.trim(),id=editingNode,isNew=!editingNode,original=id?byNode.get(id):null,isRoot=original?.parent===null;
  const parent=isRoot?null:($('nParent').value||null);
  const type=isRoot?'company':$('nType').value;
  const desc=$('nDesc').value.trim();

  if(data.nodes.some(n=>n.id!==id&&n.parent===parent&&fold(n.name)===fold(name))){
   showFormError('nodeFormError','Đã có một đơn vị cùng tên trong nhánh này. Hãy dùng tên phân biệt.');
   return;
  }

  const submitBtn=$('nodeForm').querySelector('button[type="submit"]');
  const prevText=submitBtn?submitBtn.textContent:'Lưu';
  if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Đang lưu...';}
  $('nodeFormError').hidden=true;

  (async()=>{
   try{
    if(isNew){
     const res=await window.TreeService.createNode({
      name,
      type,
      parentId:parent,
      description:desc
     });
     data.nodes=res.nodes;
     rebuild();
     renderAll(true);
     dirtyNode=false;
     closeDialog('nodeDialog',true);
     if(parent&&!state.expanded.includes(parent))state.expanded.push(parent);
     if(res.created?.id)selectNode(res.created.id);
     toast('Đã tạo đơn vị mới thành công.','success');
    }else{
     const res=await window.TreeService.updateNode(id,{
      name,
      description:desc,
      type,
      parent_id:parent
     });
     data.nodes=res.nodes;
     rebuild();
     renderAll(true);
     dirtyNode=false;
     closeDialog('nodeDialog',true);
     toast('Đã cập nhật đơn vị thành công.','success');
    }
   }catch(err){
    showFormError('nodeFormError',err.message||'Không thể lưu đơn vị.');
   }finally{
    if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=prevText;}
   }
  })();
  return;
 }
 if(!requireAdmin()){event.preventDefault();return;}
 event.preventDefault();if(!$('nodeForm').reportValidity())return;
 const name=$('nName').value.trim(),id=editingNode||uid(),isNew=!editingNode,original=byNode.get(id),isRoot=original?.parent===null;
 const parent=isRoot?null:Number($('nParent').value),type=isRoot?'company':$('nType').value;
 if(data.nodes.some(n=>n.id!==id&&n.parent===parent&&fold(n.name)===fold(name))){showFormError('nodeFormError','Đã có một đơn vị cùng tên trong nhánh này. Hãy dùng tên phân biệt.');return;}
 if(original?.type==='person'&&type!=='person'&&data.tasks.some(t=>t.owner===id)){showFormError('nodeFormError','Nhân sự này đang phụ trách công việc. Hãy chuyển người phụ trách trước khi đổi loại đơn vị.');return;}
 const ok=commit(isNew?'Đã tạo đơn vị mới':'Đã cập nhật đơn vị',d=>{
  const value={id,parent,type,name,desc:$('nDesc').value.trim(),capacity:Number($('nCapacity').value)||0};
  const found=d.nodes.find(n=>n.id===id);if(found)Object.assign(found,value);else d.nodes.push(value);
 },{nodeId:id,onError:e=>showFormError('nodeFormError',e.message)});
 if(ok){dirtyNode=false;closeDialog('nodeDialog',true);if(parent&&!state.expanded.includes(parent))state.expanded.push(parent);if(isNew)selectNode(id);else{savePrefs();renderAll(true);}}
}
async function deleteNode(id=editingNode||state.selected){
 if(window.__worktree_is_cloud_workspace){
  if(!requireAdmin())return deny();
  const n=byNode.get(id);if(!n)return;
  if(n.parent===null){toast('Không thể xóa đơn vị gốc.','error');return;}
  if(!await ask('Xóa đơn vị?',`Lưu trữ và ẩn đơn vị "${n.name}". Các công việc thuộc đơn vị này sẽ không còn hiển thị trong nhánh.`,'Xóa đơn vị',true))return;

  try{
   const res=await window.TreeService.archiveNode(id);
   data.nodes=res.nodes;
   const parent=n.parent;
   if(state.selected===id)state.selected=parent;
   state.expanded=state.expanded.filter(x=>x!==id);
   dirtyNode=false;
   closeDialog('nodeDialog',true);
   rebuild();
   renderAll(true);
   toast('Đã xóa đơn vị thành công.','success');
  }catch(err){
   toast(err.message||'Không thể xóa đơn vị.','error');
  }
  return;
 }
 if(!requireAdmin())return;
 const n=byNode.get(id);if(!n)return;if(n.parent===null){toast('Không thể xóa đơn vị gốc.','error');return;}
 const ids=subtree(id),taskIds=new Set(data.tasks.filter(t=>ids.has(t.node)).map(t=>t.id)),otherAssigned=data.tasks.filter(t=>!taskIds.has(t.id)&&ids.has(t.owner)).length;
 if(!await ask('Xóa đơn vị và toàn bộ nhánh con?',`"${n.name}" gồm ${ids.size-1} đơn vị con và ${taskIds.size} công việc sẽ bị xóa.${otherAssigned?`\n${otherAssigned} công việc ở nhánh khác sẽ được chuyển thành “Chưa giao” do nhân sự bị xóa.`:''}\nLiên kết phụ thuộc tới công việc bị xóa sẽ được gỡ. Có thể hoàn tác trong phiên hiện tại.`,'Xóa toàn bộ nhánh',true))return;
 const parent=n.parent;
 if(commit('Đã xóa nhánh '+n.name,d=>{
  d.nodes=d.nodes.filter(x=>!ids.has(x.id));d.tasks=d.tasks.filter(t=>!taskIds.has(t.id));
  d.tasks.forEach(t=>{if(ids.has(t.owner))t.owner=null;t.dependencies=t.dependencies.filter(tid=>!taskIds.has(tid));});
 },{nodeId:parent,title:n.name})){
  state.expanded=state.expanded.filter(i=>!ids.has(i));if(ids.has(state.selected))state.selected=parent;
  state.savedViews=state.savedViews.filter(v=>!ids.has(v.selected));
  dirtyNode=false;closeDialog('nodeDialog',true);savePrefs();renderAll(true);
 }
}
function bulkStatus(status){
 if(window.__worktree_is_cloud_workspace){
  const ids=[...state.selectedTasks];
  if(!ids.length||!STATUS.includes(status))return;
  if(!requireLogin())return deny();

  toast(`Đang cập nhật trạng thái ${ids.length} công việc...`,'info');
  (async()=>{
   let successCount=0,failCount=0,lastErr='';
   for(const tid of ids){
    try{
     const res=await window.TaskService.updateStatus(tid,status);
     if(res&&res.isLatest&&res.task){
      const idx=data.tasks.findIndex(x=>x.id===tid);
      if(idx!==-1)data.tasks[idx]=res.task;
      successCount++;
     }
    }catch(e){
     failCount++;
     lastErr=e.message;
    }
   }
   rebuild();
   renderView();
   if($('drawer').open&&ids.includes(drawerId))renderDrawer();
   if(failCount>0){
    toast(`Đã cập nhật ${successCount}/${ids.length} công việc. ${failCount} thất bại: ${lastErr}`,'error');
   }else{
    toast(`Đã đổi trạng thái ${successCount} công việc thành ${status}.`,'success');
   }
  })();
  return;
 }
 const ids=new Set(state.selectedTasks);if(!ids.size||!STATUS.includes(status))return;
 commit(`Đã đổi trạng thái ${ids.size} công việc`,d=>{
  const map=new Map(d.tasks.map(t=>[t.id,t])),tasks=d.tasks.filter(t=>ids.has(t.id));
  if(status==='Hoàn thành'){
   tasks.forEach(t=>{if(t.status!=='Hoàn thành'){t.resumeStatus=t.status;t.resumeProgress=t.progress;}t.status=status;t.progress=100;touch(t);});
   for(const t of tasks){if(t.autoProgress&&t.checklist.some(c=>!c[1]))throw Error('Một công việc đã chọn chưa hoàn tất checklist tự tính.');if(blockers(t,map).length)throw Error(`"${t.title}" vẫn còn phụ thuộc chưa hoàn thành ngoài nhóm đã chọn.`);}
  }else tasks.forEach(t=>setTaskStatus(t,status,map));
 });
}
function bulkOwner(owner){
 if(window.__worktree_is_cloud_workspace){
  const ids=[...state.selectedTasks],ownerId=owner==='unassigned'?null:owner;if(!ids.length)return;
  if(!requireLogin())return deny();
  toast(`Đang phân công lại ${ids.length} công việc...`,'info');
  (async()=>{
   let successCount=0,failCount=0,lastErr='';
   for(const tid of ids){
    try{
     const updated=await window.TaskService.updateTask(tid,{primary_assignee_id:ownerId});
     if(updated){
      const idx=data.tasks.findIndex(x=>x.id===tid);
      if(idx!==-1)data.tasks[idx]=updated;
      successCount++;
     }
    }catch(e){
     failCount++;
     lastErr=e.message;
    }
   }
   rebuild();
   renderView();
   if($('drawer').open&&ids.includes(drawerId))renderDrawer();
   if(failCount>0){
    toast(`Đã phân công ${successCount}/${ids.length} công việc. ${failCount} thất bại: ${lastErr}`,'error');
   }else{
    toast(`Đã giao lại ${successCount} công việc.`,'success');
   }
  })();
  return;
 }
 const ids=new Set(state.selectedTasks),ownerId=owner==='unassigned'?null:owner;if(!ids.size)return;
 commit(`Đã giao lại ${ids.size} công việc`,d=>d.tasks.forEach(t=>{if(ids.has(t.id)){t.owner=ownerId;touch(t);}}));
}

function downloadFile(filename,content,type){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function legacyExportJSON(){
 const payload={app:'WorkTree X',schemaVersion:APP_VERSION,exportedAt:new Date().toISOString(),timezone:TZ,data};
 downloadFile(`WorkTree-X-sao-luu-${TODAY}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
 toast('Đã tạo tệp sao lưu JSON. Kiểm tra thư mục tải xuống của trình duyệt.');
}
function csvCell(value){
 let s=String(value??'');
 if(/^[\s]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function exportCSV(){
 if(!requireLogin()||!canReport())return deny();
 const tasks=filteredTasks(),headers=['Mã','Công việc','Đơn vị','Người phụ trách','Trạng thái','Ưu tiên','Ngày bắt đầu','Hạn hoàn thành','Tiến độ (%)','Giờ ước tính','Giờ đã làm','Thẻ','Mô tả','Mục checklist','Mục đã xong'];
 const rows=[headers,...tasks.map(t=>[t.id,t.title,pathName(t.node),nodeName(t.owner),t.status,t.priority,t.start,t.due,t.progress,t.estimate,t.actual,t.tags.join(', '),t.desc,t.checklist.length,t.checklist.filter(c=>c[1]).length])];
 downloadFile(`WorkTree-X-bao-cao-${TODAY}.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
 toast(`Đã xuất ${tasks.length} công việc theo bộ lọc hiện tại.`);
}
async function importJSON(event){
 if(!requireAdmin())return;
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 if(file.size>10*1024*1024){toast('Tệp vượt quá 10 MB. Hãy chia nhỏ dữ liệu trước khi nhập.','error');return;}
 try{
  const raw=JSON.parse((await file.text()).replace(/^\uFEFF/,'')),result=validateData(raw);
  pendingImport=result;
  const text=`Tệp "${file.name}" có ${result.data.nodes.length} đơn vị và ${result.data.tasks.length} công việc.\nDữ liệu trong tệp sẽ THAY THẾ không gian đang mở, không gộp thêm. Dữ liệu hiện tại có thể được hoàn tác trong phiên này.${state.timer?'\nBộ đếm đang chạy sẽ bị dừng; giờ chưa bấm Dừng chưa được ghi.':''}`;
  if(!await ask('Kiểm tra & nhập dữ liệu',text,'Nhập thay thế',false,result.warnings.join('\n')||'Cấu trúc cây, ngày tháng, liên kết công việc và vòng phụ thuộc đã được kiểm tra.')){pendingImport=null;return;}
  const candidate=pendingImport.data;pendingImport=null;
  if(commit('Đã nhập dữ liệu JSON',d=>{d.nodes=candidate.nodes;d.tasks=candidate.tasks;d.activities=candidate.activities;})){
   state.selected=rootNode().id;state.expanded=[state.selected];state.filters=blankFilters();state.selectedTasks.clear();state.timer=null;state.page=1;state.savedViews=state.savedViews.filter(v=>byNode.has(v.selected));
   if(Array.isArray(raw.personalPins))restorePins(raw.personalPins);savePrefs();closeDialog('settingsDialog',true);closeDialog('drawer',true);renderAll(true);
  }
 }catch(e){pendingImport=null;toast('Không nhập dữ liệu: '+(e.message||'JSON không hợp lệ.'),'error');}
}
async function resetDemo(){
 if(!requireAdmin())return;
 if(!await ask('Khôi phục dữ liệu mẫu V6?','Thay thế dữ liệu đang mở bằng 21 đơn vị và 10 công việc mẫu tháng 9/2026. Công việc hiện tại được giữ trong lịch sử hoàn tác của phiên và bản dự phòng nếu lưu cục bộ khả dụng.','Khôi phục mẫu',true))return;
 const original=validateData(SEED).data;
 if(commit('Đã khôi phục dữ liệu mẫu',d=>{d.nodes=original.nodes;d.tasks=original.tasks;d.activities=[];})){
  state.selected=rootNode().id;state.expanded=[1,10,11,12,13];state.filters=blankFilters();state.timer=null;state.savedViews=[];state.selectedTasks.clear();state.view='overview';state.page=1;
  savePrefs();closeDialog('settingsDialog',true);closeDialog('drawer',true);renderAll(true);
 }
}
async function restoreBackup(){
 if(!requireAdmin())return;
 try{
  const raw=localStorage.getItem(KEYS.backup);if(!raw){toast('Chưa có bản dự phòng. Bản dự phòng xuất hiện sau khi bạn thay đổi dữ liệu.');return;}
  const restored=validateData(JSON.parse(raw)).data;
  if(!await ask('Phục hồi phiên bản đã lưu trước?','Thay thế dữ liệu hiện tại bằng bản lưu ngay trước lần ghi dữ liệu gần nhất. Nên xuất JSON trước khi tiếp tục.','Phục hồi'))return;
  if(commit('Đã phục hồi bản lưu trước',d=>{d.nodes=restored.nodes;d.tasks=restored.tasks;d.activities=restored.activities;})){
   state.selected=rootNode().id;state.timer=null;state.filters=blankFilters();state.expanded=[state.selected];savePrefs();closeDialog('settingsDialog',true);renderAll(true);
  }
 }catch(e){toast('Không phục hồi được bản dự phòng: '+e.message,'error');}
}
async function acceptRecovery(){
 if(!requireAdmin())return;
 if(!await ask('Dùng dữ liệu đang mở?','Dữ liệu đang mở sẽ trở thành bản lưu chính và thay thế bản chính không đọc được. Hãy xuất JSON trước nếu cần giữ thêm bản sao.','Dùng bản đang mở'))return;
 if(persistData(true)){renderAll(true);toast('Đã lưu bản đang mở làm dữ liệu chính.');}
}
async function loadExternal(){
 if(!await ask('Tải phiên bản từ tab khác?','Tải dữ liệu mới nhất đã được lưu. Nội dung biểu mẫu chưa lưu, lịch sử hoàn tác trong phiên và bộ đếm đang chạy sẽ được xóa. Hãy sao lưu JSON trước nếu cần giữ bản hiện tại.','Tải bản mới'))return;
 try{
  const raw=localStorage.getItem(KEYS.data);
  if(!raw){if(await ask('Dữ liệu đã bị xóa ở tab khác','Ghi lại bản đang mở thành dữ liệu chính?','Giữ bản đang mở')){persistData(true);renderAll(true);}return;}
  const result=validateData(JSON.parse(raw));data=result.data;lastRaw=raw;externalRaw=null;storageIssue='';storageProtected=false;history=[];future=[];state.timer=null;
  dirtyTask=false;dirtyNode=false;['taskDialog','nodeDialog','drawer'].forEach(id=>closeDialog(id,true));
  rebuild();savePrefs();renderAll(true);renderStorage();toast('Đã tải dữ liệu mới nhất từ trình duyệt.');
 }catch(e){toast('Chưa thể tải dữ liệu mới: '+e.message,'error');}
}
function legacyOpenSettings(){
 const root=rootNode(),user=person();
 $('settingsContent').innerHTML=`
 <section class="settings-section"><h3>${icon('building')}Không gian làm việc</h3><div class="settings-row"><div><strong>${esc(root.name)}</strong><p>${data.nodes.length} đơn vị · ${data.tasks.length} công việc · ${people().length} nhân sự</p></div><button class="btn small" data-action="edit-node" data-id="${root.id}">${icon('edit')}Đổi tên</button></div></section>
 <section class="settings-section"><h3>${icon('user')}Hồ sơ cục bộ</h3><div class="settings-row"><div><strong>Người đang sử dụng</strong><p>Dùng cho “Công việc của tôi” và tên trong bình luận, nhật ký.</p></div><select id="profileSelect" aria-label="Chọn hồ sơ cục bộ">${optionPeople(user.id,false)||'<option value="">Chưa có nhân sự</option>'}</select></div><p>Đây không phải đăng nhập hay phân quyền. Người có quyền truy cập trình duyệt này có thể xem và sửa dữ liệu.</p></section>
 <section class="settings-section"><h3>${icon('sun')}Trải nghiệm giao diện</h3><div class="settings-row"><div><strong>Giao diện</strong><p>Chọn sáng, tối hoặc theo thiết lập hệ thống.</p></div><div class="segmented-control" role="group" aria-label="Giao diện">${[['light','sun','Sáng'],['dark','moon','Tối'],['auto','monitor','Hệ thống']].map(([v,i,label])=>`<button class="${state.theme===v?'selected':''}" data-action="set-theme" data-theme="${v}" aria-pressed="${state.theme===v}">${icon(i)}${label}</button>`).join('')}</div></div><div class="settings-row"><div><strong>Mật độ thông tin</strong><p>Thay đổi độ giãn cách trong bảng và thẻ công việc.</p></div><div class="segmented-control" role="group" aria-label="Mật độ thông tin">${[['comfortable','Thoải mái'],['compact','Gọn gàng']].map(([v,label])=>`<button class="${state.density===v?'selected':''}" data-action="set-density" data-density="${v}" aria-pressed="${state.density===v}">${label}</button>`).join('')}</div></div><div class="settings-row"><div><strong>Múi giờ của không gian</strong><p>Ngày đến hạn và nhắc việc dùng giờ Việt Nam.</p></div><span class="tag">Asia/Ho_Chi_Minh · UTC+7</span></div></section>
 <section class="settings-section"><h3>${icon('shield')}Dữ liệu & sao lưu</h3><div class="privacy-note"><strong>Dữ liệu của bạn, trên trình duyệt của bạn.</strong><br>Không gửi lên máy chủ. Tệp HTML chạy độc lập, không cần mạng. Xóa dữ liệu trình duyệt hoặc đổi đường dẫn tệp có thể khiến dữ liệu cũ không còn truy cập được. Xuất JSON định kỳ để chuyển máy và lưu dự phòng.</div><div class="data-actions"><button class="btn primary" data-action="export-json">${icon('download')}Sao lưu JSON</button><button class="btn" data-action="import-json">${icon('upload')}Nhập JSON</button><button class="btn" data-action="export-csv">${icon('file')}Xuất báo cáo CSV</button></div><p>JSON lưu toàn bộ đơn vị, công việc, checklist, bình luận, thời gian đã ghi và nhật ký. CSV chỉ xuất các công việc theo phạm vi và bộ lọc hiện tại; công thức tiềm ẩn được vô hiệu hóa khi xuất.</p><div class="settings-row"><div><strong>Bản lưu dự phòng</strong><p>Giữ một phiên bản trước lần ghi gần nhất; không thay thế sao lưu ngoài trình duyệt.</p></div><button class="btn small" data-action="restore-backup">${icon('undo')}Phục hồi bản trước</button></div></section>
 <section class="settings-section"><h3>${icon('refresh')}Dữ liệu mẫu</h3><div class="settings-row"><div><strong>Khôi phục mẫu từ V6</strong><p>21 đơn vị, 10 công việc mẫu. Thay thế không gian đang mở.</p></div><button class="btn small danger" data-action="reset-demo">Khôi phục mẫu</button></div></section>
 <section class="settings-section"><h3>${icon('info')}Về phiên bản này</h3><p>WorkTree X V7 · Nâng cấp từ tệp V6 được cung cấp.<br>Ứng dụng cục bộ một người sử dụng. Chưa có máy chủ, đồng bộ đa người dùng, thông báo đẩy, kiểm soát truy cập hoặc AI kết nối API. “Nhắc việc” và “Gợi ý hành động” được tính bằng quy tắc từ dữ liệu thực trong tệp.</p><button class="link-btn" data-action="help" style="margin-top:12px">Hướng dẫn sử dụng & cách tính chỉ số ${icon('arrow-right')}</button></section>`;
 closeSidebar();showDialog('settingsDialog');
}
function legacyOpenHelp(){
 $('infoTitle').textContent='Làm việc nhanh hơn, rõ ràng hơn';$('infoEyebrow').textContent='HƯỚNG DẪN SỬ DỤNG';
 const shortcuts=[['Tìm toàn bộ & lệnh nhanh','Ctrl / ⌘ K'],['Thu / mở thanh điều hướng','Ctrl / ⌘ B'],['Tạo công việc mới','N'],['Tìm trong phạm vi','/'],['Chuyển 7 chế độ xem','1 – 7'],['Hoàn tác thay đổi','Ctrl / ⌘ Z'],['Làm lại','Ctrl / ⌘ Shift Z'],['Đóng hộp thoại','Esc'],['Gửi bình luận','Ctrl / ⌘ Enter'],['Lưu biểu mẫu','Ctrl / ⌘ Enter'],['Mở hướng dẫn','?'],['Xóa các việc đã chọn','Delete']];
 $('infoContent').innerHTML=`<section class="help-section"><h3>Bắt đầu trong 4 thao tác</h3><ol><li>Chọn một đơn vị trong cây để giới hạn phạm vi. “Bao gồm cấp con” tổng hợp công việc từ mọi nhánh phía dưới.</li><li>Tạo công việc với tên rõ ràng, người phụ trách và thời hạn. Bấm tên công việc để sửa, chia checklist, ghi giờ và bình luận.</li><li>Chuyển giữa Danh sách, Kanban, Tiến độ, Lịch và Tải công việc. Bộ lọc được giữ nhất quán khi đổi cách xem.</li><li>Xuất JSON để sao lưu toàn bộ. Dùng CSV khi cần báo cáo các công việc đang lọc. Nhập JSON của V5/V6 hoặc V7 để chuyển dữ liệu.</li></ol></section>
 <section class="help-section"><h3>Phím tắt</h3><div class="help-shortcuts">${shortcuts.map(([text,key])=>`<div class="help-shortcut"><span>${text}</span><kbd>${key}</kbd></div>`).join('')}</div><p>Các phím đơn chỉ hoạt động khi không nhập liệu. Tab / Shift+Tab di chuyển giữa các điều khiển; mũi tên trái/phải chuyển thẻ chế độ xem; mũi tên lên/xuống chọn kết quả tìm nhanh.</p></section>
 <section class="help-section"><h3>Chỉ số được tính như thế nào?</h3><div class="formula"><strong>Tỷ lệ hoàn thành</strong> = số việc ở trạng thái Hoàn thành / tổng việc trong phạm vi sau lọc.<br><strong>Tiến độ đơn vị</strong> = trung bình phần trăm tiến độ các công việc trong nhánh, không trọng số giờ.<br><strong>Quá hạn</strong> = có hạn trước ngày hiện tại theo giờ Việt Nam và chưa Hoàn thành.<br><strong>Cần chú ý</strong> = chưa Hoàn thành và quá hạn, đến hạn hôm nay, Khẩn cấp hoặc đang chờ công việc phụ thuộc.</div><p>Không có chỉ số tăng trưởng, điểm sức khỏe hay “AI” giả lập. Các số liệu phụ thuộc vào độ chính xác của dữ liệu được nhập.</p></section>
 <section class="help-section"><h3>Lịch, tiến độ và năng lực tuần</h3><p>Lịch tháng dùng ngày đến hạn. Thanh tiến độ sử dụng ngày bắt đầu và hạn; nếu thiếu ngày bắt đầu, ứng dụng ước tính ngược từ số giờ, giả định 8 giờ/ngày làm việc và đánh dấu bằng đường viền nét đứt.</p><p>Tải tuần dùng max(giờ ước tính − giờ đã làm, 0), phân bổ đều trên ngày làm việc trong lịch của công việc. Nếu khoảng lịch chỉ có cuối tuần, giờ được gán vào ngày đến hạn. Công việc hoàn thành không tính vào giờ còn lại; công việc chưa có hạn được tách riêng. Năng lực tuần chỉnh được trong hồ sơ nhân sự. Đây không phải dữ liệu chấm công hay báo cáo lịch sử năng suất.</p></section>
 <section class="help-section"><h3>Checklist & phụ thuộc</h3><p>Mặc định checklist độc lập với phần trăm tiến độ. Bật “Tự tính tiến độ theo checklist” để phần trăm tăng hoặc giảm đúng theo số mục hoàn tất. 100% checklist không tự đóng công việc; bạn vẫn chủ động chọn Hoàn thành. Liên kết phụ thuộc không cho phép vòng lặp; việc còn phụ thuộc đang mở không thể chuyển sang Hoàn thành.</p></section>
 <section class="help-section"><h3>Giữ dữ liệu an toàn</h3><p>Dữ liệu được lưu trên trình duyệt và nguồn trang đang dùng, không đồng bộ giữa máy. Đường dẫn file:// có cách lưu tùy trình duyệt; không nên chỉ dựa vào khả năng tự chuyển dữ liệu cũ. Hãy xuất JSON từ bản cũ rồi nhập vào V8 khi không thấy dữ liệu.</p><p>Hoàn tác giữ tối đa 20 thay đổi trong phiên (5 với tập dữ liệu lớn), không giữ sau khi tải lại trang. Một bản dự phòng trước lần ghi gần nhất được lưu riêng nếu bộ nhớ trình duyệt cho phép. Khi nhập JSON, ứng dụng xác thực trước rồi yêu cầu xác nhận thay thế. Khi lỗi lưu xuất hiện, xuất JSON ngay trước khi đóng trang.</p><p>Bình luận và tài khoản lưu cục bộ. Quyền trên giao diện không thay thế kiểm soát truy cập tại máy chủ. Khi phiên tự khóa, bộ đếm tạm dừng. Bộ đếm tiếp tục tính thời gian khi trang đóng và chỉ cộng vào giờ thực hiện khi bấm Dừng; trình duyệt phải cho phép lưu thiết lập để giữ bộ đếm qua lần mở lại.</p></section>`;
 showDialog('infoDialog');
}
function openNotifications(){
 const active=readableTasks().filter(t=>t.status!=='Hoàn thành'),late=active.filter(isLate),today=active.filter(isToday),other=active.filter(t=>!isLate(t)&&!isToday(t)&&(t.priority==='Khẩn cấp'||blockers(t).length));
 $('infoTitle').textContent='Nhắc việc trong không gian';$('infoEyebrow').textContent='ĐƯỢC TÍNH TỪ CÔNG VIỆC';
 const section=(title,tasks)=>tasks.length?`<section class="notification-section"><h3>${title} · ${tasks.length}</h3>${tasks.slice(0,12).map(t=>`<button class="notification-item" data-action="open-task" data-id="${t.id}"><span class="notification-icon">${icon(isLate(t)?'alert':blockers(t).length?'link':'clock')}</span><span><strong>${esc(t.title)}</strong><small>${esc(nodeName(t.owner))} · ${esc(t.due?formatDate(t.due,true):'Chưa có hạn')}${blockers(t).length?' · Đang chờ phụ thuộc':''}</small></span></button>`).join('')}${tasks.length>12?`<p class="view-note">Đang hiển thị 12/${tasks.length} việc. Mở “Cần chú ý” để xem tất cả.</p>`:''}</section>`:'';
 $('infoContent').innerHTML=section('Công việc quá hạn',late)+section('Đến hạn hôm nay',today)+section('Khẩn cấp hoặc chờ phụ thuộc',other)||emptyState('Không có nhắc việc cần xử lý','Không có việc quá hạn, đến hạn hôm nay, khẩn cấp hoặc bị chặn.',null,'',false,'check-circle');
 $('infoContent').innerHTML+='<p class="view-note">Nhắc việc cục bộ trong phạm vi được cấp, không gửi email hoặc thông báo đẩy.</p>';
 showDialog('infoDialog');
}
function openCalendarDay(date){
 const tasks=filteredTasks().filter(t=>t.due===date);
 $('infoTitle').textContent='Công việc ngày '+formatDate(date,true);$('infoEyebrow').textContent=tasks.length+' CÔNG VIỆC ĐẾN HẠN';
 $('infoContent').innerHTML=tasks.length?tasks.map(t=>`<button class="notification-item" data-action="open-task" data-id="${t.id}"><span class="notification-icon">${icon('calendar')}</span><span><strong>${esc(t.title)}</strong><small>${esc(nodeName(t.owner))} · ${esc(t.status)}</small></span></button>`).join(''):emptyState('Lịch ngày này đang trống','Không có công việc đến hạn phù hợp bộ lọc.',null,'',true,'calendar');
 $('infoContent').innerHTML+=`<button class="btn primary" style="margin-top:15px" data-action="new-task" data-due="${date}">${icon('plus')}Tạo công việc đến hạn ngày này</button>`;showDialog('infoDialog');
}
function saveViewDialog(){
 if(state.savedViews.length>=20){toast('Đã có 20 góc nhìn. Xóa một góc nhìn cũ trước khi tạo mới.','error');return;}
 $('savedViewName').value='';$('savedViewName').setCustomValidity('');showDialog('nameDialog','#savedViewName');
}
function saveView(event){
 event.preventDefault();const name=$('savedViewName').value.trim();if(!name)return;
 if(state.savedViews.some(v=>fold(v.name)===fold(name))){$('savedViewName').setCustomValidity('Tên góc nhìn đã tồn tại.');$('savedViewName').reportValidity();return;}
 if(window.__worktree_is_cloud_workspace){
  const orgId = window.appState?.activeOrganizationId;
  if(!orgId) return toast('Không tìm thấy không gian làm việc.', 'error');
  (async()=>{
   try{
    await window.SavedViewService.createSavedView({
     organizationId: orgId,
     name,
     selectedNodeId: state.selected,
     viewType: state.view,
     filters: clone(state.filters),
     sortBy: state.sort,
     includeChildren: state.includeChildren
    });
    const freshViews = await window.SavedViewRepository.getSavedViews(orgId);
    if(orgId === window.appState?.activeOrganizationId){
     window.__worktree_saved_views = (freshViews||[]).map(sv => ({
      id: sv.id,
      name: sv.name,
      selected: sv.selected_node_id,
      view: sv.view_type || 'overview',
      filters: sv.filters || blankFilters(),
      sort: sv.sort_by || 'priority',
      includeChildren: sv.include_children !== false,
      rawSavedView: sv
     }));
     state.savedViews = window.__worktree_saved_views;
     if(window.appState) window.appState.savedViews = freshViews;
     closeDialog('nameDialog',true);
     if(typeof renderTree==='function') renderTree();
     else if(typeof legacyRenderTree==='function') legacyRenderTree();
     toast('Đã lưu góc nhìn: '+name);
    }
   }catch(err){
    toast(err.message||'Không thể lưu góc nhìn đám mây.','error');
   }
  })();
  return;
 }
 state.savedViews.push({id:uid(),name,selected:state.selected,view:state.view,filters:clone(state.filters),sort:state.sort,includeChildren:state.includeChildren});
 savePrefs();closeDialog('nameDialog',true);renderTree();toast('Đã lưu góc nhìn: '+name);
}
function loadView(id){
 const v=state.savedViews.find(v=>v.id===id);if(!v)return;
 const fallbackNode = rootNode()?.id || null;
 const targetNode = byNode.has(v.selected) ? v.selected : fallbackNode;
 if(!targetNode){toast('Đơn vị của góc nhìn này không còn tồn tại.','error');return;}
 state.selected=targetNode;state.view=v.view;state.filters=clone(v.filters);state.sort=v.sort;state.includeChildren=v.includeChildren;state.page=1;state.selectedTasks.clear();closeSidebar();
 if(!window.__worktree_is_cloud_workspace) savePrefs();
 renderAll(true);
}
async function deleteView(id){
 const v=state.savedViews.find(v=>v.id===id);if(!v)return;if(!await ask('Xóa góc nhìn đã lưu?',`Xóa "${v.name}". Công việc và đơn vị không bị ảnh hưởng.`,'Xóa góc nhìn'))return;
 if(window.__worktree_is_cloud_workspace){
  const orgId = window.appState?.activeOrganizationId;
  if(!orgId) return toast('Không tìm thấy không gian làm việc.', 'error');
  try{
   await window.SavedViewService.deleteSavedView({ organizationId: orgId, viewId: id });
   const freshViews = await window.SavedViewRepository.getSavedViews(orgId);
   if(orgId === window.appState?.activeOrganizationId){
    window.__worktree_saved_views = (freshViews||[]).map(sv => ({
     id: sv.id,
     name: sv.name,
     selected: sv.selected_node_id,
     view: sv.view_type || 'overview',
     filters: sv.filters || blankFilters(),
     sort: sv.sort_by || 'priority',
     includeChildren: sv.include_children !== false,
     rawSavedView: sv
    }));
    state.savedViews = window.__worktree_saved_views;
    if(window.appState) window.appState.savedViews = freshViews;
    if(typeof renderTree==='function') renderTree();
    else if(typeof legacyRenderTree==='function') legacyRenderTree();
    toast('Đã xóa góc nhìn.');
   }
  }catch(err){
   toast(err.message||'Không thể xóa góc nhìn đám mây.','error');
  }
  return;
 }
 state.savedViews=state.savedViews.filter(v=>v.id!==id);savePrefs();renderTree();toast('Đã xóa góc nhìn.');
}
function openCommand(){
 if(!requireLogin())return;
 $('commandInput').value='';commandIndex=0;renderCommand();showDialog('commandDialog','#commandInput');
}
function renderCommand(){
 const q=fold($('commandInput').value);
 const actions=[
  {label:'Tạo công việc mới',meta:'Thao tác · N',icon:'plus',allowed:canCreateTask(),run:()=>openTaskForm()},
  {label:'Thêm đơn vị con',meta:'Cấu trúc',icon:'network',allowed:isAdmin(),run:()=>openNodeForm()},
  {label:'Tổng quan công việc',meta:'Chế độ xem · 1',icon:'dashboard',run:()=>navigate('overview')},
  {label:'Công việc của tôi',meta:'Cá nhân',icon:'user',run:()=>navigate('mine')},
  {label:'Mở bảng Kanban',meta:'Chế độ xem · 3',icon:'kanban',run:()=>setView('kanban')},
  {label:'Mở lịch công việc',meta:'Chế độ xem · 5',icon:'calendar',run:()=>setView('calendar')},
  {label:'Tải công việc đội ngũ',meta:'Chế độ xem · 6',icon:'chart',run:()=>setView('workload')},
  {label:'Sao lưu dữ liệu JSON',meta:'Dữ liệu',icon:'download',allowed:isAdmin(),run:exportJSON},
  {label:'Cài đặt không gian',meta:'Thiết lập',icon:'settings',run:openSettings},
  {label:'Đổi giao diện sáng / tối',meta:'Giao diện',icon:'moon',run:()=>toggleTheme()},
  {label:'Phím tắt và hướng dẫn',meta:'Trợ giúp · ?',icon:'keyboard',run:openHelp}
 ].filter(o=>o.allowed!==false&&(!q||fold(o.label).includes(q)));
 const nodes=visibleNodes().filter(n=>q&&fold(n.name+' '+n.desc).includes(q)).slice(0,7).map(n=>({label:n.name,meta:TYPES[n.type],icon:nodeIcon(n.type),run:()=>selectNode(n.id)}));
 const tasks=readableTasks().filter(t=>q?fold(`${t.title} ${t.tags.join(' ')} ${nodeName(t.owner)} #${t.id}`).includes(q):attention(t)).slice(0,q?14:4).map(t=>({label:t.title,meta:t.status,icon:'check-circle',run:()=>openDrawer(t.id)}));
 commandOptions=[...actions,...nodes,...tasks].slice(0,30);commandIndex=0;
 $('commandResults').innerHTML=commandOptions.length?commandOptions.map((o,i)=>`<div class="command-option" id="command-option-${i}" role="option" aria-selected="${i===0}" data-command-index="${i}">${icon(o.icon)}<span class="command-label">${esc(o.label)}</span><small>${esc(o.meta)}</small>${icon('enter','command-enter')}</div>`).join(''):'<div class="empty-state mini"><h3>Không tìm thấy kết quả</h3><p>Thử tên công việc, nhân sự, đơn vị hoặc “tạo công việc”.</p></div>';
 if(commandOptions.length)$('commandInput').setAttribute('aria-activedescendant','command-option-0');else $('commandInput').removeAttribute('aria-activedescendant');
}
function selectCommand(index){
 if(!commandOptions.length)return;commandIndex=(index+commandOptions.length)%commandOptions.length;
 $$('#commandResults [role="option"]').forEach((el,i)=>el.setAttribute('aria-selected',String(i===commandIndex)));
 const el=$('command-option-'+commandIndex);$('commandInput').setAttribute('aria-activedescendant',el.id);el.scrollIntoView({block:'nearest'});
}
function executeCommand(index=commandIndex){const action=commandOptions[index];if(!action)return;closeDialog('commandDialog',true);action.run();}
function toggleTheme(){state.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme();savePrefs();if($('settingsDialog').open)openSettings();}

 document.addEventListener('click',async event=>{
  const command=event.target.closest('[data-command-index]');if(command){executeCommand(Number(command.dataset.commandIndex));return;}
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;event.preventDefault();
  const action=el.dataset.action;
  const rawId=el.dataset.id;
  const id=(rawId && !isNaN(rawId)) ? Number(rawId) : rawId;
 try{
  switch(action){
   case 'sidebar':toggleSidebar();break;
   case 'sidebar-close':closeSidebar(true);break;
   case 'workspace':if(typeof window.openWorkspaceSwitcher==='function'){window.openWorkspaceSwitcher();}else{openSettings();}break;
   case 'settings':openSettings();break;case 'profile':openProfile();break;
   case 'nav':navigate(el.dataset.nav);break;
   case 'new-task':if($('infoDialog').open)closeDialog('infoDialog',true);openTaskForm(null,{status:el.dataset.status,due:el.dataset.due,node:el.dataset.node?Number(el.dataset.node):undefined});break;
   case 'edit-task':openTaskForm(id);break;
   case 'open-task':if($('infoDialog').open)closeDialog('infoDialog',true);openDrawer(id);break;
   case 'duplicate-task':await duplicateTask(id);break;
   case 'delete-task':await deleteTasks([id]);break;
   case 'complete':toggleComplete(id);break;
   case 'favorite':toggleFavorite(id);break;
   case 'new-node':openNodeForm();break;
   case 'edit-node':openNodeForm(id);break;
   case 'node-menu':openNodeForm(state.selected);break;
   case 'delete-node':await deleteNode();break;
   case 'select-node':selectNode(id);break;
   case 'tree-toggle':state.expanded=state.expanded.includes(id)?state.expanded.filter(x=>x!==id):[...state.expanded,id];savePrefs();renderTree();break;
   case 'expand-tree':{const parents=data.nodes.filter(n=>childrenOf(n.id).length).map(n=>n.id);state.expanded=parents.every(id=>state.expanded.includes(id))?[]:parents;savePrefs();renderTree();break;}
   case 'view':setView(el.dataset.view);break;
   case 'view-list':setView('list');break;
   case 'view-children':setView('children');break;
   case 'filters':state.filterOpen=!state.filterOpen;syncFilters();savePrefs();break;
   case 'clear-filters':clearFilters();break;
   case 'remove-filter':updateFilter(el.dataset.key,el.dataset.key==='favorite'?false:'');syncFilters();break;
   case 'kpi':{
    const key=el.dataset.kind;applyPreset(key==='doing'?{status:'Đang làm',due:''}:key==='done'?{status:'Hoàn thành',due:''}:key==='attention'?{status:'',due:'attention'}:{status:'',due:''});break;
   }
   case 'focus-tab':state.focusTab=el.dataset.kind;renderView();break;
   case 'board-more':applyPreset({status:el.dataset.status});break;
   case 'insight-late':applyPreset({due:'late',status:''});break;
   case 'insight-today':applyPreset({due:'today',status:''});break;
   case 'insight-unassigned':applyPreset({owner:'unassigned'});break;
   case 'insight-unscheduled':applyPreset({due:'unscheduled'});break;
   case 'insight-attention':applyPreset({due:'attention',status:''});break;
   case 'insight-workload':setView('workload');break;
   case 'owner-tasks':applyPreset({owner:String(id)},'list');break;
   case 'save-view':saveViewDialog();break;
   case 'load-view':loadView(id);break;
   case 'delete-view':await deleteView(id);break;
   case 'command':openCommand();break;
   case 'notifications':openNotifications();break;
   case 'calendar-day':openCalendarDay(el.dataset.date);break;
   case 'help':openHelp();break;
   case 'theme':toggleTheme();break;
   case 'set-theme':state.theme=el.dataset.theme;applyTheme();savePrefs();openSettings();break;
   case 'density':state.density=state.density==='compact'?'comfortable':'compact';applyTheme();savePrefs();break;
   case 'set-density':state.density=el.dataset.density;applyTheme();savePrefs();openSettings();break;
   case 'undo':undo();break;
   case 'redo':redo();break;
   case 'export-json':exportJSON();break;
   case 'export-csv':exportCSV();break;
   case 'import-json':$('importFile').click();break;
   case 'reset-demo':await resetDemo();break;
   case 'restore-backup':await restoreBackup();break;
   case 'accept-recovery':await acceptRecovery();break;
   case 'load-external':await loadExternal();break;
   case 'close':if(el.dataset.dialog==='drawer')storeDrawerDraft();closeDialog(el.dataset.dialog);break;
   case 'delete-check':await deleteChecklist(id,Number(el.dataset.index),el.dataset.itemId);break;
   case 'delete-comment':await deleteComment(id,el.dataset.comment);break;
   case 'delete-dependency':await deleteDependencyInline(el.dataset.taskId,el.dataset.depId);break;
   case 'delete-log':await deleteLog(id,el.dataset.logId);break;
   case 'retry-child':await retryLoadChild(el.dataset.id,el.dataset.child);break;
   case 'timer-toggle':await toggleTimer(id);break;
   case 'timer-stop':await stopTimer();break;
   case 'bulk-delete':await deleteTasks([...state.selectedTasks]);break;
   case 'clear-selection':state.selectedTasks.clear();renderView();break;
   case 'page-prev':state.page=Math.max(1,state.page-1);renderView();break;
   case 'page-next':state.page++;renderView();break;
   case 'timeline-prev':state.timelineStart=addDays(state.timelineStart,-state.timelineDays);renderView();break;
   case 'timeline-next':state.timelineStart=addDays(state.timelineStart,state.timelineDays);renderView();break;
   case 'timeline-today':state.timelineStart=addDays(TODAY,-2);renderView();break;
   case 'calendar-prev':state.calendarMonth=addMonths(state.calendarMonth,-1);renderView();break;
   case 'calendar-next':state.calendarMonth=addMonths(state.calendarMonth,1);renderView();break;
   case 'calendar-today':state.calendarMonth=monthStart(TODAY);renderView();break;
   case 'workload-prev':state.workloadWeek=addDays(state.workloadWeek,-7);renderView();break;
   case 'workload-next':state.workloadWeek=addDays(state.workloadWeek,7);renderView();break;
   case 'workload-today':state.workloadWeek=weekStart(TODAY);renderView();break;
  }
 }catch(e){console.error(e);toast('Không thể hoàn tất thao tác: '+e.message,'error');}
});
document.addEventListener('change',event=>{
 const el=event.target,id=el.id;
 const filters={filterStatus:'status',filterPriority:'priority',filterOwner:'owner',filterDue:'due'};
 if(filters[id]){updateFilter(filters[id],el.value);return;}
 if(id==='filterFavorite'){updateFilter('favorite',el.checked);return;}
 if(id==='includeChildren'){state.includeChildren=el.checked;state.page=1;state.selectedTasks.clear();savePrefs();renderAll();return;}
 if(id==='sortBy'){state.sort=el.value;state.page=1;savePrefs();renderAll();return;}
 if(el.dataset.statusTask){const tid=el.dataset.statusTask;changeStatus(tid,el.value);if(!id)document.querySelector(`[data-status-task="${tid}"]`)?.focus({preventScroll:true});return;}
 if(el.dataset.ownerTask){
  const tid=el.dataset.ownerTask;
  const newOwner=el.value||null;
  if(window.__worktree_is_cloud_workspace){
   (async()=>{
    try{
     const updated=await window.TaskService.updateTask(tid,{primary_assignee_id:newOwner});
     if(updated){
      const idx=data.tasks.findIndex(x=>x.id===tid);
      if(idx!==-1)data.tasks[idx]=updated;
      rebuild();renderAll();
      if($('drawer').open&&drawerId===tid)renderDrawer();
      toast('Đã cập nhật người phụ trách','success',true);
     }
    }catch(e){
     toast(e.message||'Không thể cập nhật người phụ trách','error');
     if($('drawer').open&&drawerId===tid)renderDrawer();
     else renderView();
    }
   })();
   return;
  }
  commit('Đã cập nhật người phụ trách',d=>{const t=d.tasks.find(t=>t.id===tid);t.owner=el.value||null;touch(t);},{taskId:tid});
  return;
 }
 if(el.dataset.priorityTask){
  const tid=el.dataset.priorityTask;
  const newPriority=el.value;
  if(window.__worktree_is_cloud_workspace){
   (async()=>{
    try{
     const updated=await window.TaskService.updateTask(tid,{priority:newPriority});
     if(updated){
      const idx=data.tasks.findIndex(x=>x.id===tid);
      if(idx!==-1)data.tasks[idx]=updated;
      rebuild();renderAll();
      if($('drawer').open&&drawerId===tid)renderDrawer();
      toast('Đã cập nhật mức ưu tiên','success',true);
     }
    }catch(e){
     toast(e.message||'Không thể cập nhật mức ưu tiên','error');
     if($('drawer').open&&drawerId===tid)renderDrawer();
     else renderView();
    }
   })();
   return;
  }
  commit('Đã cập nhật mức ưu tiên',d=>{const t=d.tasks.find(t=>t.id===tid);t.priority=el.value;touch(t);},{taskId:tid});
  return;
 }
 if(el.dataset.checkTask){const tid=el.dataset.checkTask,index=Number(el.dataset.checkIndex);changeChecklist(tid,index,el.checked,el.dataset.itemId);document.querySelector(`[data-check-task="${tid}"][data-check-index="${index}"]`)?.focus({preventScroll:true});return;}
 if(el.dataset.selectTask){const tid=el.dataset.selectTask;el.checked?state.selectedTasks.add(tid):state.selectedTasks.delete(tid);renderView();document.querySelector(`[data-select-task="${tid}"]`)?.focus({preventScroll:true});return;}
 if(id==='selectPage'){const arr=filteredTasks().slice((state.page-1)*state.pageSize,state.page*state.pageSize);arr.forEach(t=>el.checked?state.selectedTasks.add(t.id):state.selectedTasks.delete(t.id));renderView();$('selectPage')?.focus({preventScroll:true});return;}
 if(id==='pageSize'){state.pageSize=Number(el.value);state.page=1;savePrefs();renderView();return;}
 if(id==='bulkStatus'&&el.value){bulkStatus(el.value);$('bulkStatus')?.focus();return;}
 if(id==='bulkOwner'&&el.value){bulkOwner(el.value);$('bulkOwner')?.focus();return;}
 if(id==='timelineDays'){state.timelineDays=Number(el.value);renderView();return;}
 if(id==='profileSelect'){return;state.currentUser=el.value?Number(el.value):null;savePrefs();renderAll(true);toast('Đã chọn hồ sơ cục bộ: '+person().name);return;}
 if(id==='drawerAutoProgress'){
  const tid=drawerId;
  if(window.__worktree_is_cloud_workspace){
   (async()=>{
    try{
     await window.TaskService.updateTask(tid,{auto_progress:el.checked});
     const t=byTask.get(tid);
     if(t){
      t.autoProgress=el.checked;
      if(window.ChecklistService) await window.ChecklistService.syncTaskRollup(tid);
     }
     renderDrawer();
     toast(el.checked?'Đã bật tự tính tiến độ checklist.':'Đã tắt tự tính tiến độ checklist.','success',true);
    }catch(err){
     toast(err.message||'Không thể cập nhật cấu hình tự tính tiến độ.','error');
     renderDrawer();
    }
   })();
   return;
  }
  commit(el.checked?'Bật tự tính tiến độ checklist':'Tắt tự tính tiến độ checklist',d=>{const t=d.tasks.find(t=>t.id===tid);t.autoProgress=el.checked;syncChecklist(t);touch(t);},{taskId:tid});
  return;
 }
 if(id==='tStatus'){
  if(el.value==='Hoàn thành')$('tProgress').value=100;
  else if(Number($('tProgress').value)===100)$('tProgress').value=editingTask?byTask.get(editingTask)?.resumeProgress??0:0;
 }
 if(id==='tAutoProgress'){
  const t=byTask.get(editingTask);$('tProgress').disabled=!!(el.checked&&t?.checklist.length);
  if($('tProgress').disabled)$('tProgress').value=Math.round(t.checklist.filter(c=>c[1]).length/t.checklist.length*100);
  $('progressHint').textContent=$('tProgress').disabled?'Được tính từ checklist.':'Chuyển Hoàn thành sẽ đặt 100%.';
 }
 if(id==='nType')$('capacityField').hidden=el.value!=='person';
});
let searchTimer,treeTimer;
$('taskSearch').addEventListener('input',e=>{
 const value=e.target.value;state.filters.q=value;state.page=1;state.selectedTasks.clear();clearTimeout(searchTimer);searchTimer=setTimeout(()=>{savePrefs();renderAll();$('liveStatus').textContent=filteredTasks().length+' công việc phù hợp';},140);
});
$('treeSearch').addEventListener('input',e=>{const value=e.target.value;clearTimeout(treeTimer);treeTimer=setTimeout(()=>{state.treeQuery=value;renderTree();},100);});
$('commandInput').addEventListener('input',renderCommand);
$('commandInput').addEventListener('keydown',e=>{
 if(e.key==='ArrowDown'){e.preventDefault();selectCommand(commandIndex+1);}else if(e.key==='ArrowUp'){e.preventDefault();selectCommand(commandIndex-1);}else if(e.key==='Enter'){e.preventDefault();executeCommand();}
});
$('taskForm').addEventListener('input',e=>{dirtyTask=true;$('taskFormError').hidden=true;if(e.target.id==='tProgress'&&Number(e.target.value)<100&&$('tStatus').value==='Hoàn thành')$('tStatus').value='Đang làm';});
$('taskForm').addEventListener('change',()=>{dirtyTask=true;});
$('nodeForm').addEventListener('input',()=>{dirtyNode=true;$('nodeFormError').hidden=true;});
$('nodeForm').addEventListener('change',()=>{dirtyNode=true;});
$('savedViewName').addEventListener('input',()=>{$('savedViewName').setCustomValidity('');});
$('taskForm').addEventListener('submit',saveTask);$('nodeForm').addEventListener('submit',saveNode);$('nameForm').addEventListener('submit',saveView);
document.addEventListener('submit',e=>{if(e.target.id==='checklistForm')addChecklist(e);if(e.target.id==='commentForm')addComment(e);if(e.target.id==='logForm')logHours(e);if(e.target.id==='dependencyForm')addDependencyForm(e);});
$('importFile').addEventListener('change',importJSON);
$('confirmOk').addEventListener('click',()=>resolveConfirm(true));$('confirmCancel').addEventListener('click',()=>resolveConfirm(false));
$$('dialog').forEach(dialog=>{
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(dialog.id==='confirmDialog')resolveConfirm(false);else{if(dialog.id==='drawer')storeDrawerDraft();closeDialog(dialog.id);}});
 dialog.addEventListener('click',e=>{
  if(e.target!==dialog)return;const rect=dialog.getBoundingClientRect();
  if(e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom)return;
  if(dialog.id==='confirmDialog')resolveConfirm(false);else{if(dialog.id==='drawer')storeDrawerDraft();closeDialog(dialog.id);}
 });
});
$('viewTabs').addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 const tabs=$$('#viewTabs .view-tab'),idx=tabs.indexOf(document.activeElement);if(idx<0)return;
 e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(idx+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 setView(tabs[next].dataset.view);tabs[next].focus();
});
function isEditing(el){return !!el?.closest('input,textarea,select,[contenteditable="true"]');}
document.addEventListener('keydown',e=>{
 if(!currentAccount())return;
 if(e.isComposing||e.altKey)return;const key=e.key.toLowerCase(),editing=isEditing(e.target),modal=!!document.querySelector('dialog[open]');
 if((e.ctrlKey||e.metaKey)&&key==='k'){
  e.preventDefault();if($('commandDialog').open)closeDialog('commandDialog',true);else openCommand();return;
 }
 if((e.ctrlKey||e.metaKey)&&key==='b'&&!editing&&!modal){e.preventDefault();toggleSidebar();return;}
 if((e.ctrlKey||e.metaKey)&&key==='enter'){
  if(e.target.id==='commentText'){e.preventDefault();$('commentForm').requestSubmit();}
  else if($('taskDialog').open&&!$('confirmDialog').open){e.preventDefault();$('taskForm').requestSubmit();}
  else if($('nodeDialog').open&&!$('confirmDialog').open){e.preventDefault();$('nodeForm').requestSubmit();}
  return;
 }
 if(key==='escape'&&state.mobileOpen&&!modal){e.preventDefault();closeSidebar(true);return;}
 if((e.ctrlKey||e.metaKey)&&key==='z'&&!editing&&!modal){e.preventDefault();e.shiftKey?redo():undo();return;}
 if(state.mobileOpen&&e.key==='Tab'&&!modal){
  const els=$$('button,input,select,[tabindex="0"]',$('sidebar')).filter(x=>!x.disabled&&x.offsetParent!==null);
  if(els.length){if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus();}}return;
 }
 if(editing||modal||e.ctrlKey||e.metaKey)return;
 if(key==='n'){e.preventDefault();openTaskForm();}
 else if(e.key==='/'){e.preventDefault();$('taskSearch').focus();}
 else if(e.key==='?'){e.preventDefault();openHelp();}
 else if(/^[1-7]$/.test(key)){e.preventDefault();setView(Object.keys(VIEWS)[Number(key)-1]);}
 else if(e.key==='Delete'&&state.view==='list'&&state.selectedTasks.size){e.preventDefault();deleteTasks([...state.selectedTasks]);}
});
let draggingId=null;
document.addEventListener('dragstart',e=>{
 const card=e.target.closest('[data-drag-task]');if(!card)return;
 const cardTaskId=card.dataset.dragTask;
 if(!canUpdateTask(byTask.get(cardTaskId))){e.preventDefault();return;}
 if(e.target.closest('select,input')){e.preventDefault();return;}
 draggingId=cardTaskId;e.dataTransfer.setData('text/plain',String(draggingId));e.dataTransfer.effectAllowed='move';card.classList.add('dragging');
});
document.addEventListener('dragover',e=>{
 const col=e.target.closest('[data-drop-status]');if(!col||!draggingId)return;e.preventDefault();e.dataTransfer.dropEffect='move';
 $$('.board-column.drag-over').forEach(c=>{if(c!==col)c.classList.remove('drag-over');});col.classList.add('drag-over');
});
document.addEventListener('drop',e=>{
 const col=e.target.closest('[data-drop-status]');if(!col||!draggingId)return;e.preventDefault();
 const id=e.dataTransfer.getData('text/plain'),status=col.dataset.dropStatus;draggingId=null;$$('.drag-over,.dragging').forEach(el=>el.classList.remove('drag-over','dragging'));
 if(byTask.has(id)&&STATUS.includes(status))changeStatus(id,status);
});
document.addEventListener('dragend',()=>{draggingId=null;$$('.drag-over,.dragging').forEach(el=>el.classList.remove('drag-over','dragging'));});
window.addEventListener('resize',()=>{if(innerWidth>900)state.mobileOpen=false;applySidebar();});
window.addEventListener('storage',event=>{
 if(event.key===KEYS.data&&event.newValue!==lastRaw){externalRaw=event.newValue??'';renderStorage();}
 if(event.key===null){externalRaw='';renderStorage();}
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(state.theme==='auto')applyTheme();});
window.addEventListener('beforeunload',e=>{
 if(dirtyTask||dirtyNode||storageIssue||storageProtected){e.preventDefault();e.returnValue='';}
});
function checkDate(){
 const now=dateISO();if(now!==TODAY){TODAY=now;renderAll();if($('drawer').open)refreshDrawer();}
}
window.addEventListener('focus',checkDate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDate();});
function boot(){
 loadData();loadPrefs();rebuild();hydrateIcons();
 if(typeof $('toastRegion').showPopover==='function')$('toastRegion').setAttribute('popover','manual');
 $('viewTabs').innerHTML=Object.entries(VIEWS).map(([key,[label,ico]])=>`<button class="view-tab" role="tab" id="tab-${key}" aria-selected="${key===state.view}" aria-controls="viewContent" tabindex="${key===state.view?0:-1}" data-action="view" data-view="${key}">${icon(ico)}${label}${key==='list'?'<span class="tab-count">0</span>':''}</button>`).join('');
 applyTheme();applySidebar();syncFilters(true);renderAll(true);
 if(!lastRaw&&!storageProtected)persistData();else renderStorage();
 if(migrationMessage)setTimeout(()=>toast(migrationMessage),300);
 let tick=0;setInterval(()=>{if(state.timer)$$('[data-timer-value]').forEach(el=>el.textContent=elapsedLabel());if(++tick%30===0)checkDate();},1000);
  window.WorkTree=Object.freeze({version:APP_VERSION,exportJSON,getSnapshot:()=>clone(data),validate:input=>validateData(input)});
}
window.clearTenantUI=function(orgName){
 if(typeof data!=='undefined'){
  data.tasks=[];
  data.nodes=[];
  data.activities=[];
  window.cloudEmployees=[];
  window.employeesById=new Map();
  window.__worktree_cloud_pins=[];
  window.__worktree_starred_task_ids=new Set();
  window.__worktree_saved_views=[];
  state.savedViews=[];
  state.selected=null;
  state.selectedTasks.clear();
  state.filters=blankFilters();
  state.timer=null;
  if($('savedViews')) $('savedViews').innerHTML='<div class="saved-empty">Lưu bộ lọc bạn thường dùng.</div>';
  if($('pinSection')) $('pinSection').innerHTML='';
  if(typeof savePrefs==='function'&&!window.__worktree_is_cloud_workspace)savePrefs();
  if(typeof renderTimer==='function')renderTimer();
  window.__taskDetailData={taskId:null,checklist:[],dependencies:[],comments:[],logs:[],loading:{},errors:{}};
  window.__taskDetailLoadGen=(window.__taskDetailLoadGen||0)+1;
  if(typeof closeDialog==='function'&&$('drawer')?.open)closeDialog('drawer',true);
  if(typeof rebuild==='function')rebuild();
  if(typeof renderPins==='function')renderPins();
  if(typeof decoratePinButtons==='function')decoratePinButtons();
  if(orgName){
   if($('workspaceName')) $('workspaceName').textContent=orgName;
   if($('topWorkspace')) $('topWorkspace').textContent=orgName;
  }
 }
};

window.setCloudWorkspaceData=function({nodes,employees,tasks,pins,starredTaskIds,savedViews,orgName}){
 window.__worktree_is_cloud_workspace=true;
 window.cloudEmployees=employees||[];
 window.employeesById=new Map((employees||[]).map(e=>[e.id,e]));

 // Personal Cloud Data: Pins, Stars, Saved Views
 window.__worktree_cloud_pins = (pins||[]).map(p => ({
  kind: p.task_id ? 'task' : 'node',
  id: p.task_id || p.node_id,
  urgent: p.is_urgent === true,
  createdAt: p.created_at || new Date().toISOString(),
  position: p.position || 0,
  rawPin: p
 }));
 window.__worktree_starred_task_ids = new Set(starredTaskIds || []);
 window.__worktree_saved_views = (savedViews || []).map(sv => ({
  id: sv.id,
  name: sv.name,
  selected: sv.selected_node_id,
  view: sv.view_type || 'overview',
  filters: sv.filters || blankFilters(),
  sort: sv.sort_by || 'priority',
  includeChildren: sv.include_children !== false,
  rawSavedView: sv
 }));
 state.savedViews = window.__worktree_saved_views;

 // Project task favorite status from personal stars
 const taskList = (tasks||[]).map(t => ({
  ...t,
  favorite: window.__worktree_starred_task_ids.has(t.id)
 }));

 data={
  nodes:nodes||[],
  tasks:taskList,
  activities:[]
 };

 const root=rootNode();
 if(root){
  state.selected=root.id;
  state.expanded=[root.id,...(nodes||[]).filter(n=>n.parent===root.id).map(n=>n.id)];
 }else{
  state.selected=null;
  state.expanded=[];
 }

 state.selectedTasks.clear();
 state.filters=blankFilters();
 state.page=1;

 rebuild();
 syncFilters(true);
 renderAll(true);

 if(typeof renderPins==='function') renderPins();
 if(typeof decoratePinButtons==='function') decoratePinButtons();

 if($('saveStatus')){
  $('saveStatus').textContent='Đồng bộ đám mây Supabase';
 }
 if($('saveDot')){
  $('saveDot').classList.remove('error');
 }
};
