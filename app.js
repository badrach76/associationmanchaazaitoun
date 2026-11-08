// إعداد الاتصال: أضف بيانات مشروع Supabase قبل النشر الفعلي.
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const supabaseReady = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");
const db = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let currentAdmin = null;
let currentMember = null;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const toast = (msg) => { const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),3200); };
const formData = (form) => Object.fromEntries(new FormData(form).entries());
const safe = (v="") => String(v).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateText = (v) => v ? new Date(v).toLocaleDateString("ar-MA") : "غير محدد";

$("#year").textContent = new Date().getFullYear();
$("#menuToggle").addEventListener("click",()=>$("#mainNav").classList.toggle("open"));
$$('#mainNav a').forEach(a=>a.addEventListener("click",()=>$("#mainNav").classList.remove("open")));

async function insertRecord(table, data) {
  if (!db) return {demo:true};
  const {error}=await db.from(table).insert(data);
  if(error) throw error;
  return {demo:false};
}
function setMessage(id,msg,error=false){const el=$(id);if(el){el.textContent=msg;el.style.color=error?"#b33d3d":"#28734d";}}

$("#joinForm").addEventListener("submit",async e=>{
  e.preventDefault(); const data=formData(e.currentTarget);
  try{
    const result=await insertRecord("membership_applications",{...data,status:"pending"});
    setMessage("#joinMessage",result.demo?"تم تسجيل الطلب في وضع المعاينة فقط. اربط قاعدة البيانات لتفعيل الاستقبال الفعلي.":"تم إرسال طلب الانخراط بنجاح. سيتم التواصل معكم بعد مراجعته.");
    e.currentTarget.reset();
  }catch(err){setMessage("#joinMessage","تعذر إرسال الطلب: "+err.message,true);}
});
$("#contactForm").addEventListener("submit",async e=>{
  e.preventDefault();const d=formData(e.currentTarget);
  try{const r=await insertRecord("contact_messages",d);setMessage("#contactMessage",r.demo?"نموذج المعاينة: اربط Supabase لتفعيل إرسال الرسائل.":"تم إرسال رسالتكم بنجاح، شكراً لتواصلكم.");e.currentTarget.reset();}
  catch(err){setMessage("#contactMessage","تعذر إرسال الرسالة: "+err.message,true);}
});

async function loadPublicContent(){
  if(!db)return;
  const [news,activities]=await Promise.all([
    db.from("posts").select("*").eq("type","news").eq("published",true).order("created_at",{ascending:false}).limit(6),
    db.from("posts").select("*").eq("type","activity").eq("published",true).order("created_at",{ascending:false}).limit(6)
  ]);
  if(!news.error)renderNews(news.data||[]);
  if(!activities.error)renderActivities(activities.data||[]);
}
function renderNews(items){
  $("#newsList").innerHTML=items.length?items.map(x=>`<article class="news-card"><div class="news-cover">❧</div><div class="news-body"><small>${dateText(x.created_at)}</small><h3>${safe(x.title)}</h3><p>${safe(x.summary||x.body||"").slice(0,170)}</p></div></article>`).join(""):'<div class="empty-state">لا توجد أخبار منشورة حالياً.</div>';
}
function renderActivities(items){
  $("#activitiesList").innerHTML=items.length?items.map(x=>`<article class="content-item"><div><h3>${safe(x.title)}</h3><p>${safe(x.summary||x.body||"")}</p></div><span class="date-pill">${dateText(x.event_date||x.created_at)}</span></article>`).join(""):'<div class="empty-state">سيتم نشر الأنشطة واللقاءات فور الإعلان عنها.</div>';
}
loadPublicContent();

async function login(form,role){
  const d=formData(form);
  if(!db){setMessage(role==="admin"?"#adminMessage":"#memberMessage","يلزم إعداد Supabase وتفعيل حساب المستخدم أولاً.",true);return;}
  const {data,error}=await db.auth.signInWithPassword({email:d.email,password:d.password});
  if(error){setMessage(role==="admin"?"#adminMessage":"#memberMessage",error.message,true);return;}
  if(role==="admin"){
    const {data:profile,error:pe}=await db.from("profiles").select("role,full_name").eq("id",data.user.id).single();
    if(pe||!["admin","super_admin"].includes(profile?.role)){await db.auth.signOut();setMessage("#adminMessage","هذا الحساب غير مخول لدخول الإدارة.",true);return;}
    currentAdmin=data.user;$("#adminLogin").classList.add("hidden");$("#adminDashboard").classList.remove("hidden");await showAdminTab("requests");
  }else{
    currentMember=data.user;$("#memberLogin").classList.add("hidden");$("#memberDashboard").classList.remove("hidden");
    const {data:profile}=await db.from("profiles").select("*").eq("id",data.user.id).single();
    $("#memberDashboard").innerHTML=`<h3>مرحباً ${safe(profile?.full_name||data.user.email)}</h3><p>البريد الإلكتروني: ${safe(data.user.email)}</p><p>حالة الحساب: <span class="status">مسجل</span></p><p>سيتم إضافة بطاقة العضوية والوثائق والإعلانات بعد استكمال بيانات الجمعية.</p><button id="memberLogout" class="btn btn-outline-dark">تسجيل الخروج</button>`;
    $("#memberLogout").onclick=async()=>{await db.auth.signOut();location.reload();};
  }
}
$("#adminLogin").addEventListener("submit",e=>{e.preventDefault();login(e.currentTarget,"admin");});
$("#memberLogin").addEventListener("submit",e=>{e.preventDefault();login(e.currentTarget,"member");});
$("#logoutAdmin").addEventListener("click",async()=>{if(db)await db.auth.signOut();location.reload();});

$$(".tab").forEach(b=>b.addEventListener("click",()=>{ $$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");showAdminTab(b.dataset.tab); }));
async function showAdminTab(tab){
  const panel=$("#adminPanel");panel.innerHTML='<div class="empty-state">جار تحميل البيانات...</div>';
  if(!db){panel.innerHTML='<div class="empty-state">اربط Supabase لتفعيل أدوات الإدارة.</div>';return;}
  if(tab==="requests"){
    const {data,error}=await db.from("membership_applications").select("*").order("created_at",{ascending:false});
    if(error){panel.textContent=error.message;return;}
    panel.innerHTML=data.length?`<table class="admin-table"><thead><tr><th>الاسم / المؤسسة</th><th>الهاتف</th><th>الصفة</th><th>الجماعة</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>${data.map(x=>`<tr><td>${safe(x.full_name)}</td><td>${safe(x.phone)}</td><td>${safe(x.profession)}</td><td>${safe(x.commune)}</td><td><span class="status">${safe(x.status)}</span></td><td><button class="small-btn" data-id="${x.id}" data-status="accepted">قبول</button><button class="small-btn danger" data-id="${x.id}" data-status="rejected">رفض</button></td></tr>`).join("")}</tbody></table>`:'<div class="empty-state">لا توجد طلبات انخراط.</div>';
    panel.querySelectorAll("[data-status]").forEach(b=>b.onclick=async()=>{const {error}=await db.from("membership_applications").update({status:b.dataset.status,reviewed_by:currentAdmin.id}).eq("id",b.dataset.id);if(error)toast(error.message);else{toast("تم تحديث حالة الطلب");showAdminTab("requests");}});
  }else if(tab==="posts"){
    panel.innerHTML=`<form id="postForm" class="admin-compose"><h3>إضافة خبر أو نشاط</h3><label>نوع المحتوى<select name="type"><option value="news">خبر</option><option value="activity">نشاط</option></select></label><label>العنوان<input name="title" required></label><label>ملخص<textarea name="summary" rows="2"></textarea></label><label>التفاصيل<textarea name="body" rows="5"></textarea></label><label>تاريخ النشاط (اختياري)<input type="date" name="event_date"></label><label><input type="checkbox" name="published" value="true" checked style="width:auto"> نشر مباشرة</label><button class="btn btn-primary">حفظ المحتوى</button></form>`;
    $("#postForm").onsubmit=async e=>{e.preventDefault();const d=formData(e.currentTarget);d.published=$("#postForm [name=published]").checked;d.created_by=currentAdmin.id;const {error}=await db.from("posts").insert(d);if(error)toast(error.message);else{toast("تم حفظ المحتوى");e.currentTarget.reset();loadPublicContent();}};
  }else if(tab==="messages"){
    const {data,error}=await db.from("contact_messages").select("*").order("created_at",{ascending:false}).limit(100);
    if(error){panel.textContent=error.message;return;}
    panel.innerHTML=data.length?`<table class="admin-table"><thead><tr><th>الاسم</th><th>التواصل</th><th>الموضوع</th><th>الرسالة</th><th>التاريخ</th></tr></thead><tbody>${data.map(x=>`<tr><td>${safe(x.name)}</td><td>${safe(x.contact)}</td><td>${safe(x.subject)}</td><td>${safe(x.message)}</td><td>${dateText(x.created_at)}</td></tr>`).join("")}</tbody></table>`:'<div class="empty-state">لا توجد رسائل.</div>';
  }
}
