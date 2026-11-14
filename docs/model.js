export const forms = {
  'Рассказ': ['Проза', '0,1–2 авт. л.', ['text'], ['epigraph','text','scene','break']],
  'Повесть': ['Проза', '2–5 авт. л.', ['chapter'], ['epigraph','chapter']],
  'Роман': ['Проза', 'от 5 авт. л.', ['chapter'], ['epigraph','part','chapter']],
  'Короткий метр': ['Сценарии', '5–20 страниц', ['shot'], ['shot']],
  'Полный метр': ['Сценарии', '70–120 минут, до 120 страниц', ['shot'], ['shot']],
  'Серия': ['Сценарии', '24 или 48 минут', ['shot'], ['shot']],
  'Статья': ['Публицистика', '0,225–0,375 авт. л.', ['lead','section'], ['lead','section','quote','source']],
  'Интервью': ['Публицистика', '0,30–0,875 авт. л.', ['intro','qa'], ['intro','subtitle','qa','quote']],
  'Обзор': ['Публицистика', '0,125–0,30 авт. л.', ['lead','item','conclusion'], ['lead','item','section','conclusion']],
  'Рецензия': ['Публицистика', '0,10–0,25 авт. л.', ['work','section','conclusion'], ['work','section','quote','conclusion']],
  'Эссе': ['Публицистика', '0,10–0,30 авт. л.', ['text'], ['text','subtitle','quote','break']]
};
const body = ['Текст','Пиши абзацами. Оформление появится в предпросмотре.',true];
const title = ['Название','Введи короткий заголовок.'];
const reference = ['Источник','Укажи автора, издание или адрес источника. Поле можно оставить пустым.'];
export const types = {
  text: ['Текст','Один или несколько абзацев.',{body}],
  break: ['Отбивка','Разделяет фрагменты тремя звёздочками.',{}],
  epigraph: ['Эпиграф','Короткая цитата перед произведением или главой.',{body,reference}],
  part: ['Часть','Объединяет главы.',{title},['chapter'],['chapter']],
  chapter: ['Глава','Объединяет сцены и текст. Номер подставляется автоматически.',{title},['epigraph','text','scene','break'],['text']],
  scene: ['Сцена','Фрагмент прозы, объединённый местом, временем или действием.',{},['text','break'],['text']],
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
export const genres = {
  'Современная проза':'Герои и конфликты современной жизни.',
  'Историческая проза':'Действие связано с конкретной исторической эпохой.',
  'Детектив':'История строится вокруг загадки и расследования.',
  'Триллер':'Напряжение держится на угрозе и неопределённости.',
  'Фантастика':'Мир или событие строится на фантастическом допущении.',
  'Фэнтези':'В мире действуют магия или мифологические силы.',
  'Мистика':'Привычный мир сталкивается с необъяснимым.',
  'Хоррор':'История вызывает страх и тревогу.',
  'Любовная проза':'Отношения героев определяют развитие сюжета.',
  'Драма':'Личный конфликт ведёт к важным переменам.',
  'Комедия':'Сюжет раскрывается через комические ситуации.',
  'Мелодрама':'Эмоциональные отношения определяют конфликт.'
};
export const directions = ['Проза','Сценарии','Публицистика'];
export const statuses = ['Черновик','На вычитке','Готов'];
export const id = () => crypto.randomUUID();
export const formHint = name => {
  const [,size,starter] = forms[name];
  return 'Стартовые блоки — '+starter.map(key=>types[key][0].toLowerCase()).join(', ')+'. Ориентир объёма — '+size+'.';
};
export function makeBlock(type) {
  const [, , fields, , starter = []] = types[type];
  const values = Object.fromEntries(Object.entries(fields).map(([key,[,,options]]) => [key, Array.isArray(options) ? options[0] : '']));
  return {id:id(),type,values,children:starter.map(makeBlock)};
}
export function makeText(form, title, projectId) {
  return {id:id(),form,title,projectId,genres:[],status:statuses[0],goal:'',minutes:'',pilot:false,updated:Date.now(),blocks:forms[form][2].map(makeBlock)};
}
export function count(blocks) {
  return blocks.reduce((sum,{values,children}) => sum+Object.entries(values).filter(([key])=>key!=='placeType').reduce((chars,[,value])=>chars+[...value.replace(/[\r\n]/g,'')].length,0)+count(children),0);
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
const dates = value => /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const clock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function validBlocks(blocks, allowed, seen = new Set(), depth = 0) {
  return depth<8 && Array.isArray(blocks) && blocks.every(b=>{
    if (!b || !string(b.id) || seen.has(b.id) || !allowed.includes(b.type) || !b.values) return false;
    seen.add(b.id);
    return Object.keys(types[b.type][2]).every(key=>string(b.values[key]))
      && Object.keys(b.values).every(key=>Object.hasOwn(types[b.type][2],key))
      && validBlocks(b.children,types[b.type][3] ?? [],seen,depth+1);
  });
}
export function valid(data) {
  if (!data || !collections.every(key=>Array.isArray(data[key]) && data[key].every(item=>item && string(item.id) && string(item.title)) && new Set(data[key].map(item=>item.id)).size===data[key].length)) return false;
  return data.texts.every(t=>Object.hasOwn(forms,t.form) && statuses.includes(t.status) && string(t.projectId) && string(t.goal) && string(t.minutes) && typeof t.pilot==='boolean' && Number.isFinite(t.updated) && Array.isArray(t.genres) && t.genres.every(g=>Object.hasOwn(genres,g)) && validBlocks(t.blocks,forms[t.form][3]))
    && data.notes.every(n=>string(n.body) && string(n.projectId) && Number.isFinite(n.updated))
    && data.events.every(e=>dates(e.date) && string(e.textId) && typeof e.allDay==='boolean' && string(e.start) && string(e.end) && (e.allDay || (clock(e.start) && clock(e.end) && e.start<e.end)));
}
