import { forms, types, genres, directions, statuses, id, formHint, makeBlock, makeText, locate, duplicate, blank, merge, valid, collections } from './model.js?v=1.4.0';
import {genreGroups, proseSpeech, dialogueFieldVisible, guides, flowRoles} from './writing.js?v=1.4.0';

const key = 'htongrad:records:v1';
const build = '1.4.0';
const tabs = {overview:'Обзор',texts:'Тексты',calendar:'Календарь',notes:'Заметки'};
const main = document.querySelector('#main');
const nav = document.querySelector('#nav');
const create = document.querySelector('#create');
const createActions = {
  overview:['Создать запись','create-menu'],
  texts:['Создать текст','new-text'],
  calendar:['Создать событие','new-event'],
  notes:['Создать заметку','new-note']
};
const dialog = document.querySelector('#sheet');
const sheetTitle = document.querySelector('#sheet-title');
const sheetBody = document.querySelector('#sheet-body');
const toast = document.querySelector('#toast');
const google = window.htongradGoogle;
let data = blank();
let loadError = '';
let localVersion = null;
let originalDownloaded = false;
try {
  const raw = localStorage.getItem(key);
  localVersion = raw;
  if (raw !== null) {
    const stored = JSON.parse(raw);
    if (!valid(stored)) throw Error();
    data = stored;
  }
} catch { loadError = 'Не удалось открыть локальные записи. Обычное сохранение приостановлено.'; }

let direction = directions[0];
let project = '';
let preview = false;
let selectedDay = '';
function dateKeySafe(date) {return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
let filter = 'month';
let calendarDate = new Date();
let restore = null;
let syncOpen = false;
let toastTimer;
const folded = new Set();
const visitedTexts = new Set();
const drafts = new Map();
const format = new Intl.NumberFormat('ru',{maximumFractionDigits:4});
const dateFormat = new Intl.DateTimeFormat('ru',{day:'numeric',month:'long'});
const fullDate = new Intl.DateTimeFormat('ru',{weekday:'long',day:'numeric',month:'long'});
const weekday = new Intl.DateTimeFormat('ru',{weekday:'short'});
const html = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (label,action,attrs='',style='') => '<button type="button" class="'+style+'" data-action="'+action+'" '+attrs+'>'+label+'</button>';
const withId = (label,action,value,style='') => button(label,action,'data-id="'+html(value)+'"',style);
const options = (items, selected) => items.map(([v,name])=>'<option value="'+html(v)+'"'+(v===selected?' selected':'')+'>'+html(name)+'</option>').join('');
const projectOptions = selected => options([['','Без проекта'],...data.projects.map(p=>[p.id,p.title])],selected);
const textOptions = selected => options([['','Без привязки'],...data.texts.map(t=>[t.id,t.title])],selected);
const get = (group, value) => data[group].find(item=>item.id===value);
const dateKey = dateKeySafe;
const showDate = value => dateFormat.format(new Date(value+'T12:00:00'));
const route = () => {
  const [view, ...tail] = location.hash.slice(1).split('/');
  return [Object.hasOwn(tabs,view)?view:'overview',tail.join('/')];
};
const current = () => data.texts.find(t=>encodeURIComponent(t.id)===route()[1]);
const findBlock = value => current() && locate(current().blocks,value);
const encode = value => encodeURIComponent(value);
const copy = () => ({format:'htongrad-backup',version:1,exportedAt:new Date().toISOString(),data});
function notify(message) {
  clearTimeout(toastTimer);
  toast.hidden = false;
  toast.textContent = message;
  toastTimer = setTimeout(()=>{toast.hidden=true},4200);
}
function save(next, {recover = false} = {}) {
  if(loadError && !(recover && originalDownloaded)) {
    notify(loadError);
    return false;
  }
  try {
    if (localStorage.getItem(key)!==localVersion) {
      notify('Записи изменились в другой вкладке. Обновите страницу перед сохранением.');
      return false;
    }
    const serialized=JSON.stringify(next);
    localStorage.setItem(key,serialized);
    localVersion=serialized;
    data = next;
    loadError = '';
    try {google?.changed();} catch {}
    return true;
  } catch {
    notify('Изменение не сохранено. Проверьте доступное место в браузере.');
    return false;
  }
}
function change(mutator) {
  const next = structuredClone(data);
  mutator(next);
  return save(next);
}
function update(group, record) {
  return change(next=>{
    const index = next[group].findIndex(item=>item.id===record.id);
    if (index<0) next[group].push(record);
    else next[group][index] = record;
  });
}
function withDraft(text) {
  const draft = drafts.get(text.id);
  if(!draft) return text;
  const next = structuredClone(text);
  for(const {block, field, value} of draft.values()) {
    const entry = locate(next.blocks,block);
    if(entry) entry.block.values[field] = value;
  }
  return next;
}
function go(view, item='') {
  const hash = '#'+view+(item?'/'+encode(item):'');
  if (hash===location.hash) render();
  else location.hash=hash;
}
function sheet(title, content) {
  sheetTitle.textContent=title;
  sheetBody.innerHTML=content;
  if (!dialog.open) dialog.showModal();
}
function close() {
  syncOpen=false;
  if(dialog.open) dialog.close();
}
const makeHint = (label, detail) => '<details class="hint"><summary aria-label="'+html('Подсказка. '+label)+
  '"><span aria-hidden="true">?</span></summary><p class="hint-message">'+html(detail)+'</p></details>';
const line = (label, name, value='', type='text', extra='') =>
  '<label>'+html(label)+'<input type="'+type+'" name="'+name+'" value="'+html(value)+'" '+extra+'></label>';
const submit = label => '<button class="primary" type="submit">'+label+'</button><p role="alert"></p>';
const records = items => items.length ? '<div class="records">'+items.join('')+'</div>' : '<p class="empty muted">Здесь пока пусто.</p>';
const record = (title,detail,action,value) => withId('<strong>'+html(title)+'</strong>'+
  (detail?'<small>'+html(detail)+'</small>':''),action,value,'record');
const hero = (title, subtitle='', style='') => '<div class="hero '+style+'"><h1>'+html(title)+'</h1>'+
  (subtitle?'<p>'+html(subtitle)+'</p>':'')+'</div>';
const linkTo = t => '<a href="#texts/'+encode(t.id)+'">'+html(t.title)+'</a>';
const genreLabel = (genre, category) => category==='Сценарии'&&genre==='Историческая проза'?'Исторический':genre;
const characterCount = value => [...value.replace(/[ \t\n\f\r]+/gu,' ').trim()].length;
function countMarkup(markup) {
  const template=document.createElement('template');
  template.innerHTML=markup;
  return characterCount(template.content.textContent);
}
const volume = text => {
  const size=characterCount(text.title)+countMarkup(renderedBlocks(text.blocks,headings(text.blocks,{chapter:0,part:0})));
  return size.toLocaleString('ru')+' зн. · '+format.format(size/40000)+' авт. л.'+(text.goal?' из '+format.format(Number(text.goal)):'');
};

function overview() {
  let lastId;
  try {lastId=localStorage.getItem(key+':last');} catch {}
  const last = get('texts',lastId) ?? [...data.texts].sort((a,b)=>b.updated-a.updated)[0];
  const date=new Date();
  const start=dateKey(date);
  const tomorrow=new Date(date);
  tomorrow.setDate(tomorrow.getDate()+1);
  const next=new Date(date);
  next.setDate(next.getDate()+7);
  const events=sortedEvents().filter(e=>e.date>=start&&e.date<=dateKey(next));
  const notes = [...data.notes].sort((a,b)=>b.updated-a.updated).slice(0,3);
  const today=events.filter(e=>e.date===start);
  const later=events.filter(e=>e.date!==start);
  const sync=google?.overview()??'';
  const caption=fullDate.format(date);
  return hero('Обзор',caption[0].toUpperCase()+caption.slice(1))+
    '<div class="overview-modules"><section class="module"><h2>Продолжить работу</h2>'+
    (last?records([record(last.title,last.form+' · '+last.status,'open-text',last.id)]):'<p class="empty muted">Нет текстов</p>')+
    '</section><section class="module"><h2>Сегодня</h2>'+records(today.map(event=>agendaRow(event)))+
    '</section><section class="module"><div class="module-heading"><h2>Следующие 7 дней</h2>'+
    '<small>'+html(dateFormat.formatRange(tomorrow,next))+'</small></div>'+records(later.map(event=>agendaRow(event,true)))+
    '</section><section class="module"><h2>Последние заметки</h2>'+records(notes.map(noteRow))+
    '</section><section class="module" id="sync-module" '+(sync?'':'hidden')+'><h2>Google</h2>'+
    '<div id="sync-overview" aria-live="polite">'+sync+'</div></section></div>';
}
function texts() {
  const items = data.texts.filter(t=>forms[t.form][0]===direction&&(!project||project===t.projectId)).sort((a,b)=>b.updated-a.updated);
  return hero('Тексты','','page-title')+
    '<div class="controls tabs">'+directions.map(d=>withId(d,'direction',d).replace('data-id=', 'aria-pressed="'+(d===direction)+'" data-id=')).join('')+'</div>'+
    (data.projects.length?'<label class="project-filter">Проект<select id="project-filter">'+options([['','Все проекты'],...data.projects.map(p=>[p.id,p.title])],project)+'</select></label>':'')+
    records(items.map(t=>record(t.title,t.form+' · '+t.status+(t.projectId&&get('projects',t.projectId)?' · '+get('projects',t.projectId).title:''),'open-text',t.id)));
}
const noteRow = n => record(n.title,get('projects',n.projectId)?.title||n.body.slice(0,95),'edit-note',n.id);
function notes() {
  return hero('Заметки','','page-title')+
    records([...data.notes].sort((a,b)=>b.updated-a.updated).map(noteRow));
}
const sortedEvents = () => [...data.events].sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
const eventRow = e => record(e.title,showDate(e.date)+' · '+(e.allDay?'Весь день':e.start+'–'+e.end)+(get('texts',e.textId)?' · '+get('texts',e.textId).title:''),'edit-event',e.id);
function agendaRow(event, upcoming=false) {
  const date=new Date(event.date+'T12:00:00');
  const time=event.allDay?'Весь день':event.start;
  const label=upcoming?date.getDate()+' '+weekday.format(date):time;
  const detail=[upcoming?time:'',get('texts',event.textId)?.title].filter(Boolean).join(' · ');
  return withId('<span class="agenda-time">'+html(label)+'</span><span><strong>'+html(event.title)+'</strong>'+
    (detail?'<small>'+html(detail)+'</small>':'')+'</span>','edit-event',event.id,'record agenda-event');
}
function calendarRange() {
  const first = new Date(calendarDate);
  const end = new Date(calendarDate);
  if (filter==='month') { first.setDate(1); end.setDate(1); end.setMonth(end.getMonth()+1); }
  if (filter==='week') { first.setDate(first.getDate()-(first.getDay()+6)%7); end.setTime(first.getTime()); end.setDate(end.getDate()+7); }
  if (filter==='day') end.setDate(end.getDate()+1);
  return [dateKey(first),dateKey(end)];
}
function monthGrid() {
  const month = new Date(calendarDate.getFullYear(),calendarDate.getMonth(),1);
  const offset=(month.getDay()+6)%7;
  const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const marked=new Set(data.events.map(e=>e.date));
  const today=dateKey(new Date());
  return '<div class="days">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day=>'<span>'+day+'</span>').join('')+
    '<span aria-hidden="true"></span>'.repeat(offset)+Array.from({length:days},(_,i)=>{
      const value=dateKey(new Date(month.getFullYear(),month.getMonth(),i+1));
      const withEvents=marked.has(value);
      return button('<span class="day-number">'+(i+1)+(withEvents?'<i aria-hidden="true"></i>':'')+'</span>','calendar-day',
        'data-id="'+value+'" aria-pressed="'+(selectedDay===value)+'"'+(today===value?' aria-current="date"':'')+
        ' aria-label="'+html(showDate(value)+(withEvents?' — есть события':''))+'"');
    }).join('')+'</div>';
}
function calendar() {
  const [start,end]=calendarRange();
  const label=filter==='month'?new Intl.DateTimeFormat('ru',{month:'long',year:'numeric'}).format(calendarDate):
    filter==='day'?showDate(start):showDate(start)+' — '+dateFormat.format(new Date(new Date(end+'T12:00:00').setDate(new Date(end+'T12:00:00').getDate()-1)));
  return hero('Календарь','','page-title')+
    '<div class="controls tabs">'+Object.entries({day:'День',week:'Неделя',month:'Месяц'}).map(([v,label])=>button(label,'period','data-id="'+v+'" aria-pressed="'+(filter===v)+'"')).join('')+'</div>'+
    '<div class="module month"><div class="month-controls">'+button('‹','calendar-prev','aria-label="Предыдущий период"')+'<strong>'+html(label)+'</strong>'+button('›','calendar-next','aria-label="Следующий период"')+'</div>'+(filter==='month'?monthGrid()+(selectedDay?'<div class="row"><small>'+html(showDate(selectedDay))+'</small>'+button('Весь месяц','calendar-all')+'</div>':''):'')+'</div>'+
    records(sortedEvents().filter(e=>filter==='month'&&selectedDay>=start&&selectedDay<end?e.date===selectedDay:e.date>=start&&e.date<end).map(eventRow));
}
const lines = value => value.split(/\n/).map(s=>s.trim()).filter(Boolean);
const paragraphs = value => lines(value).map(s=>'<p>'+html(s)+'</p>').join('');
function link(value,label) {
  try {
    const url=new URL(value);
    if (['http:','https:'].includes(url.protocol)) return '<a href="'+html(url.href)+'" target="_blank" rel="noopener noreferrer">'+html(label||url.href)+'</a>';
  } catch {}
  return html(label);
}
function headings(blocks, state) {
  const numbers=new Map();
  const visit = list => list.forEach(b=>{
    if (b.type==='chapter') numbers.set(b.id,'Глава '+(++state.chapter));
    if (b.type==='part') numbers.set(b.id,'Часть '+(++state.part));
    visit(b.children);
  });
  visit(blocks);
  return numbers;
}
function renderedBlocks(blocks, numbers) {
  return blocks.map(b=>{
    const content=renderedBlocks(b.children,numbers);
    return renderedBlock(b,numbers,Boolean(content))+content;
  }).join('');
}
const sceneHeading = v => [v.placeType,v.location.trim(),v.time.trim()].filter(Boolean).join(' — ').toUpperCase();
function renderedBlock(b, numbers, hasContent) {
  const v=b.values;
  const text=v.body?paragraphs(v.body):'';
  const heading=(tag,value)=>value.trim()?'<'+tag+'>'+html(value.trim())+'</'+tag+'>':'';
  switch (b.type) {
    case 'break': return '<p class="divider" aria-label="Отбивка">* * *</p>';
    case 'chapter':
    case 'part': return hasContent||v.title.trim()?heading('h2',numbers.get(b.id)+(v.title.trim()?'. '+v.title.trim():'')):'';
    case 'scene':
    case 'dialogue': return '';
    case 'proseLine': return proseSpeech(v).map(value=>'<p>'+html(value)+'</p>').join('');
    case 'shot': return hasContent||v.location.trim()||v.time.trim()?heading('h3',sceneHeading(v)):'';
    case 'speech': return v.speaker||v.aside||text?'<div class="speech"><div class="speaker">'+html(v.speaker.toUpperCase())+'</div>'+(v.aside?'<div class="aside">('+html(v.aside.replace(/^\((.*)\)$/,'$1'))+')</div>':'')+text+'</div>':'';
    case 'transition': return text?'<div class="transition">'+paragraphs(v.body.toUpperCase())+'</div>':'';
    case 'section': return heading('h3',v.title);
    case 'subtitle': return heading('h3',v.title);
    case 'lead': return text?'<div class="lead">'+text+'</div>':'';
    case 'quote':
    case 'epigraph': return text?'<blockquote class="'+b.type+'">'+text+(v.reference?'<footer>'+html(v.reference)+'</footer>':'')+'</blockquote>':'';
    case 'work': return heading('h3',v.title)+([v.author,v.year].some(Boolean)?'<p>'+html([v.author,v.year].filter(Boolean).join(' · '))+'</p>':'')+(v.url?link(v.url,'Источник'):'');
    case 'item': return heading('h3',v.title)+text+(v.url?link(v.url,'Подробнее'):'');
    case 'source': return v.title||v.url?'<p>'+link(v.url,v.title)+'</p>':'';
    case 'qa': return v.question||v.answer?'<div class="interview">'+(v.question?'<strong>'+html(v.question)+'</strong>':'')+paragraphs(v.answer)+'</div>':'';
    case 'list': return text?'<ul>'+lines(v.body).map(p=>'<li>'+html(p)+'</li>').join('')+'</ul>':'';
    case 'conclusion': return text?'<section><h3>Итог</h3>'+text+'</section>':'';
    default: return text;
  }
}
function field(block, name, [label, detail, kind], compact) {
  const fieldId='field-'+block.id+'-'+name;
  const attrs='id="'+html(fieldId)+'" data-block="'+html(block.id)+'" data-field="'+name+'"';
  const value=block.values[name];
  const control=Array.isArray(kind)?'<select '+attrs+'>'+options(kind.map(v=>[v,v]),value)+'</select>':
    kind===true?'<textarea '+attrs+' rows="4">'+html(value)+'</textarea>':'<input '+attrs+' value="'+html(value)+'">';
  const prosePart=block.type==='proseLine'&&['attribution','continuation'].includes(name)?
    ' data-prose-part="'+name+'"'+(dialogueFieldVisible(block.values.mode,name)?'':' hidden'):'';
  const hint=!compact&&(name==='body'||name==='answer')?makeHint(label,detail):'';
  const caption='<label '+(compact?'class="sr-only" ':'')+'for="'+html(fieldId)+'">'+html(label)+'</label>';
  return '<div class="field"'+prosePart+'>'+(compact?caption:'<div class="field-head">'+caption+hint+'</div>')+control+'</div>';
}
function blockEditor(blocks, parent, numbers) {
  return blocks.map(b=>{
    const [label,,fields,children]=types[b.type];
    const name=numbers.get(b.id)?numbers.get(b.id)+(b.values.title?'. '+b.values.title:''):(b.values.title||label);
    const collapsed=folded.has(b.id);
    const entries=Object.entries(fields);
    const compact=entries.length===1&&entries[0][0]==='body';
    const content=collapsed?'':entries.map(([k,spec])=>field(b,k,spec,compact)).join('')+
      (b.type==='break'?'<div class="divider">* * *</div>':'')+
      (children?'<div class="nested">'+blockEditor(b.children,b.id,numbers)+button('+ Добавить блок','insert','data-parent="'+html(b.id)+'"','insert')+'</div>':'');
    const title='<strong>'+html(name)+(b.role?' <small>· '+html(b.role)+'</small>':'')+'</strong>';
    return '<section class="block" id="block-'+html(b.id)+'"><div class="block-head">'+
      button(title+(collapsed?'<span aria-hidden="true" class="chevron">›</span>':''),'fold',
        'id="toggle-'+html(b.id)+'" data-id="'+html(b.id)+'" aria-expanded="'+!collapsed+'" aria-controls="content-'+html(b.id)+'"','block-title')+
      (compact&&!collapsed?makeHint(fields.body[0],fields.body[1]):'')+
      button('⋯','block-menu','data-id="'+html(b.id)+'" data-parent="'+html(parent)+'" aria-label="Действия блока '+html(label)+'"','icon-button')+
      '</div><div class="block-content'+(compact?' compact-field':'')+'" id="content-'+html(b.id)+'" '+(collapsed?'hidden':'')+'>'+content+'</div></section>';
  }).join('');
}
function editor(t) {
  const [category]=forms[t.form];
  const design=category==='Сценарии'?'screenplay':category==='Проза'?'prose':'media';
  if(!visitedTexts.has(t.id)) {
    t.blocks.filter(block=>block.type==='chapter'||block.type==='part').slice(1).forEach(block=>folded.add(block.id));
    visitedTexts.add(t.id);
  }
  const numbers=headings(t.blocks,{chapter:0,part:0});
  const drafted=drafts.has(t.id);
  return '<div class="editor '+design+'"><div class="row editor-top">'+button('← Все тексты','texts')+
    button('⋯','text-menu','aria-label="Свойства и команды текста" aria-haspopup="dialog"','icon-button')+
    '</div><h1>'+html(t.title)+'</h1><p class="meta">'+html([t.form,...t.genres.map(genre=>genreLabel(genre,category)),t.status,t.pilot?'Пилот':'',t.minutes?'Цель '+t.minutes+' мин':''].filter(Boolean).join(' · '))+
    '</p><div class="segments editor-modes">'+button('Редактор','edit-mode','aria-pressed="'+!preview+'"')+
    button('Предпросмотр','preview-mode','aria-pressed="'+preview+'"')+'</div>'+
    (preview&&design==='screenplay'?'<div class="preview-tools">'+button('Страницы PDF','print','','action')+'</div>':'')+
    '<div class="row editor-footer" id="draft-status" '+(drafted?'':'hidden')+'><span class="meta">Черновик только в этой вкладке</span>'+
    button('Скопировать черновик','copy-draft')+'</div>'+
    (!preview?'<div class="row writing-tools">'+button('Оглавление','outline','','action')+
      button('Инструменты','writing-tools','aria-haspopup="dialog"','action')+'</div>':'')+
    (preview?'<article class="reading '+design+'">'+renderedBlocks(t.blocks,numbers)+'</article>':
      blockEditor(t.blocks,'',numbers)+button('+ Добавить блок','insert','','primary'))+
    '<div class="row editor-footer"><span class="meta" id="volume">'+volume(t)+'</span><span id="saved" class="meta" role="status">'+(drafted?'Не сохранено':'')+'</span></div></div>';
}
function render() {
  const [view]=route();
  nav.innerHTML=Object.entries(tabs).map(([name,label])=>'<a href="#'+name+'"'+(view===name?' aria-current="page"':'')+'>'+label+'</a>').join('');
  const t=view==='texts'?current():null;
  const [createLabel, action]=createActions[view];
  create.hidden=Boolean(t||loadError);
  create.dataset.action=action;
  create.setAttribute('aria-label',createLabel);
  main.innerHTML=(loadError?'<section class="group"><p role="alert">'+html(loadError)+'</p>'+originalExport()+'</section>':'')+
    (view==='texts'?(t?editor(withDraft(t)):texts()):view==='notes'?notes():view==='calendar'?calendar():overview());
}

function chooseText() {
  const category = direction;
  const choices=Object.entries(forms).filter(([,value])=>value[0]===category);
  sheet('Новый текст','<div class="controls">'+directions.map(d=>withId(d,'new-direction',d,d===category?'primary':'')).join('')+
    '</div>'+choices.map(([name])=>'<div class="row group">'+withId(html(name),'new-format',name)+makeHint(name,formHint(name))+'</div>').join(''));
}
function textForm(form,t) {
  const category=forms[form][0];
  const formTag={'Репортаж':'Репортаж','Объясняющая статья':'Объяснение'}[form];
  const groups=Object.entries(genreGroups[category])
    .filter(([group])=>group!=='Беседа'||form==='Интервью')
    .map(([group,choices])=>[group,choices.filter(choice=>choice!==formTag)]);
  const offered=new Set(groups.flatMap(([,choices])=>choices));
  const previous=t?.genres.filter(genre=>!offered.has(genre))??[];
  if(previous.length) groups.push(['Ранее выбранные',previous]);
  const details='<details '+(t?.genres.length?'open':'')+'><summary>'+ (category==='Публицистика'?'Жанры и редакционные форматы':'Жанры')+'</summary>'+
    groups.map(([group,choices])=>'<details '+(choices.some(name=>t?.genres.includes(name))?'open':'')+'><summary>'+html(group)+'</summary>'+
    choices.map(name=>'<div class="row"><label><input type="checkbox" name="genre" value="'+html(name)+'" '+(t?.genres.includes(name)?'checked':'')+'> '+html(genreLabel(name,category))+'</label>'+
    makeHint(genreLabel(name,category),genres[name])).join('')+'</details>').join('')+'</details>';
  sheet(t?'Свойства текста':form,'<form data-kind="'+(t?'edit-text':'create-text')+'" data-form="'+html(form)+'">'+
    line('Название','title',t?.title,'text','required')+'<label>Проект<select name="projectId">'+projectOptions(t?.projectId??project)+'</select></label>'+
    (t?'<label>Статус<select name="status">'+options(statuses.map(s=>[s,s]),t.status)+'</select></label>':'')+
    '<details '+(t?.goal||t?.minutes||t?.pilot||t?.genres.length?'open':'')+'><summary>Параметры текста</summary>'+
    '<div class="row"><label for="text-goal">Цель в авторских листах</label>'+makeHint('Цель','Укажи планируемый объём произведения. Поле можно оставить пустым.')+'</div><input id="text-goal" name="goal" type="number" min="0" step="0.001" value="'+html(t?.goal)+'">'+
    (category==='Сценарии'?line('Целевой хронометраж, мин','minutes',t?.minutes,'number','min="1"'):'')+
    (form==='Серия'?'<label><input type="checkbox" name="pilot" '+(t?.pilot?'checked':'')+'> Пилотная серия</label>':'')+
    details+'</details>'+
    submit(t?'Сохранить':'Создать')+'</form>'+(t?withId('Удалить текст','remove-text',t.id):''));
}
function noteForm(note) {
  sheet(note?'Заметка':'Новая заметка','<form data-kind="note" data-id="'+html(note?.id)+'">'+line('Название','title',note?.title,'text','required')+
    '<label>Текст<textarea name="body" rows="6">'+html(note?.body)+'</textarea></label>'+
    '<label>Проект<select name="projectId">'+projectOptions(note?.projectId??'')+'</select></label>'+submit('Сохранить')+'</form>'+
    (note?withId('Удалить заметку','remove-note',note.id):''));
}
function eventForm(event) {
  const linked=event&&get('texts',event.textId);
  const calendarDay=filter==='month'&&selectedDay?selectedDay:dateKey(calendarDate);
  const initialDay=route()[0]==='calendar'?calendarDay:dateKey(new Date());
  sheet(event?'Событие':'Новое событие','<form data-kind="event" data-id="'+html(event?.id)+'">'+
    line('Название','title',event?.title,'text','required')+line('Дата','date',event?.date??initialDay,'date','required')+
    '<label><input type="checkbox" name="allDay" '+(!event||event.allDay?'checked':'')+'> Весь день</label>'+
    '<div class="time-fields" '+(!event||event.allDay?'hidden':'')+'>'+line('Начало','start',event?.start??'12:00','time')+
    line('Окончание','end',event?.end??'13:00','time')+'</div><label>Текст<select name="textId">'+textOptions(event?.textId??'')+'</select></label>'+
    submit('Сохранить')+'</form>'+(linked?withId('Открыть связанный текст','open-text',linked.id):'')+
    (event?withId('Удалить событие','remove-event',event.id):''));
}
function projects() {
  sheet('Проекты','<form data-kind="project">'+line('Название нового проекта','title','','text','required')+submit('Добавить проект')+'</form>'+
    data.projects.map(p=>'<div class="row group"><span>'+html(p.title)+'</span>'+withId('Изменить','edit-project',p.id)+'</div>').join(''));
}
function editProject(p) {
  sheet('Изменить проект','<form data-kind="project" data-id="'+html(p.id)+'">'+line('Название','title',p.title,'text','required')+submit('Сохранить')+'</form>'+
    withId('Удалить проект','remove-project',p.id));
}
let insertion = {parent:'', after:''};
function insertMenu() {
  const parent=insertion.parent?findBlock(insertion.parent)?.block:null;
  const allowed=parent?types[parent.type][3]:forms[current().form][2];
  sheet('Добавить блок',allowed.map(type=>'<div class="row group">'+withId(types[type][0],'add-block',type)+makeHint(types[type][0],types[type][1])+'</div>').join(''));
}
function editBlocks(mutator,focusId) {
  const t=current();
  const next=structuredClone(withDraft(t));
  mutator(next.blocks);
  next.updated=Date.now();
  if(!update('texts',next)) return;
  drafts.delete(t.id);
  close(); render();
  if(focusId) document.getElementById('block-'+focusId)?.scrollIntoView({block:'nearest'});
}
function blockActions(value, parent) {
  const entry=findBlock(value);
  const {block,siblings}=entry;
  const index=siblings.indexOf(block);
  const [label,detail,fields]=types[block.type];
  const action=(label,key)=>withId(label,key,value);
  sheet(label,'<div class="menu-list">'+
    button('Вставить следом','insert','data-parent="'+html(parent)+'" data-after="'+html(value)+'"')+
    action('Дублировать','duplicate')+
    (index>0?action('Выше','block-up'):'')+
    (index<siblings.length-1?action('Ниже','block-down'):'')+
    action('Переместить…','block-move')+action('Роль в тексте','block-role')+action('Удалить','remove-block')+'</div>'+
    '<details class="block-help"><summary>Подсказки к блоку</summary><p>'+html(detail)+'</p>'+
    Object.values(fields).map(([name,hint])=>'<p><strong>'+html(name)+'</strong> '+html(hint)+'</p>').join('')+'</details>');
}
function blockDestinations(value) {
  const t=current();
  const entry=locate(t.blocks,value);
  const rows=[];
  const names=headings(t.blocks,{chapter:0,part:0});
  function visit(list,allowed,parent,label) {
    if (allowed?.includes(entry.block.type)) rows.push([parent,label,list.filter(b=>b.id!==value)]);
    list.filter(b=>b.id!==value).forEach(b=>visit(b.children,types[b.type][3],b.id,names.get(b.id)??(b.values.title||types[b.type][0])));
  }
  visit(t.blocks,forms[t.form][2],'','Верхний уровень');
  sheet('Переместить блок',rows.map(([parent,label,siblings])=>'<details><summary>'+html(label)+'</summary>'+
    [null,...siblings].map(b=>button(b?'После: '+html(names.get(b.id)??(b.values.title||types[b.type][0])):'В начало','move-here',
      'data-id="'+html(value)+'" data-parent="'+html(parent)+'" data-after="'+html(b?.id)+'"')).join('')+'</details>').join(''));
}
function writingGuide() {
  const t=current();
  const category=forms[t.form][0];
  const items=guides[t.form]??guides[category];
  sheet('Направляющие',items.map(([title,detail])=>'<section class="group"><h3>'+html(title)+'</h3><p>'+html(detail)+'</p></section>').join('')+
    button('Литературная справка','writing-library'));
}
function screenplayPlan() {
  const t=current();
  const plan=t.plan??{};
  sheet('План сценария','<form data-kind="screenplay-plan" data-id="'+html(t.id)+'">'+
    '<div><label for="plan-logline">Логлайн</label><textarea id="plan-logline" name="logline" rows="2" placeholder="Герой, цель и препятствие">'+html(plan.logline)+'</textarea></div>'+
    '<div><label for="plan-episodes">Поэпизодный план</label><textarea id="plan-episodes" name="episodes" rows="6" placeholder="Каждый эпизод с новой строки">'+html(plan.episodes)+'</textarea></div>'+
    submit('Сохранить')+'</form>');
}
function blockRole(value) {
  const t=current();
  const roles=flowRoles[forms[t.form][0]];
  sheet('Роль в тексте',['',...roles].map(role=>button(html(role||'Без пометки'),'set-role',
    'data-id="'+html(value)+'" data-role="'+html(role)+'"')).join(''));
}
function revealBlock(blocks, value) {
  for(const block of blocks) {
    if(block.id===value||revealBlock(block.children,value)) {
      folded.delete(block.id);
      return true;
    }
  }
  return false;
}
function blockAnalysis() {
  const t=withDraft(current());
  const names=headings(t.blocks,{chapter:0,part:0});
  const totals=new Map();
  function measure(blocks) {
    return blocks.map(b=>{
      const unit=types[b.type][0];
      const children=measure(b.children);
      const childVolume=children.reduce((sum,row)=>sum+row.volume,0);
      const own=countMarkup(renderedBlock(b,names,childVolume>0));
      totals.set(unit,(totals.get(unit)??0)+own);
      return {b,children,volume:own+childVolume,title:names.get(b.id)??(b.values.title?.trim()||unit)};
    });
  }
  const rows=measure(t.blocks);
  const total=rows.reduce((sum,row)=>sum+row.volume,0);
  if(forms[t.form][0]==='Сценарии') {
    sheet('Анализ сцен',(rows.length?'<p class="muted">Всего сцен — '+rows.length+' · '+total.toLocaleString('ru')+' зн.</p>':'<p>Добавь сцену.</p>')+
      rows.map(({b,children,volume},index)=>'<details class="scene-analysis"><summary>'+
        '<strong>'+html((index+1)+'. '+(b.values.location.trim()||b.values.time.trim()?sceneHeading(b.values):'Сцена'))+'</strong>'+
        '<small>'+html(b.role?b.role+' · ':'')+volume.toLocaleString('ru')+' зн.</small></summary>'+
        withId('К сцене','jump',b.id)+children.map(row=>'<div class="analysis-row">'+
          withId(html(row.title+(row.b.values.speaker?.trim()?' · '+row.b.values.speaker.trim():'')),'jump',row.b.id)+
          '<span>'+row.volume.toLocaleString('ru')+' зн.</span></div>').join('')+'</details>').join(''));
    return;
  }
  const max=rows.reduce((peak,row)=>Math.max(peak,row.volume),1);
  function analysisRows(list,depth=0) {
    return list.map(({b,children,volume,title})=>'<div class="analysis-row" style="padding-inline-start:'+Math.min(depth,3)*10+'px">'+
      withId(html(title+(b.role?' · '+b.role:'')),'jump',b.id)+'<span>'+volume.toLocaleString('ru')+' зн.</span>'+
      '<meter min="0" max="'+max+'" value="'+volume+'" aria-label="Объём блока"></meter></div>'+analysisRows(children,depth+1)).join('');
  }
  sheet('Анализ блоков','<p class="muted">Полосы показывают объём блока с вложенным текстом. Сводка считает текст каждого типа один раз.</p>'+
    (rows.length?'':'<p>Добавь блок, чтобы увидеть его в анализе.</p>')+'<div class="analysis-list">'+analysisRows(rows)+'</div>'+
    '<details><summary>Распределение по типам</summary>'+[...totals].filter(([,n])=>n>0).map(([label,n])=>'<p>'+html(label)+' · '+n.toLocaleString('ru')+' зн. · '+Math.round(n*100/total)+'%</p>').join('')+'</details>');
}
function writingLibrary() {
  sheet('Литературная справка','<details open><summary>Прямая речь</summary>'+
    '<p>Обычное продолжение выделяется запятыми и тире. Если реплику прерывает многоточие, оно сохраняется.</p>'+
    '<p>— Я… — сказала она, — пока не знаю.</p>'+
    '<p>'+link('https://orthographia.ru/punctum.php?paragraph=pg135.php','Академический справочник, § 135')+'</p></details>'+
    '<details><summary>Объём и требования редакций</summary>'+
    '<p>Авторский лист — 40 000 знаков с пробелами. Счётчик берёт заголовок и текст предпросмотра.</p>'+
    '<p>Гид «Ножа» приводит ориентиры для аналитической статьи (9–15 тыс. знаков) и интервью (12–35 тыс. знаков). Проверь требования выбранной редакции перед отправкой.</p>'+
    '<p>'+link('https://knife.media/knife-bible/','Гид для авторов «Ножа»')+'</p></details>'+
    '<details><summary>План сценария</summary><p>В логлайне назови героя, цель и препятствие. В плане выдели отдельную строку на каждый эпизод и отметь, что меняется к его финалу.</p></details>'+
    '<details><summary>Источники по прозе, сценарию и публицистике</summary><div class="records">'+[
    ['Грамота.ру — оформление диалога','https://gramota.ru/uchebnik/pravila/oformlenie-dilaoga'],
    ['Open University — персонаж и конфликт','https://www.open.edu/openlearn/mod/oucontent/view.php?id=101090&section=_unit5.1.1'],
    ['The Living Handbook of Narratology — время повествования','https://www-archiv.fdm.uni-hamburg.de/lhn/node/106.html'],
    ['BBC Writersroom — формат сценария','https://downloads.bbc.co.uk/writersroom/scripts/screenplay.pdf'],
    ['Purdue OWL — организация информационного текста','https://owl.purdue.edu/owl/subject_specific_writing/journalism_and_journalistic_writing/the_inverted_pyramid.html'],
    ['Журфак МГУ — жанры онлайн-медиа','https://vestnik.journ.msu.ru/books/2018/1/vostrebovannost-zhanrov-zhurnalistskikh-tekstov-v-onlaynovykh-smi-/']
  ].map(([label,url])=>'<p>'+link(url,label)+'</p>').join('')+'</div></details>');
}
function outline() {
  const t=current();
  const numbers=headings(t.blocks,{chapter:0,part:0});
  function walk(blocks,depth=0) {
    return blocks.map(b=>{
      const visible=['part','chapter','scene','shot','section','qa','item'].includes(b.type);
      const name=numbers.get(b.id)??(b.values.title||b.values.location||types[b.type][0]);
      return (visible?'<div class="row" style="padding-inline-start:'+depth*8+'px">'+withId(html(name),'jump',b.id)+withId('Переместить','block-move',b.id)+'</div>':'')+walk(b.children,depth+1);
    }).join('');
  }
  sheet('Оглавление',walk(t.blocks)||'<p class="muted">Структурные блоки появятся здесь.</p>');
}
function downloadJSON(content, name) {
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=name+'-'+dateKey(new Date())+'.json';
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function originalExport() {
  return localVersion===null?'':button('Скачать исходные данные','export-original');
}
function restoreSheet() {
  if(loadError) {
    sheet('Восстановление','<p>Записи в браузере не читаются. Восстановление заменит их данными из копии.</p>'+
      (localVersion===null?'<p>Браузер не даёт прочитать исходные данные. Проверьте доступ к хранилищу и обновите страницу.</p>':
        '<p>Скачайте исходные данные и убедитесь, что файл появился в загрузках.</p>'+originalExport()+
        button('Подтвердить восстановление','confirm-restore',originalDownloaded?'':'disabled','primary')));
    return;
  }
  const incoming=merge(data,restore);
  const size=collections.reduce((sum,k)=>sum+incoming[k].length-data[k].length,0);
  sheet('Восстановление','<p>Будет добавлено записей: '+size+'. Текущие версии совпадающих записей сохранятся.</p>'+
    button('Подтвердить восстановление','confirm-restore','','primary'));
}
function offerRestore(value) {
  if (value?.format!=='htongrad-backup'||value.version!==1||!valid(value.data)) throw Error('Файл не является копией панели «Хтонград».');
  restore=value.data;
  syncOpen=false;
  restoreSheet();
}
async function copyDraft() {
  const draft=drafts.get(current()?.id);
  if(!draft) return;
  const text=[...draft.values()].map(change=>change.value).join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    notify('Черновик скопирован.');
  } catch {
    sheet('Черновик','<label>Текст для копирования<textarea id="draft-copy" rows="6" readonly>'+html(text)+'</textarea></label>');
    sheetBody.querySelector('#draft-copy').select();
  }
}
function googleSheet() {
  syncOpen=true;
  google?.open();
  sheet('Синхронизация Google',google?.html()??'<p>Модуль синхронизации недоступен.</p>');
}
function googleRefresh() {
  const target=document.querySelector('#sync-overview');
  if(target) {
    const content=google.overview();
    if(target.innerHTML!==content) target.innerHTML=content;
    document.querySelector('#sync-module').hidden=!content;
  }
  if(syncOpen&&dialog.open) {
    const status=google.configurationStatus();
    const target=sheetBody.querySelector('[data-google-config-status]');
    if(target && status!==null) target.textContent=status;
    else sheetBody.innerHTML=google.html();
  }
}

document.addEventListener('submit',event=>{
  const form=event.target;
  if (form.matches('[data-google-config]')) {event.preventDefault();google.configure(form);return;}
  const {kind,id:value}=form.dataset;
  if (!kind) return;
  event.preventDefault();
  const values=new FormData(form);
  const field=name=>String(values.get(name)??'').trim();
  if(kind==='screenplay-plan') {
    const t=get('texts',value);
    const plan={logline:field('logline'),episodes:field('episodes')};
    if(t&&forms[t.form][0]==='Сценарии'&&update('texts',{...t,plan,updated:Date.now()})) {
      close();notify('План сохранён.');
    }
    return;
  }
  const title=field('title');
  if(!title) {form.querySelector('[role=alert]').textContent='Введите название.';return;}
  let saved=false;
  if(kind==='project') saved=update('projects',{id:value||id(),title});
  if(kind==='note') saved=update('notes',{id:value||id(),title,body:String(values.get('body')??''),projectId:field('projectId'),updated:Date.now()});
  if(kind==='event') {
    const allDay=values.has('allDay'), start=field('start'), end=field('end');
    if(!allDay&&(!start||!end||start>=end)) {form.querySelector('[role=alert]').textContent='Окончание должно быть позже начала.';return;}
    const old=get('events',value);
    saved=update('events',{id:value||id(),title,date:field('date'),start,end,allDay,textId:field('textId'),
      zone:old?.zone??Intl.DateTimeFormat().resolvedOptions().timeZone});
  }
  if(kind==='create-text'||kind==='edit-text') {
    const t=kind==='create-text'?makeText(form.dataset.form,title,field('projectId')):{...current()};
    Object.assign(t,{title,projectId:field('projectId'),genres:values.getAll('genre'),goal:field('goal'),minutes:field('minutes'),pilot:values.has('pilot'),updated:Date.now()});
    if(kind==='edit-text') t.status=field('status');
    if(update('texts',t)) {close(); openText(t.id);}
    return;
  }
  if(saved) {close();render();}
});
function openText(value) {
  const t=get('texts',value);
  if(!t) return;
  try {localStorage.setItem(key+':last',value);} catch {}
  preview=false;
  direction=forms[t.form][0];
  close();go('texts',value);
}
function remove(group,value) {
  if(!confirm(group==='projects'?'Удалить проект? Его тексты и заметки останутся в панели.':'Удалить эту запись?')) return;
  if(change(next=>{
    next[group]=next[group].filter(item=>item.id!==value);
    if(group==='projects') for(const item of [...next.texts,...next.notes]) {if(item.projectId===value) item.projectId='';}
    if(group==='texts') for(const e of next.events) {if(e.textId===value) e.textId='';}
  })) {
    if(group==='projects'&&project===value) project='';
    close();
    if(group==='texts') {drafts.delete(value);go('texts');} else render();
  }
}
document.addEventListener('input',event=>{
  const element=event.target;
  if(element.name==='allDay') element.form.querySelector('.time-fields').hidden=element.checked;
  if(!element.dataset.block) return;
  const t=current();
  const {block, field}=element.dataset;
  if(field==='mode') {
    for(const part of element.closest('.block').querySelectorAll('[data-prose-part]')) {
      part.hidden=!dialogueFieldVisible(element.value,part.dataset.prosePart);
    }
  }
  const draft=drafts.get(t.id)??new Map();
  draft.set(JSON.stringify([block,field]),{block,field,value:element.value});
  drafts.set(t.id,draft);
  const next=withDraft(t);
  next.updated=Date.now();
  const ok=update('texts',next);
  if(ok) drafts.delete(t.id);
  document.querySelector('#draft-status').hidden=ok;
  document.querySelector('#saved').textContent=ok?'Сохранено':'Не сохранено';
  document.querySelector('#volume').textContent=volume(next);
});
document.addEventListener('change',async event=>{
  if(event.target.id==='project-filter') {project=event.target.value;render();}
  if(event.target.id==='import-file'&&event.target.files[0]) {
    try {offerRestore(JSON.parse(await event.target.files[0].text()));}
    catch {notify('Не удалось прочитать копию «Хтонграда».');}
  }
});
document.addEventListener('click',event=>{
  const hint=event.target.closest('.hint');
  for(const opened of document.querySelectorAll('.hint[open]')) {
    if(opened!==hint) opened.open=false;
  }
  const buttonNode=event.target.closest('button');
  if(!buttonNode) return;
  const d=buttonNode.dataset;
  if(d.google) {google?.action(d.google);return;}
  const value=d.id;
  const action=d.action;
  if(action==='close') close();
  if(action==='menu') sheet('Настройки','<div class="menu-list">'+button('Синхронизация Google','google')+
    button('Копии данных','copies')+button('Проекты','projects')+'</div><p class="meta">Сборка '+build+'</p>');
  if(action==='create-menu') sheet('Создать запись','<div class="menu-list">'+button('Текст','new-text')+
    button('Событие','new-event')+button('Заметку','new-note')+'</div>');
  if(action==='google') googleSheet();
  if(action==='copies') sheet('Копии данных',(loadError?originalExport():button('Экспортировать JSON','export','','primary'))+
    '<label class="group">Восстановить из файла<input id="import-file" type="file" accept=".json,application/json"></label>');
  if(action==='export'&&!loadError) downloadJSON(JSON.stringify(copy(),null,2),'htongrad');
  if(action==='export-original'&&loadError&&localVersion!==null) {
    downloadJSON(localVersion,'htongrad-original');
    originalDownloaded=true;
    const confirmButton=sheetBody.querySelector('[data-action="confirm-restore"]');
    if(confirmButton) confirmButton.disabled=false;
  }
  if(action==='copy-draft') void copyDraft();
  if(action==='confirm-restore'&&restore) {
    const merged=merge(data,restore);
    if(save(merged,{recover:true})) {restore=null;close();render();notify('Записи восстановлены.');}
  }
  if(action==='direction') {direction=value;render();}
  if(action==='texts') go('texts');
  if(action==='new-text') {if(route()[0]!=='texts') direction='Проза'; chooseText();}
  if(action==='new-direction') {direction=value;chooseText();}
  if(action==='new-format') textForm(value);
  if(action==='open-text') openText(value);
  if(action==='text-menu') sheet('Текст','<div class="menu-list">'+button('Свойства','text-settings')+
    button('Литературная справка','writing-library')+'</div>');
  if(action==='text-settings') textForm(current().form,current());
  if(action==='projects') projects();
  if(action==='edit-project') editProject(get('projects',value));
  if(action==='new-note'||action==='edit-note') noteForm(get('notes',value));
  if(action==='new-event'||action==='edit-event') eventForm(get('events',value));
  if(action==='remove-project') remove('projects',value);
  if(action==='remove-text') remove('texts',value);
  if(action==='remove-note') remove('notes',value);
  if(action==='remove-event') remove('events',value);
  if(action==='calendar-day'||action==='calendar-all') {selectedDay=value??'';render();}
  if(action==='period') {filter=value;render();}
  if(action==='calendar-next'||action==='calendar-prev') {
    const delta=action==='calendar-next'?1:-1;
    if(filter==='month') {calendarDate.setDate(1);calendarDate.setMonth(calendarDate.getMonth()+delta);selectedDay='';}
    else calendarDate.setDate(calendarDate.getDate()+delta*(filter==='week'?7:1));
    render();
  }
  if(action==='edit-mode'||action==='preview-mode') {preview=action==='preview-mode';render();}
  if(action==='outline') outline();
  if(action==='writing-tools') {
    const screenplay=forms[current().form][0]==='Сценарии';
    sheet('Инструменты','<div class="menu-list">'+button('Направляющие','writing-guide')+
      button(screenplay?'Анализ сцен':'Анализ блоков','block-analysis')+
      (screenplay?button('План сценария','screenplay-plan'):'')+'</div>');
  }
  if(action==='writing-guide') writingGuide();
  if(action==='writing-library') writingLibrary();
  if(action==='screenplay-plan') screenplayPlan();
  if(action==='block-analysis') blockAnalysis();
  if(action==='block-role') blockRole(value);
  if(action==='set-role') editBlocks(blocks=>{locate(blocks,value).block.role=d.role;},value);
  if(action==='print') window.print();
  if(action==='jump') {
    revealBlock(current().blocks,value);
    preview=false;close();render();
    document.getElementById('block-'+value)?.scrollIntoView({block:'start'});
  }
  if(action==='insert') {insertion={parent:d.parent||'',after:d.after||''};insertMenu();}
  if(action==='add-block') {
    const block=makeBlock(value);
    editBlocks(blocks=>{
      const list=insertion.parent?locate(blocks,insertion.parent).block.children:blocks;
      list.splice(insertion.after?list.findIndex(b=>b.id===insertion.after)+1:list.length,0,block);
    },block.id);
  }
  if(action==='block-menu') blockActions(value,d.parent);
  if(action==='block-move') blockDestinations(value);
  if(action==='fold') {
    if(folded.has(value)) folded.delete(value); else folded.add(value);
    render();
    document.getElementById('toggle-'+value)?.focus({preventScroll:true});
  }
  if(['duplicate','remove-block','block-up','block-down','move-here'].includes(action)) {
    if(action==='remove-block'&&!confirm('Удалить блок и его содержимое?')) return;
    editBlocks(blocks=>{
      const {block,siblings}=locate(blocks,value);
      const i=siblings.indexOf(block);
      if(action==='duplicate') {siblings.splice(i+1,0,duplicate(block));return;}
      siblings.splice(i,1);
      if(action==='block-up') siblings.splice(i-1,0,block);
      if(action==='block-down') siblings.splice(i+1,0,block);
      if(action==='move-here') {
        const list=d.parent?locate(blocks,d.parent).block.children:blocks;
        list.splice(d.after?list.findIndex(b=>b.id===d.after)+1:0,0,block);
      }
    },value);
  }
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape') return;
  const hint=document.querySelector('.hint[open]');
  if(hint) {
    hint.open=false;
    hint.querySelector('summary').focus();
    event.preventDefault();
  }
});
dialog.addEventListener('close',()=>{syncOpen=false;});
window.addEventListener('hashchange',()=>{preview=false;close();render();window.scrollTo(0,0);});
window.addEventListener('beforeunload',event=>{
  if(!drafts.size) return;
  event.preventDefault();
  event.returnValue=true;
});
google?.init({
  hasLocalRecords:()=>localVersion!==null,
  records() {
    if(loadError) throw Error('Не удалось прочитать локальные записи. Синхронизация приостановлена.');
    if(localStorage.getItem(key)!==localVersion) throw Error('Записи изменились в другой вкладке. Обновите панель.');
    return data;
  },
  refresh:googleRefresh,
  offerRestore
});
render();
