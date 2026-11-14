import { forms, types, genres, directions, statuses, id, formHint, makeBlock, makeText, count, locate, duplicate, blank, merge, valid, collections } from './model.js';

const key = 'htongrad:records:v1';
const tabs = {overview:'Обзор',texts:'Тексты',notes:'Заметки',calendar:'Календарь'};
const main = document.querySelector('#main');
const nav = document.querySelector('#nav');
const dialog = document.querySelector('#sheet');
const sheetTitle = document.querySelector('#sheet-title');
const sheetBody = document.querySelector('#sheet-body');
const toast = document.querySelector('#toast');
const google = window.htongradGoogle;
let data = blank();
let loadError = '';
let localVersion = null;
try {
  const raw = localStorage.getItem(key);
  localVersion = raw;
  if (raw) {
    const stored = JSON.parse(raw);
    if (!valid(stored)) throw Error();
    data = stored;
  }
} catch { loadError = 'Не удалось открыть локальные записи. Можно восстановить данные из копии.'; }

let direction = directions[0];
let project = '';
let preview = false;
let filter = 'month';
let calendarDate = new Date();
let restore = null;
let syncOpen = false;
let toastTimer;
const folded = new Set();
const format = new Intl.NumberFormat('ru',{maximumFractionDigits:4});
const dateFormat = new Intl.DateTimeFormat('ru',{day:'numeric',month:'long'});
const html = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (label,action,attrs='',style='') => '<button type="button" class="'+style+'" data-action="'+action+'" '+attrs+'>'+label+'</button>';
const withId = (label,action,value,style='') => button(label,action,'data-id="'+html(value)+'"',style);
const options = (items, selected) => items.map(([v,name])=>'<option value="'+html(v)+'"'+(v===selected?' selected':'')+'>'+html(name)+'</option>').join('');
const projectOptions = selected => options([['','Без проекта'],...data.projects.map(p=>[p.id,p.title])],selected);
const textOptions = selected => options([['','Без привязки'],...data.texts.map(t=>[t.id,t.title])],selected);
const get = (group, value) => data[group].find(item=>item.id===value);
const dateKey = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
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
function save(next = data) {
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
const makeHint = (label, detail, parent='') => button('<span aria-hidden="true">?</span>','hint',
  'aria-label="'+html('Подсказка. '+label)+'" data-label="'+html(label)+'" data-detail="'+html(detail)+'" data-parent="'+html(parent)+'"','hint');
const line = (label, name, value='', type='text', extra='') =>
  '<label>'+html(label)+'<input type="'+type+'" name="'+name+'" value="'+html(value)+'" '+extra+'></label>';
const submit = label => '<button class="primary" type="submit">'+label+'</button><p role="alert"></p>';
const records = items => items.length ? '<div class="records">'+items.join('')+'</div>' : '<p class="muted">Здесь пока пусто.</p>';
const record = (title,detail,action,value) => withId('<strong>'+html(title)+'</strong><small>'+html(detail)+'</small>',action,value,'record');
const linkTo = t => '<a href="#texts/'+encode(t.id)+'">'+html(t.title)+'</a>';
const volume = text => {
  const size=[...text.title].length+count(text.blocks);
  return size.toLocaleString('ru')+' зн. · '+format.format(size/40000)+' авт. л.'+(text.goal?' из '+format.format(Number(text.goal)):'');
};

function overview() {
  let lastId;
  try {lastId=localStorage.getItem(key+':last');} catch {}
  const last = get('texts',lastId) ?? [...data.texts].sort((a,b)=>b.updated-a.updated)[0];
  const start = dateKey(new Date());
  const next = new Date(); next.setDate(next.getDate()+7);
  const events = sortedEvents().filter(e=>e.date>=start&&e.date<dateKey(next));
  const notes = [...data.notes].sort((a,b)=>b.updated-a.updated).slice(0,3);
  return '<h1>Обзор</h1><section class="group"><h2>Продолжить работу</h2>'+
    (last?records([record(last.title,last.form+' · '+last.status,'open-text',last.id)]):button('+ Создать текст','new-text','','primary'))+
    '</section><section class="group"><h2>Ближайшие сроки</h2>'+records(events.map(eventRow))+
    '</section><section class="group"><div class="row"><h2>Последние заметки</h2>'+button('+ Записать идею','new-note')+'</div>'+
    records(notes.map(noteRow))+'</section><section class="group" id="sync-overview">'+(google?.overview()??'')+'</section>';
}
function texts() {
  const items = data.texts.filter(t=>forms[t.form][0]===direction&&(!project||project===t.projectId)).sort((a,b)=>b.updated-a.updated);
  return '<div class="row"><h1>Тексты</h1>'+button('+ Новый текст','new-text','','primary')+'</div>'+
    '<div class="controls tabs">'+directions.map(d=>withId(d,'direction',d).replace('data-id=', 'aria-pressed="'+(d===direction)+'" data-id=')).join('')+'</div>'+
    '<div class="row"><label>Проект<select id="project-filter">'+options([['','Все проекты'],...data.projects.map(p=>[p.id,p.title])],project)+'</select></label>'+
    button('Управление проектами','projects')+'</div><section class="group">'+records(items.map(t=>record(t.title,t.form+' · '+t.status+(t.projectId&&get('projects',t.projectId)?' · '+get('projects',t.projectId).title:''),'open-text',t.id)))+'</section>';
}
const noteRow = n => record(n.title,get('projects',n.projectId)?.title||n.body.slice(0,95),'edit-note',n.id);
function notes() {
  return '<div class="row"><h1>Заметки</h1>'+button('+ Новая заметка','new-note','','primary')+'</div>'+
    records([...data.notes].sort((a,b)=>b.updated-a.updated).map(noteRow));
}
const sortedEvents = () => [...data.events].sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
const eventRow = e => record(e.title,showDate(e.date)+' · '+(e.allDay?'Весь день':e.start+'–'+e.end)+(get('texts',e.textId)?' · '+get('texts',e.textId).title:''),'edit-event',e.id);
function calendarRange() {
  const first = new Date(calendarDate);
  const end = new Date(calendarDate);
  if (filter==='month') { first.setDate(1); end.setDate(1); end.setMonth(end.getMonth()+1); }
  if (filter==='week') { first.setDate(first.getDate()-(first.getDay()+6)%7); end.setTime(first.getTime()); end.setDate(end.getDate()+7); }
  if (filter==='day') end.setDate(end.getDate()+1);
  return [dateKey(first),dateKey(end)];
}
function calendar() {
  const [start,end]=calendarRange();
  const label=filter==='month'?new Intl.DateTimeFormat('ru',{month:'long',year:'numeric'}).format(calendarDate):
    filter==='day'?showDate(start):showDate(start)+' — '+dateFormat.format(new Date(new Date(end+'T12:00:00').setDate(new Date(end+'T12:00:00').getDate()-1)));
  return '<div class="row"><h1>Календарь</h1>'+button('+ Событие','new-event','','primary')+'</div>'+
    '<div class="controls tabs">'+Object.entries({day:'День',week:'Неделя',month:'Месяц'}).map(([v,label])=>button(label,'period','data-id="'+v+'" aria-pressed="'+(filter===v)+'"')).join('')+'</div>'+
    '<div class="row">'+button('‹','calendar-prev','aria-label="Предыдущий период"')+'<strong>'+html(label)+'</strong>'+button('›','calendar-next','aria-label="Следующий период"')+'</div>'+
    records(sortedEvents().filter(e=>e.date>=start&&e.date<end).map(eventRow));
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
    const v = b.values;
    const content=renderedBlocks(b.children,numbers);
    const text=v.body?paragraphs(v.body):'';
    const heading=(tag,value)=>value?'<'+tag+'>'+html(value)+'</'+tag+'>':'';
    switch (b.type) {
      case 'break': return '<p class="divider" aria-label="Отбивка">* * *</p>';
      case 'chapter':
      case 'part': return content||v.title?heading('h2',numbers.get(b.id)+(v.title?'. '+v.title:''))+content:'';
      case 'scene': return content;
      case 'shot': return content||v.location||v.time?heading('h3',[v.placeType,v.location,v.time].filter(Boolean).join(' — ').toUpperCase())+content:'';
      case 'speech': return v.speaker||v.aside||text?'<div class="speech"><div class="speaker">'+html(v.speaker.toUpperCase())+'</div>'+(v.aside?'<div class="aside">('+html(v.aside.replace(/^\((.*)\)$/,'$1'))+')</div>':'')+text+'</div>':'';
      case 'transition': return text?'<div class="transition">'+paragraphs(v.body.toUpperCase())+'</div>':'';
      case 'section': return heading('h3',v.title)+content;
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
  }).join('');
}
function field(block, name, [label, detail, kind]) {
  const fieldId='field-'+block.id+'-'+name;
  const attrs='id="'+html(fieldId)+'" data-block="'+html(block.id)+'" data-field="'+name+'"';
  const value=block.values[name];
  const control=Array.isArray(kind)?'<select '+attrs+'>'+options(kind.map(v=>[v,v]),value)+'</select>':
    kind===true?'<textarea '+attrs+' rows="4">'+html(value)+'</textarea>':'<input '+attrs+' value="'+html(value)+'">';
  return '<div class="field"><div class="field-head"><label for="'+html(fieldId)+'">'+html(label)+'</label>'+makeHint(label,detail)+'</div>'+control+'</div>';
}
function blockEditor(blocks, parent, numbers) {
  return blocks.map((b,index)=>{
    const [label,detail,fields,children]=types[b.type];
    const name=numbers.get(b.id)?numbers.get(b.id)+(b.values.title?'. '+b.values.title:''):(b.values.title||label);
    const content=folded.has(b.id)?'':Object.entries(fields).map(([k,spec])=>field(b,k,spec)).join('')+
      (b.type==='break'?'<div class="divider">* * *</div>':'')+
      (children?'<div class="nested">'+blockEditor(b.children,b.id,numbers)+button('+ Добавить блок','insert','data-parent="'+html(b.id)+'"','insert')+'</div>':'');
    return '<section class="block" id="block-'+html(b.id)+'"><div class="block-head"><strong>'+html(name)+'</strong>'+makeHint(label,detail)+
      button('⋯','block-menu','data-id="'+html(b.id)+'" aria-label="Действия блока '+html(label)+'"')+'</div>'+content+'</section>'+
      (index<blocks.length-1?button('+ Вставить между блоками','insert','data-parent="'+html(parent)+'" data-after="'+html(b.id)+'"','insert'):'');
  }).join('');
}
function editor(t) {
  const [category]=forms[t.form];
  const design=category==='Сценарии'?'screenplay':category==='Проза'?'prose':'media';
  const numbers=headings(t.blocks,{chapter:0,part:0});
  return '<div class="editor '+design+'"><div class="row editor-top">'+button('← Все тексты','texts')+
    button('Оглавление','outline')+'</div><h1>'+html(t.title)+'</h1><div class="row"><p class="meta">'+html([t.form,...t.genres,t.status,t.pilot?'Пилот':'',t.minutes?t.minutes+' мин':''].filter(Boolean).join(' · '))+'</p>'+
    button('Свойства','text-settings')+'</div><div class="controls tabs">'+
    button('Редактор','edit-mode','aria-pressed="'+!preview+'"')+button('Предпросмотр','preview-mode','aria-pressed="'+preview+'"')+
    makeHint('Предпросмотр','Вёрстка собирается из заполненных полей и блоков.')+
    (preview&&design==='screenplay'?button('Страницы PDF','print'):'')+'</div>'+
    (preview?'<article class="reading '+design+'">'+renderedBlocks(t.blocks,numbers)+'</article>':
      blockEditor(t.blocks,'',numbers)+button('+ Добавить блок','insert','','primary'))+
    '<div class="row editor-footer"><span class="meta" id="volume">'+volume(t)+'</span><span id="saved" class="meta" role="status"></span>'+
    makeHint('Объём','Один авторский лист равен 40 000 знаков с пробелами. Цель можно задать в свойствах.')+'</div></div>';
}
function render() {
  const [view]=route();
  nav.innerHTML=Object.entries(tabs).map(([name,label])=>'<a href="#'+name+'"'+(view===name?' aria-current="page"':'')+'>'+label+'</a>').join('');
  const t=current();
  main.innerHTML=(loadError?'<p role="alert">'+html(loadError)+'</p>':'')+
    (view==='texts'?(t?editor(t):texts()):view==='notes'?notes():view==='calendar'?calendar():overview());
}

function chooseText() {
  const category = direction;
  const choices=Object.entries(forms).filter(([,value])=>value[0]===category);
  sheet('Новый текст','<div class="controls">'+directions.map(d=>withId(d,'new-direction',d,d===category?'primary':'')).join('')+
    '</div>'+choices.map(([name])=>'<div class="row group">'+withId(html(name),'new-format',name)+makeHint(name,formHint(name),'choose-text')+'</div>').join(''));
}
function textForm(form,t) {
  const category=forms[form][0];
  const common=['Детектив','Триллер','Фантастика','Фэнтези','Мистика','Хоррор'];
  const choices=category==='Проза'?['Современная проза','Историческая проза',...common,'Любовная проза']:
    category==='Сценарии'?['Драма','Комедия','Мелодрама',...common.filter(g=>g!=='Мистика')]:[];
  const details=choices.length?'<details '+(t?.genres.length?'open':'')+'><summary>Жанры</summary>'+choices.map(name=>
    '<div class="row"><label><input type="checkbox" name="genre" value="'+html(name)+'" '+(t?.genres.includes(name)?'checked':'')+'> '+html(name)+'</label>'+
    makeHint(name,genres[name])).join('')+'</details>':'';
  sheet(t?'Свойства текста':form,'<form data-kind="'+(t?'edit-text':'create-text')+'" data-form="'+html(form)+'">'+
    line('Название','title',t?.title,'text','required')+'<label>Проект<select name="projectId">'+projectOptions(t?.projectId??project)+'</select></label>'+
    '<div class="row"><span class="muted">Ориентир: '+html(forms[form][1])+'</span>'+makeHint(form,formHint(form))+'</div>'+
    '<div class="row"><label for="text-goal">Цель в авторских листах</label>'+makeHint('Цель','Укажи планируемый объём произведения. Поле можно оставить пустым.')+'</div><input id="text-goal" name="goal" type="number" min="0" step="0.001" value="'+html(t?.goal)+'">'+
    (category==='Сценарии'?line('Целевой хронометраж, мин','minutes',t?.minutes,'number','min="1"'):'')+
    (form==='Серия'?'<label><input type="checkbox" name="pilot" '+(t?.pilot?'checked':'')+'> Пилотная серия</label>':'')+
    (t?'<label>Статус<select name="status">'+options(statuses.map(s=>[s,s]),t.status)+'</select></label>':'')+details+
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
  sheet(event?'Событие':'Новое событие','<form data-kind="event" data-id="'+html(event?.id)+'">'+
    line('Название','title',event?.title,'text','required')+line('Дата','date',event?.date??dateKey(calendarDate),'date','required')+
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
let retainedForm;
function insertMenu() {
  const parent=insertion.parent?findBlock(insertion.parent)?.block:null;
  const allowed=parent?types[parent.type][3]:forms[current().form][3];
  sheet('Добавить блок',allowed.map(type=>'<div class="row group">'+withId(types[type][0],'add-block',type)+makeHint(types[type][0],types[type][1],'insert-again')+'</div>').join(''));
}
function editBlocks(mutator,focusId) {
  const t=current();
  const next=structuredClone(t);
  mutator(next.blocks);
  next.updated=Date.now();
  if(!update('texts',next)) return;
  close(); render();
  if(focusId) document.getElementById('block-'+focusId)?.scrollIntoView({block:'nearest'});
}
function blockActions(value) {
  const entry=findBlock(value);
  const {block,siblings}=entry;
  const index=siblings.indexOf(block);
  const action=(label,key,detail)=>'<div class="row">'+withId(label,key,value)+makeHint(label,detail,'block-menu:'+value)+'</div>';
  sheet(types[block.type][0],
    action(folded.has(value)?'Развернуть':'Свернуть','fold','Показывает или скрывает содержимое блока.')+
    action('Дублировать','duplicate','Создаёт отдельную копию блока и его содержимого.')+
    (index>0?action('Выше','block-up','Перемещает блок выше вместе с содержимым.'):'')+
    (index<siblings.length-1?action('Ниже','block-down','Перемещает блок ниже вместе с содержимым.'):'')+
    action('Переместить…','block-move','Позволяет выбрать положение и допустимый раздел.')+
    action('Удалить','remove-block','Удаляет блок вместе с вложенным текстом.'));
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
  visit(t.blocks,forms[t.form][3],'','Верхний уровень');
  sheet('Переместить блок',rows.map(([parent,label,siblings])=>'<details><summary>'+html(label)+'</summary>'+
    [null,...siblings].map(b=>button(b?'После: '+html(names.get(b.id)??(b.values.title||types[b.type][0])):'В начало','move-here',
      'data-id="'+html(value)+'" data-parent="'+html(parent)+'" data-after="'+html(b?.id)+'"')).join('')+'</details>').join(''));
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
function exportCopy() {
  const url=URL.createObjectURL(new Blob([JSON.stringify(copy(),null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download='htongrad-'+dateKey(new Date())+'.json';
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function offerRestore(value,fromGoogle=false) {
  if (value?.format!=='htongrad-backup'||value.version!==1||!valid(value.data)) throw Error('Файл не является копией панели «Хтонград».');
  restore={value:value.data,fromGoogle};
  const incoming=merge(data,value.data);
  const size=collections.reduce((sum,k)=>sum+incoming[k].length-data[k].length,0);
  syncOpen=false;
  sheet('Восстановление','<p>Будет добавлено записей: '+size+'. Текущие версии совпадающих записей сохранятся.</p>'+
    button('Подтвердить восстановление','confirm-restore','','primary'));
}
function googleSheet() {
  syncOpen=true;
  google?.open();
  sheet('Синхронизация Google',google?.html()??'<p>Модуль синхронизации недоступен.</p>');
}
function googleRefresh() {
  const target=document.querySelector('#sync-overview');
  if(target) target.innerHTML=google.overview();
  if(syncOpen&&dialog.open) sheetBody.innerHTML=google.html();
}

document.addEventListener('submit',event=>{
  const form=event.target;
  if (form.matches('[data-google-config]')) {event.preventDefault();google.configure(form);return;}
  const {kind,id:value}=form.dataset;
  if (!kind) return;
  event.preventDefault();
  const values=new FormData(form);
  const field=name=>String(values.get(name)??'').trim();
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
    if(group==='texts') go('texts');else render();
  }
}
document.addEventListener('input',event=>{
  const element=event.target;
  if(element.name==='allDay') element.form.querySelector('.time-fields').hidden=element.checked;
  if(!element.dataset.block) return;
  const t=current();
  const next=structuredClone(t);
  locate(next.blocks,element.dataset.block).block.values[element.dataset.field]=element.value;
  next.updated=Date.now();
  const ok=update('texts',next);
  document.querySelector('#saved').textContent=ok?'Сохранено':'Не сохранено';
  if(ok) document.querySelector('#volume').textContent=volume(next);
});
document.addEventListener('change',async event=>{
  if(event.target.id==='project-filter') {project=event.target.value;render();}
  if(event.target.id==='import-file'&&event.target.files[0]) {
    try {offerRestore(JSON.parse(await event.target.files[0].text()));}
    catch {notify('Не удалось прочитать копию «Хтонграда».');}
  }
});
document.addEventListener('click',event=>{
  const buttonNode=event.target.closest('button');
  if(!buttonNode) return;
  const d=buttonNode.dataset;
  if(d.google) {google?.action(d.google);return;}
  const value=d.id;
  const action=d.action;
  if(action==='close') close();
  if(action==='menu') sheet('Настройки',button('Синхронизация Google','google')+button('Копии данных','copies'));
  if(action==='google') googleSheet();
  if(action==='copies') sheet('Копии данных',button('Экспортировать JSON','export','','primary')+
    '<label class="group">Восстановить из файла<input id="import-file" type="file" accept=".json,application/json"></label>');
  if(action==='export') exportCopy();
  if(action==='confirm-restore'&&restore) {
    const merged=merge(data,restore.value);
    if(save(merged)) {if(restore.fromGoogle) google?.restored();restore=null;close();render();notify('Записи восстановлены.');}
  }
  if(action==='direction') {direction=value;render();}
  if(action==='texts') go('texts');
  if(action==='new-text') {if(route()[0]!=='texts') direction='Проза'; chooseText();}
  if(action==='new-direction') {direction=value;chooseText();}
  if(action==='new-format') textForm(value);
  if(action==='open-text') openText(value);
  if(action==='text-settings') textForm(current().form,current());
  if(action==='projects') projects();
  if(action==='edit-project') editProject(get('projects',value));
  if(action==='new-note'||action==='edit-note') noteForm(get('notes',value));
  if(action==='new-event'||action==='edit-event') eventForm(get('events',value));
  if(action==='remove-project') remove('projects',value);
  if(action==='remove-text') remove('texts',value);
  if(action==='remove-note') remove('notes',value);
  if(action==='remove-event') remove('events',value);
  if(action==='period') {filter=value;render();}
  if(action==='calendar-next'||action==='calendar-prev') {
    const delta=action==='calendar-next'?1:-1;
    if(filter==='month') {calendarDate.setDate(1);calendarDate.setMonth(calendarDate.getMonth()+delta);}
    else calendarDate.setDate(calendarDate.getDate()+delta*(filter==='week'?7:1));
    render();
  }
  if(action==='edit-mode'||action==='preview-mode') {preview=action==='preview-mode';render();}
  if(action==='outline') outline();
  if(action==='print') window.print();
  if(action==='jump') {preview=false;close();render();document.getElementById('block-'+value)?.scrollIntoView({block:'start'});}
  if(action==='hint') {
    if(buttonNode.closest('form')) {
      const original=buttonNode.closest('form').parentNode;
      const clone=original.cloneNode(true);
      original.querySelectorAll('select').forEach((select,index)=>{clone.querySelectorAll('select')[index].value=select.value;});
      retainedForm={title:sheetTitle.textContent,clone};
    }
    const back=d.parent|| (buttonNode.closest('form')?'restore-form':'');
    sheet(d.label,'<p>'+html(d.detail)+'</p>'+(back?button('← Назад','back-hint','data-id="'+html(back)+'"'):''));
  }
  if(action==='back-hint') {
    if(value==='choose-text') chooseText();
    if(value==='insert-again') insertMenu();
    if(value==='restore-form'&&retainedForm) {sheetTitle.textContent=retainedForm.title;sheetBody.replaceChildren(...retainedForm.clone.childNodes);retainedForm=null;}
    if(value.startsWith('block-menu:')) blockActions(value.slice(11));
  }
  if(action==='insert') {insertion={parent:d.parent||'',after:d.after||''};insertMenu();}
  if(action==='add-block') {
    const block=makeBlock(value);
    editBlocks(blocks=>{
      const list=insertion.parent?locate(blocks,insertion.parent).block.children:blocks;
      list.splice(insertion.after?list.findIndex(b=>b.id===insertion.after)+1:list.length,0,block);
    },block.id);
  }
  if(action==='block-menu') blockActions(value);
  if(action==='block-move') blockDestinations(value);
  if(action==='fold') {if(folded.has(value))folded.delete(value);else folded.add(value);close();render();}
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
dialog.addEventListener('close',()=>{syncOpen=false;retainedForm=null;});
window.addEventListener('hashchange',()=>{preview=false;close();render();window.scrollTo(0,0);});
google?.init({records:()=>data,refresh:googleRefresh,offerRestore:value=>offerRestore(value,true)});
render();
