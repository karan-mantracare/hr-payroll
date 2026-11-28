'use strict';
const $ = id => document.getElementById(id);
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money = v => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v);
const month = new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(new Date());
const people = [
 ['Aarav Sharma','Product Designer','Product','Employee','AS'],
 ['Meera Rao','Product Lead','Product','Manager','MR'],
 ['Nisha Kapoor','People Operations Lead','People','HR Admin','NK'],
 ['Kabir Shah','Software Engineer','Engineering','Staff','KS'],
 ['Anika Patel','Finance Analyst','Finance','Staff','AP'],
 ['Rohan Mehta','Customer Success Manager','Operations','Staff','RM']
];
const modules = {
 Overview:['⌂',''], Directory:['♙','Find colleagues and manage employee profiles.'],
 Attendance:['◷','Clock in, track hours, and request attendance corrections.'],
 Leave:['▦','Check your balances and request time off.'], Inbox:['▤','Review submitted requests and track decisions.'],
 Payroll:['₹','View your demo payslips and salary breakdown.'], Expenses:['◇','Submit and track reimbursement and travel requests.'],
 Timesheets:['◫','Record project hours and submit them for review.'], Helpdesk:['◉','Raise workplace requests and track replies.'],
 Assets:['▣','Review assigned equipment and request new assets.'], Performance:['◎','Set objectives, track progress, and request reviews.'],
 Learning:['▱','Explore courses and track your completion.'], Engagement:['◈','Read announcements and respond to team surveys.'],
 Settings:['⚙','Manage workspace policies and review activity.']
};
const workflows = {
 Attendance:{name:'Request correction',types:['Attendance correction','Remote work','Overtime','Shift change'],extra:'Date',format:'date'},
 Leave:{name:'Request leave',types:['Annual','Sick','Comp off','Encashment'],extra:'Start date',format:'date',end:'End date'},
 Expenses:{name:'New expense',types:['Reimbursement','Cash advance','Travel','Accommodation'],extra:'Amount (INR)',format:'number'},
 Timesheets:{name:'Log hours',types:['Project hours'],extra:'Hours',format:'number',end:'Work date'},
 Helpdesk:{name:'Raise ticket',types:['IT','People Operations','Facilities','Finance']},
 Assets:{name:'Request asset',types:['Laptop','Monitor','Headset','Other']},
 Performance:{name:'Request review',types:['Performance review','Probation feedback']}
};
const initial = {
 people, role:'Employee', clock:{}, policy:{Annual:18,Sick:8,'Comp off':2}, log:[], tickets:{}, assets:[{id:'asset-1',title:'Work laptop',owner:'Aarav Sharma',status:'Assigned'}],
 requests:[
  {id:'demo-1',module:'Leave',type:'Annual',title:'Annual leave',actor:'Aarav Sharma',status:'Pending',detail:'Personal time',value:today(),end:today(),days:1,date:today()},
  {id:'demo-2',module:'Expenses',type:'Reimbursement',title:'Client travel',actor:'Aarav Sharma',status:'Approved',detail:'Taxi fare for the client visit',value:1250,date:today()},
  {id:'demo-3',module:'Helpdesk',type:'IT',title:'VPN access',actor:'Aarav Sharma',status:'Open',detail:'Requesting VPN access for remote work.',date:today()}
 ],
 goals:[{id:'goal-1',title:'Improve onboarding conversion',owner:'Aarav Sharma',progress:65},{id:'goal-2',title:'Publish design system guidelines',owner:'Aarav Sharma',progress:40}],
 courses:{}, votes:{}, posts:[{title:'November town hall',detail:'Bring your questions and team updates to our next company-wide town hall.',date:today()}],
 payroll:[{id:'pay-1',employee:'Aarav Sharma',period:month,gross:95000,deductions:10500}]
};
const courses = [
 ['Security fundamentals','Identify phishing, use strong passwords, and report suspicious activity.','If a message asks for your password, what should you do?',['Reply with the password','Report the message and verify the request','Forward the request to everyone'],1],
 ['Giving useful feedback','Describe the situation, observable behaviour, and its impact.','Which feedback gives someone a concrete starting point?',['You should do better','In Monday’s review, the missing timeline made prioritisation harder','You always miss details'],1],
 ['Workplace accessibility','Use clear headings, meaningful links, and accessible documents.','Which link label is easier to understand?',['Click here','More','Download the onboarding checklist'],2]
];
const storageKey = 'peoplefold-workspace-v1';
let state;
try { state = JSON.parse(localStorage.getItem(storageKey)) || structuredClone(initial); } catch { state = structuredClone(initial); }
let page = 'Overview', filter = 'All', timer;
const actor = () => state.people.find(p=>p[3]===state.role)?.[0] ?? 'Aarav Sharma';
const admin = () => state.role === 'HR Admin';
const mayReview = r => r.actor !== actor() && (admin() || (state.role==='Manager' && state.people.some(p=>p[0]===r.actor && p[2]==='Product') && r.module!=='Helpdesk'));
const clock = () => state.clock[actor()] ?? [];
const scope = () => state.requests.filter(r=>r.actor===actor() || mayReview(r));
const btn = (label, action, value='', style='') => '<button type="button" class="btn '+style+'" data-action="'+escape(action)+'" data-value="'+escape(value)+'">'+escape(label)+'</button>';
const pill = status => '<span class="pill '+escape(status.toLowerCase())+'">'+escape(status)+'</span>';
const empty = msg => '<p class="empty">'+escape(msg)+'</p>';
const panel = (title, body, action='') => '<section class="panel"><div class="panel-head"><h2>'+escape(title)+'</h2>'+action+'</div>'+body+'</section>';
const heading = (title, sub, action='') => '<div class="heading"><div><h1>'+escape(title)+'</h1><p class="sub">'+escape(sub)+'</p></div>'+action+'</div>';
const table = (headers, rows) => rows.length ? '<div class="tablewrap"><table><thead><tr>'+headers.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>' : empty('No records to display.');
const row = (title, sub, action='') => '<div class="row"><div><strong>'+escape(title)+'</strong><small>'+escape(sub)+'</small></div>'+action+'</div>';
const save = (message, audit=true) => {
 if (audit) state.log.unshift({actor:actor(),message,time:new Date().toISOString()});
 localStorage.setItem(storageKey,JSON.stringify(state));
 render();
 $('toast').textContent=message;
 clearTimeout(timer);
 timer=setTimeout(()=>$('toast').textContent='',2700);
};
const remaining = type => state.policy[type] - state.requests.filter(r=>r.module==='Leave' && r.actor===actor() && r.type===type && ['Pending','Approved'].includes(r.status)).reduce((sum,r)=>sum+(r.days??0),0);
const openStatus = r => ['Pending','Open'].includes(r.status);
const readable = date => new Date(date).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});
function nav(next) {
 if (!modules[next] || (next==='Settings' && !admin())) return;
 page=next;filter='All';document.body.classList.remove('menu');
 if (location.hash.slice(1)!==encodeURIComponent(next)) history.pushState(null,'','#'+encodeURIComponent(next));
 render();window.scrollTo(0,0);
}
function requestTable(records) {
 return table(['Request','Submitted by','Date','Status',''],records.map(r=>'<tr><td><strong>'+escape(r.title)+'</strong><p class="muted">'+escape(r.module+' · '+r.type)+'</p></td><td>'+escape(r.actor)+'</td><td class="nowrap">'+escape(r.date)+'</td><td>'+pill(r.status)+'</td><td>'+btn('View','detail',r.id)+'</td></tr>'));
}
function requestsPanel(mode) {
 const records=scope().filter(r=>mode==='Inbox'||r.module===mode);
 const filters=['All','Needs review','My requests','Closed'];
 const visible=records.filter(r=>filter==='All'||(filter==='Needs review'&&mayReview(r)&&openStatus(r))||(filter==='My requests'&&r.actor===actor())||(filter==='Closed'&&!openStatus(r)));
 return panel(mode==='Inbox'?'Request queue':'Request history','<div class="toolbar">'+filters.map(f=>btn(f,'filter',f,filter===f?'primary':'')).join('')+'</div>'+requestTable(visible));
}
function overview() {
 const my=scope().filter(r=>r.actor===actor());
 const last=clock().at(-1);
 const stats=[['◷',last&&!last.out?'Clocked in':'Off the clock','Attendance','Attendance'],['▦',remaining('Annual')+' days','Annual leave available','Leave'],['▤',scope().filter(r=>openStatus(r)&&(mayReview(r)||r.actor===actor())).length,'Open requests','Inbox'],['◎',state.goals.filter(g=>g.owner===actor()&&g.progress<100).length,'Active goals','Performance']];
 return heading('Overview',new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()))+
 '<section class="hero"><div><div class="eyebrow">Your workspace</div><h2>Welcome, '+escape(actor().split(' ')[0])+'.</h2><p class="muted">Track your workday, manage requests, and stay up to date.</p></div><div class="actions">'+btn(last&&!last.out?'Clock out':'Clock in','clock','','primary')+btn('Request leave','new','Leave')+'</div></section>'+
 '<div class="grid stats">'+stats.map(([icon,value,label,target])=>'<article class="stat"><div class="stat-icon">'+icon+'</div><strong>'+escape(value)+'</strong><small>'+escape(label)+'</small><div style="margin-top:9px">'+btn('Open','nav',target)+'</div></article>').join('')+'</div>'+
 '<div class="grid duo">'+panel('Recent requests',requestTable((admin()?scope():my).slice(0,5)),btn('View inbox','nav','Inbox'))+
 '<div>'+panel('Quick actions',row('Submit an expense','Request reimbursement for work costs.',btn('Start','new','Expenses'))+row('Log project hours','Record time against a project.',btn('Start','new','Timesheets'))+row('Get support','Raise an IT or workplace ticket.',btn('Start','new','Helpdesk')))+panel('Announcements',state.posts.slice(0,2).map(p=>row(p.title,p.detail)).join(''),btn('View all','nav','Engagement'))+'</div></div>';
}
function view() {
 if(page==='Overview') return overview();
 let body='', action=workflows[page]?btn(workflows[page].name,'new',page,'primary'):'';
 if(page==='Directory'){
  action=admin()?btn('Add employee','employee','','primary'):'';
  body=panel('Employees',table(['Name','Title','Department','Workspace role',''],state.people.map((p,i)=>'<tr><td><div class="person"><span class="avatar">'+escape(p[4])+'</span><strong>'+escape(p[0])+'</strong></div></td><td>'+escape(p[1])+'</td><td>'+escape(p[2])+'</td><td>'+escape(p[3])+'</td><td>'+btn(admin()?'Edit':'View','employee',i)+'</td></tr>')));
 }
 if(page==='Attendance'){
  const sessions=clock();
  action=btn(sessions.at(-1)&&!sessions.at(-1).out?'Clock out':'Clock in','clock','','primary')+action;
  body=panel('Clock history',table(['Clock in','Clock out','Hours'],[...sessions].reverse().map(x=>'<tr><td>'+escape(readable(x.in))+'</td><td>'+escape(x.out?readable(x.out):'In progress')+'</td><td>'+escape(x.out?((Date.parse(x.out)-Date.parse(x.in))/3600000).toFixed(2):'—')+'</td></tr>')));
 }
 if(page==='Leave') body=panel('Available balance','<div class="grid cards">'+Object.keys(state.policy).map(key=>row(key,remaining(key)+' of '+state.policy[key]+' days available')).join('')+'</div>');
 if(page==='Inbox') body=requestsPanel(page);
 if(page==='Payroll'){
  action=admin()?btn('Create demo payslip','payNew','','primary'):'';
  body=panel('Payslips',table(['Employee','Period','Gross pay','Deductions','Take-home',''],state.payroll.filter(p=>admin()||p.employee===actor()).map(p=>'<tr><td>'+escape(p.employee)+'</td><td>'+escape(p.period)+'</td><td>'+money(p.gross)+'</td><td>'+money(p.deductions)+'</td><td>'+money(p.gross-p.deductions)+'</td><td>'+btn('View','pay',p.id)+'</td></tr>')));
 }
 if(page==='Assets'){
  if(admin()) action+=btn('Assign equipment','assetNew');
  body=panel('Assigned equipment',table(['Equipment','Assigned to','Status',''],state.assets.filter(x=>admin()||x.owner===actor()).map(x=>'<tr><td>'+escape(x.title)+'</td><td>'+escape(x.owner)+'</td><td>'+pill(x.status)+'</td><td>'+(x.status==='Assigned'&&x.owner===actor()?btn('Acknowledge','asset',x.id):'')+'</td></tr>')));
 }
 if(page==='Performance'){
  action+=btn('Add goal','goal');
  body='<div class="grid cards">'+state.goals.filter(g=>g.owner===actor()).map(g=>panel(g.title,'<div class="progress" role="progressbar" aria-label="Goal progress" aria-valuenow="'+g.progress+'"><i style="width:'+g.progress+'%"></i></div>'+row(g.progress+'% complete',g.owner,btn('Update','goal',g.id)))).join('')+'</div>';
 }
 if(page==='Learning') body='<div class="grid cards">'+courses.map((c,i)=>panel(c[0],'<p class="summary">'+escape(c[1])+'</p>'+row(state.courses[actor()]?.[i]?'Completed':'Available','',btn(state.courses[actor()]?.[i]?'Review':'Start','course',i)))).join('')+'</div>';
 if(page==='Engagement'){
  action=admin()?btn('New announcement','post','','primary'):'';
  body=panel('Announcements',state.posts.map(p=>row(p.title,p.date+' · '+p.detail)).join(''))+
   panel('Team survey',row('What would make your workweek better?',state.votes[actor()]?'Your response: '+state.votes[actor()]:'Choose one response.',btn(state.votes[actor()]?'Update response':'Respond','vote')));
 }
 if(page==='Settings') body=panel('Annual leave allowances',Object.entries(state.policy).map(([k,v])=>row(k,v+' days')).join(''),btn('Edit allowances','policy'))+panel('Activity log',state.log.length?state.log.slice(0,40).map(l=>row(l.message,l.actor+' · '+readable(l.time))).join(''):empty('No activity yet.'));
 if(workflows[page]) body+=requestsPanel(page);
 return heading(page,modules[page][1],action?'<div class="actions">'+action+'</div>':'')+body;
}
function render(){
 const pending=scope().filter(r=>mayReview(r)&&openStatus(r)).length;
 $('sidebar').innerHTML='<div class="brand"><span class="mark">◫</span>Keka - Peoplefold</div><div class="company"><span class="avatar">N</span><div><strong>Northstar Studio</strong><small>Employee workspace</small></div></div>'+
  Object.keys(modules).filter(n=>n!=='Settings'||admin()).map(n=>(n==='Overview'?'<div class="navlabel">WORKSPACE</div>':n==='Payroll'?'<div class="navlabel">OPERATIONS</div>':n==='Performance'?'<div class="navlabel">GROWTH</div>':'')+
  '<button class="navbtn '+(n===page?'active':'')+'" '+(n===page?'aria-current="page"':'')+' data-action="nav" data-value="'+n+'"><span aria-hidden="true" class="ni">'+modules[n][0]+'</span>'+n+(n==='Inbox'&&pending?'<span class="pill pending">'+pending+'</span>':'')+'</button>').join('')+
  '<div class="navbottom"><span class="avatar">'+escape(state.people.find(p=>p[0]===actor())?.[4])+'</span><div><strong>'+escape(actor())+'</strong><small>'+escape(state.role)+'</small></div></div>';
 $('breadcrumb').textContent=page;
 document.querySelector('.header-end .avatar').textContent=state.people.find(p=>p[0]===actor())?.[4]??'';
 $('role').value=state.role;
 $('main').innerHTML=view();
}
const field=(label,name,type='text',value='',attrs='')=>'<label>'+escape(label)+'<input name="'+name+'" type="'+type+'" value="'+escape(value)+'" required '+attrs+'></label>';
const select=(label,name,options,value)=>'<label>'+escape(label)+'<select name="'+name+'">'+options.map(x=>'<option '+(x===value?'selected':'')+'>'+escape(x)+'</option>').join('')+'</select></label>';
const notes=(label,value='',required=true)=>'<label>'+escape(label)+'<textarea name="detail" maxlength="1000" '+(required?'required':'')+'>'+escape(value)+'</textarea></label>';
const id=()=>crypto.randomUUID();
function dialog(title,body){
 $('dialog').innerHTML='<div class="panel-head"><h2>'+escape(title)+'</h2>'+btn('Close','close')+'</div>'+body;
 if(!$('dialog').open) $('dialog').showModal();
}
function form(title,fields,label,submit){
 dialog(title,'<form>'+fields+'<p class="error" role="alert"></p><div class="actions">'+btn('Cancel','close')+'<button class="btn primary">'+escape(label)+'</button></div></form>');
 $('dialog').querySelector('form').onsubmit=e=>{
  e.preventDefault();
  const values=Object.fromEntries([...new FormData(e.currentTarget)].map(([k,v])=>[k,v.trim()]));
  if([...e.currentTarget.querySelectorAll('[required]')].some(input=>!values[input.name])){
   e.currentTarget.querySelector('.error').textContent='Complete all required fields.';return;
  }
  const error=submit(values);
  if(error) e.currentTarget.querySelector('.error').textContent=error;
 };
}
function done(message){ $('dialog').close();save(message); }
function createRequest(module){
 const w=workflows[module];
 if(!w)return;
 const hours=module==='Timesheets';
 const extra=w.extra?field(w.extra,'value',w.format,w.format==='date'?today():'',w.format==='number'?(hours?'min="0.25" max="24" step="0.25"':'min="0.01" step="0.01"'):''):'';
 form(w.name,select('Type','type',w.types)+field(hours?'Project name':'Title','title','text','','maxlength="90"')+extra+(w.end?field(w.end,'end','date',today()):'')+notes(hours?'Work summary':'Details'),'Submit',v=>{
  let days;
  if(module==='Leave'){
   days=1+(Date.parse(v.end)-Date.parse(v.value))/86400000;
   if(days<1)return 'End date must be on or after the start date.';
   if(v.type!=='Encashment'&&days>remaining(v.type))return 'This request exceeds your available balance.';
  }
  if(hours){
   const used=state.requests.filter(r=>r.actor===actor()&&r.module===module&&r.end===v.end&&['Pending','Approved'].includes(r.status)).reduce((total,r)=>total+Number(r.value),0);
   if(Number(v.value)+used>24)return 'Total hours for this date cannot exceed 24.';
  }
  state.requests.unshift({...v,id:id(),module,actor:actor(),date:today(),days,status:module==='Helpdesk'?'Open':'Pending'});
  done(module==='Helpdesk'?'Ticket opened':'Request submitted');
  nav(module);
 });
}
function detail(r){
 if(!r || !(r.actor===actor()||mayReview(r)))return;
 const w=workflows[r.module];
 const description='<p class="sub">'+escape(r.module+' · '+r.type+' · '+r.actor)+'</p><p style="margin:10px 0">'+pill(r.status)+'</p><p class="summary">'+escape(r.detail)+'</p>'+
  (r.value?row(w.extra,r.module==='Expenses'?money(r.value):r.value):'')+(r.end?row(w.end,r.end):'')+
  (r.days?row('Requested days',r.days):'')+(r.decision?row('Decision note',r.decision):'');
 let actions='';
 if(openStatus(r)&&mayReview(r)) actions=r.module==='Helpdesk'?btn('Resolve','resolve',r.id,'primary'):btn('Approve','approve',r.id,'primary')+btn('Reject','reject',r.id,'danger');
 if(openStatus(r)&&r.actor===actor())actions+=btn('Withdraw','withdraw',r.id,'danger');
 const thread=r.module==='Helpdesk'?(state.tickets[r.id]??[]).map(t=>row(t.actor,t.message)).join('')+(openStatus(r)?btn('Add reply','reply',r.id):''):'';
 dialog(r.title,description+thread+'<div class="actions" style="margin-top:14px">'+actions+'</div>');
}
const handlers={
 nav, filter:v=>{filter=v;render();}, close:()=>$('dialog').close(), new:createRequest,
 clock:()=>{
  const records=state.clock[actor()]??=[];
  state.clock[actor()]=records;
  const last=records.at(-1);
  if(last&&!last.out){last.out=new Date().toISOString();save('Clocked out');}
  else{records.push({in:new Date().toISOString()});save('Clocked in');}
 },
 detail:v=>detail(scope().find(r=>r.id===v)),
 employee:v=>{
  const index=v===''?null:Number(v);
  const current=index===null?null:state.people[index];
  if(!admin()){if(current)dialog(current[0],row(current[1],current[2]+' · '+current[3]));return;}
  if(index!==null&&!current)return;
  form(current?'Edit employee':'Add employee',field('Name','name','text',current?.[0], 'maxlength="80"')+field('Job title','title','text',current?.[1],'maxlength="80"')+field('Department','department','text',current?.[2],'maxlength="60"'),'Save',v=>{
   if(state.people.some((p,i)=>i!==index&&p[0].toLowerCase()===v.name.toLowerCase()))return 'An employee already has this name.';
   const profile=[v.name,v.title,v.department,current?.[3]??'Staff',v.name.split(/\s+/).slice(0,2).map(p=>p[0].toUpperCase()).join('')];
   if(current){
    const previous=current[0];
    for(const r of state.requests)if(r.actor===previous)r.actor=v.name;
    for(const x of [...state.goals,...state.assets])if(x.owner===previous)x.owner=v.name;
    for(const p of state.payroll)if(p.employee===previous)p.employee=v.name;
    for(const key of ['clock','courses','votes'])if(v.name!==previous&&Object.hasOwn(state[key],previous)){Object.defineProperty(state[key],v.name,{value:state[key][previous],writable:true,enumerable:true,configurable:true});delete state[key][previous];}
    state.people[index]=profile;
   }else state.people.push(profile);
   done(current?'Employee updated':'Employee added');
  });
 },
 goal:v=>{
  const goal=state.goals.find(g=>g.id===v&&g.owner===actor());
  form(goal?'Update goal':'Add goal',field('Goal','title','text',goal?.title,'maxlength="90"')+field('Progress (%)','progress','number',goal?.progress??0,'min="0" max="100" step="1"'),'Save',v=>{
   if(goal){goal.title=v.title;goal.progress=Number(v.progress);}
   else state.goals.push({id:id(),title:v.title,progress:Number(v.progress),owner:actor()});
   done('Goal saved');
  });
 },
 course:v=>{
  const c=courses[Number(v)];if(!c)return;
  form(c[0],'<p class="summary">'+escape(c[1])+'</p>'+select(c[2],'answer',c[3]),'Check answer',a=>{
   if(a.answer!==c[3][c[4]])return 'Try again using the course guidance above.';
   (state.courses[actor()]??={})[v]=true;done('Course completed');
  });
 },
 post:()=>{if(admin())form('New announcement',field('Headline','title','text','','maxlength="90"')+notes('Message'),'Publish',v=>{state.posts.unshift({...v,date:today()});done('Announcement published');});},
 vote:()=>form('Team survey',select('What would make your workweek better?','vote',['More focus time','Clearer priorities','More team collaboration'],state.votes[actor()]),'Save response',v=>{state.votes[actor()]=v.vote;done('Survey response saved');}),
 policy:()=>{if(admin())form('Edit leave allowances',Object.entries(state.policy).map(([k,v],i)=>field(k,'allowance'+i,'number',v,'min="0" max="365" step="1"')).join(''),'Save',v=>{
  Object.keys(state.policy).forEach((k,i)=>state.policy[k]=Number(v['allowance'+i]));done('Leave allowances saved');
 });},
 payNew:()=>{if(admin())form('Create demo payslip',select('Employee','employee',state.people.map(p=>p[0]))+field('Period','period','text',month,'maxlength="50"')+field('Gross pay (INR)','gross','number','','min="0" step="1"')+field('Deductions (INR)','deductions','number',0,'min="0" step="1"'),'Create',v=>{
  const gross=Number(v.gross),deductions=Number(v.deductions);
  if(deductions>gross)return 'Deductions cannot exceed gross pay.';
  if(state.payroll.some(p=>p.employee===v.employee&&p.period.toLowerCase()===v.period.toLowerCase()))return 'A payslip already exists for this employee and period.';
  state.payroll.unshift({...v,id:id(),gross,deductions});done('Demo payslip created');
 });},
 pay:v=>{
  const p=state.payroll.find(x=>x.id===v&&(admin()||x.employee===actor()));
  if(p)dialog('Payslip · '+p.period,row('Employee',p.employee)+row('Gross pay',money(p.gross))+row('Deductions',money(p.deductions))+row('Take-home',money(p.gross-p.deductions)));
 },
 assetNew:()=>{if(admin())form('Assign equipment',field('Equipment','title','text','','maxlength="90"')+select('Employee','owner',state.people.map(p=>p[0])),'Assign',v=>{
  state.assets.unshift({...v,id:id(),status:'Assigned'});done('Equipment assigned');
 });},
 asset:v=>{
  const x=state.assets.find(x=>x.id===v&&x.owner===actor()&&x.status==='Assigned');
  if(x){x.status='Acknowledged';save('Equipment acknowledged');}
 },
 reply:v=>{
  const r=scope().find(r=>r.id===v&&r.module==='Helpdesk'&&openStatus(r));
  if(r)form('Reply to '+r.title,notes('Message'),'Send',a=>{
   (state.tickets[r.id]??=[]).push({actor:actor(),message:a.detail});done('Reply added');detail(r);
  });
 }
};
for(const [key,status] of Object.entries({approve:'Approved',reject:'Rejected',withdraw:'Withdrawn',resolve:'Resolved'})){
 handlers[key]=v=>{
  const r=scope().find(r=>r.id===v&&openStatus(r));if(!r)return;
  if(key==='withdraw'?r.actor!==actor():!mayReview(r))return;
  if(key!=='withdraw'&&(key==='resolve')!==(r.module==='Helpdesk'))return;
  form(status==='Withdrawn'?'Withdraw request':key==='resolve'?'Resolve ticket':key==='approve'?'Approve request':'Reject request',notes('Decision note','',key==='reject'||key==='resolve'),key[0].toUpperCase()+key.slice(1),a=>{
   r.status=status;r.decision=a.detail;done(r.title+' · '+status);
  });
 };
}
function search(){
 dialog('Search workspace','<label>Page name <input id="query" placeholder="Search pages"></label><div id="results"></div>');
 const q=$('query');
 const update=()=>{$('results').innerHTML=Object.keys(modules).filter(n=>(n!=='Settings'||admin())&&n.toLowerCase().includes(q.value.trim().toLowerCase())).map(n=>'<button type="button" class="btn search-result" data-action="nav" data-value="'+n+'">'+n+'</button>').join('')||empty('No matching pages.');};
 q.oninput=update;update();q.focus();
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-action]');if(!button)return;
 const {action,value=''}=button.dataset;
 if(action==='nav'&&$('dialog').open)$('dialog').close();
 handlers[action]?.(value);
});
$('role').addEventListener('change',e=>{
 state.role=e.target.value;
 localStorage.setItem(storageKey,JSON.stringify(state));
 if(page==='Settings'&&!admin())nav('Overview');else{filter='All';render();}
});
$('menu').onclick=()=>document.body.classList.toggle('menu');
$('search').onclick=search;
document.addEventListener('keydown',e=>{
 if(e.key==='/'&&!$('dialog').open&&!e.target.matches('input,textarea,select,[contenteditable]')){e.preventDefault();search();}
});
function navigateFromHash(){
 let requested;
 try{requested=decodeURIComponent(location.hash.slice(1));}catch{requested='Overview';}
 page=Object.hasOwn(modules,requested)&&(requested!=='Settings'||admin())?requested:'Overview';filter='All';render();
}
window.addEventListener('popstate',navigateFromHash);
navigateFromHash();
