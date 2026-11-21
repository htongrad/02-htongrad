import {catalog, dialogueModes} from './writing.js?v=1.4.1';
export const forms = {
  'Рассказ': ['Проза', ['text'], ['epigraph','text','scene','break','proseLine','dialogue']],
  'Повесть': ['Проза', ['chapter'], ['epigraph','chapter']],
  'Роман': ['Проза', ['chapter'], ['epigraph','part','chapter']],
  'Короткий метр': ['Сценарии', ['shot'], ['shot']],
  'Полный метр': ['Сценарии', ['shot'], ['shot']],
  'Серия': ['Сценарии', ['shot'], ['shot']],
  'Статья': ['Публицистика', ['lead','section'], ['lead','section','quote','source']],
  'Интервью': ['Публицистика', ['intro','qa'], ['intro','subtitle','qa','quote']],
  'Обзор': ['Публицистика', ['lead','item','conclusion'], ['lead','item','section','conclusion']],
  'Рецензия': ['Публицистика', ['work','section','conclusion'], ['work','section','quote','conclusion']],
  'Эссе': ['Публицистика', ['text'], ['text','subtitle','quote','break']],
  'Репортаж': ['Публицистика', ['lead',['section','На месте'],'quote',['section','Контекст']], ['lead','section','quote','source']],
  'Объясняющая статья': ['Публицистика', ['lead',['section','Как это работает'],['section','Что это меняет']], ['lead','section','quote','source']]
};
const body = ['Текст','Пиши абзацами. Оформление появится в предпросмотре.',true];
const title = ['Название','Введи короткий заголовок. Поле можно оставить пустым.'];
const reference = ['Источник','Укажи автора, издание или адрес источника. Поле можно оставить пустым.'];
export const types = {
  text: ['Текст','Один или несколько абзацев.',{body}],
  break: ['Отбивка','Разделяет фрагменты тремя звёздочками.',{}],
  epigraph: ['Эпиграф','Короткая цитата перед произведением или главой.',{body,reference}],
  part: ['Часть','Объединяет главы.',{title},['chapter'],['chapter']],
  chapter: ['Глава','Объединяет сцены и текст. Номер подставляется автоматически.',{title},['epigraph','text','scene','break','proseLine','dialogue'],['text']],
  scene: ['Сцена','Фрагмент прозы, объединённый местом, временем или действием.',{},['text','break','proseLine','dialogue'],['text']],
  dialogue: ['Диалог','Объединяет реплики. Каждая реплика начинается с отдельного абзаца.',{},['proseLine','text'],['proseLine','proseLine']],
  proseLine: ['Реплика в прозе','Выбери положение слов автора. Панель расставит разделительные знаки.',{
    mode:['Оформление','Положение слов автора.',dialogueModes],
    body:['Прямая речь','Реплика без начального тире.'],
    attribution:['Слова автора','Например, «сказала Нина».'],
    continuation:['Продолжение реплики','Продолжи с нужной буквы.']
  }],
  shot: ['Сценарная сцена','Заголовок сцены собирается из трёх полей.',{
    placeType:['Интерьер / экстерьер','Выбери, где происходит действие.',['ИНТ.','НАТ.','ИНТ./НАТ.']],
    location:['Место','Назови место действия, например «Набережная».'],
    time:['Время','Укажи время действия, например «Ночь».']
  },['action','speech','transition'],['action']],
  action: ['Действие','Опиши то, что зритель видит и слышит.',{body}],
  speech: ['Реплика','Имя, ремарка и слова персонажа перемещаются вместе.',{
    speaker:['Персонаж','Введи имя. Верхний регистр добавит панель.'],
    aside:['Ремарка','Например, «шёпотом». Скобки добавит панель.'],
    body:['Реплика','Введи слова персонажа.',true]
  }],
  transition: ['Переход','Например, «ЗАТЕМНЕНИЕ». Панель выровняет его справа.',{body}],
  lead: ['Лид / вступление','Первый абзац, который знакомит с темой.',{body}],
  intro: ['Представление','Назови собеседника и объясни, о чём разговор.',{body}],
  section: ['Раздел','Раскрой один аспект темы.',{title},['text','quote','list','source'],['text']],
  quote: ['Цитата','Оформляется отдельно, с подписью источника.',{body,reference}],
  list: ['Список','Каждая строка станет отдельным пунктом.',{body}],
  source: ['Источник','Добавь подпись и ссылку на материал.',{title,url:['Ссылка','Можно вставить адрес, начинающийся с https://.']}],
  qa: ['Вопрос — ответ','Вопрос и ответ перемещаются вместе.',{
    question:['Вопрос','Введи вопрос интервьюера.',true],
    answer:['Ответ','Введи ответ собеседника.',true]
  }],
  subtitle: ['Подзаголовок','Начинает новую тему или фрагмент.',{title}],
  item: ['Карточка объекта','Добавь название, описание и ссылку при необходимости.',{title,body,url:['Ссылка','Необязательный адрес страницы объекта.']}],
  work: ['Карточка произведения','Краткие сведения о произведении, которое разбираешь.',{
    title,author:['Автор','Укажи автора или создателя.'],year:['Год','Укажи год выпуска, если он известен.'],url:['Ссылка','Необязательный адрес страницы произведения.']
  }],
  conclusion: ['Итог','Сформулируй вывод по материалу.',{body}]
};
export const genres = catalog;
export const directions = ['Проза','Сценарии','Публицистика'];
export const statuses = ['Черновик','На вычитке','Готов'];
export const id = () => crypto.randomUUID();
export const formHint = name => {
  const [,starter] = forms[name];
  return starter.map(entry=>Array.isArray(entry)?'«'+entry[1]+'»':types[entry][0]).join(' → ');
};
export function makeBlock(type) {
  const [, , fields, , starter = []] = types[type];
  const values = Object.fromEntries(Object.entries(fields).map(([key,[,,options]]) => [key, Array.isArray(options) ? options[0] : '']));
  return {id:id(),type,values,children:starter.map(makeBlock)};
}
export function makeText(form, title, projectId) {
  const blocks = forms[form][1].map(entry=>{
    if (!Array.isArray(entry)) return makeBlock(entry);
    const [type, title] = entry;
    const block = makeBlock(type);
    block.values.title = title;
    return block;
  });
  return {id:id(),form,title,projectId,genres:[],status:statuses[0],goal:'',minutes:'',pilot:false,updated:Date.now(),blocks};
}
export function locate(blocks, target) {
  for (const block of blocks) {
    if (block.id === target) return {block, siblings:blocks};
    const nested = locate(block.children,target);
    if (nested) return nested;
  }
}
export function duplicate(block) {
  return {...block,id:id(),values:{...block.values},children:block.children.map(duplicate)};
}
export const collections = ['projects','texts','notes','events'];
export const blank = () => Object.fromEntries(collections.map(key=>[key,[]]));
export function merge(local, incoming) {
  return Object.fromEntries(collections.map(key=>{
    const known=new Set(local[key].map(item=>item.id));
    return [key,[...local[key],...incoming[key].filter(item=>!known.has(item.id))]];
  }));
}
const string = value => typeof value === 'string';
const validPlan = (plan, form) => plan === undefined || (
  forms[form][0] === 'Сценарии' && plan && string(plan.logline) && string(plan.episodes)
);
const dates = value => /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const clock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function validBlocks(blocks, allowed, seen = new Set(), depth = 0) {
  return depth<8 && Array.isArray(blocks) && blocks.every(b=>{
    if (!b || (b.role!==undefined && !string(b.role)) || !string(b.id) || seen.has(b.id) || !allowed.includes(b.type) || !b.values) return false;
    seen.add(b.id);
    return Object.keys(types[b.type][2]).every(key=>string(b.values[key]))
      && Object.keys(b.values).every(key=>Object.hasOwn(types[b.type][2],key))
      && validBlocks(b.children,types[b.type][3] ?? [],seen,depth+1);
  });
}
export function valid(data) {
  if (!data || !collections.every(key=>Array.isArray(data[key]) && data[key].every(item=>item && string(item.id) && string(item.title)) && new Set(data[key].map(item=>item.id)).size===data[key].length)) return false;
  return data.texts.every(t=>Object.hasOwn(forms,t.form) && statuses.includes(t.status) && string(t.projectId) && string(t.goal) && string(t.minutes) && typeof t.pilot==='boolean' && Number.isFinite(t.updated) && Array.isArray(t.genres) && t.genres.every(g=>Object.hasOwn(genres,g)) && validPlan(t.plan,t.form) && validBlocks(t.blocks,forms[t.form][2]))
    && data.notes.every(n=>string(n.body) && string(n.projectId) && Number.isFinite(n.updated))
    && data.events.every(e=>dates(e.date) && string(e.textId) && typeof e.allDay==='boolean' && string(e.start) && string(e.end) && (e.allDay || (clock(e.start) && clock(e.end) && e.start<e.end)));
}
