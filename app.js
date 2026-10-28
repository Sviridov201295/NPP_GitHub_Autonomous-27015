'use strict';
const $ = id => document.getElementById(id);
const fmt = (v, digits=0) => Number.isFinite(v) ? new Intl.NumberFormat('ru-RU',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(v) : '—';
const val = (o, k) => Number.isFinite(o?.[k]) ? o[k] : null;
const pct = (n,d=0) => Number.isFinite(n) ? `${fmt(n*100,d)}%` : '—';
const kw = n => Number.isFinite(n) ? (n>=1000? `${fmt(n/1000,2)} МВт` : `${fmt(n)} кВт`) : '—';
const min = n => Number.isFinite(n) ? n >= 3600 ? [Math.floor(n/3600),Math.floor((n%3600)/60)].join(' ч ')+' мин' : `${fmt(n/60,0)} мин` : '—';
const numText = (id, value) => {$(id).textContent = value == null ? '—' : String(value);};
const width = (id,v) => {$(id).style.width = `${Math.max(0,Math.min(100,Number.isFinite(v)?v:0))}%`;};
let current = null;
function classify(connected, source) { return source==='demo'?'demo':!connected?'offline':source==='a2s_rules'?'partial':'live'; }
function liveStatus(d, type) {
  $('side-status').textContent = type==='offline'?'Нет связи':type==='demo'?'Демонстрация':type==='partial'?'Ограниченные данные A2S':'Телеметрия онлайн';
  $('side-updated').textContent = d.updatedAt ? `Последние данные: ${new Date(d.updatedAt).toLocaleTimeString('ru-RU')}` : 'Источник не подключён';
  $('sidebar-dot').className = 'live-dot '+(type==='live'?'good':type==='demo'||type==='partial'?'warn':'');
  $('mode-chip').className = 'chip '+(type==='live'?'live':type==='demo'||type==='partial'?'demo':'');
  $('mode-chip').textContent = type==='live'?'LIVE · ОБНОВЛЯЕТСЯ':type==='demo'?'ДЕМО · НЕ ИЗ ИГРЫ':type==='partial'?'ЧАСТИЧНО · A2S_RULES':'НЕТ СВЯЗИ';
  $('banner').classList.toggle('hidden',type==='live');
  $('banner').textContent = type==='offline' ?
    (d.updatedAt ? 'Связь с источником потеряна. Ниже показаны последние полученные значения; они могут быть устаревшими.' : 'Нет данных из игры. Сайт не показывает вымышленные значения. Подключите источник телеметрии.') :
    type==='partial' ? 'ЧАСТИЧНЫЕ ПУБЛИЧНЫЕ ДАННЫЕ: получены только явно опубликованные A2S_RULES. Остальные показания АЭС недоступны.' : 'ДЕМОНСТРАЦИЯ: показания синтетические и не отражают реальное состояние АЭС.';
  $('hero-time').textContent = d.updatedAt ? `Обновлено ${new Date(d.updatedAt).toLocaleTimeString('ru-RU')}${type==='offline'?' · значения устарели':''}` : 'Ожидание подключения';
  numText('footer-state',type==='live'?'Источник подключён':type==='demo'?'Демонстрационные данные':type==='partial'?'Частичная публичная сводка':'Связь отсутствует');
}
export function render(d) {
  if (!d) return;
  current = d;
  const data=d.telemetry||{}, s=data.s||{}, city=s.city||{}, rx=s.rx||{}, tb=s.tb||{}, ws=s.ws||{}, probs=Array.isArray(s.probs)?s.probs:[];
  const type=classify(d.connected,data.source);
  liveStatus(d,type);
  const hasData=Boolean(d.telemetry);
  const hasProblems=Array.isArray(s.probs);
  const running=s.run===true;
  $('hero-status').textContent=!hasData?'НЕТ ДАННЫХ':s.tripped?'АВАРИЙНАЯ ЗАЩИТА':running?'СТАНЦИЯ РАБОТАЕТ':s.run===false?'РЕАКТОР ОСТАНОВЛЕН':'СОСТОЯНИЕ НЕИЗВЕСТНО';
  $('hero-symbol').textContent=!hasData?'—':s.tripped?'!':running?'✓':'○';
  $('hero-status').style.color=hasData?(s.tripped?'var(--red)':running?'var(--green)':'var(--amber)'):'var(--text)';
  document.querySelector('.status-ring').classList.toggle('online',hasData&&running&&!s.tripped&&type!=='offline');
  numText('gen',Number.isFinite(city.station)?fmt(city.station/1000,2):'—');
  numText('load',Number.isFinite(city.load)?fmt(city.load/1000,2):'—');
  numText('fuel',Number.isFinite(s.fuelSec)?fmt(s.fuelSec/60):'—');
  numText('issues',hasProblems?probs.length:'—');
  numText('issues-foot',hasProblems?`${probs.filter(p=>p.sev===1).length} критических · ${probs.filter(p=>p.sev===2).length} предупреждений`:'Диагностика АЭС недоступна');
  numText('fuel-foot',Number.isFinite(s.fuelPct)?`Запас топлива: ${fmt(s.fuelPct)}%`:'Ресурс ТВЭЛ не опубликован');
  numText('bal-station',kw(city.station));numText('bal-reserve',kw(city.reserve));numText('bal-load',kw(city.load));
  const base=Math.max(city.load||0,(city.station||0)+(city.reserve||0),1);
  width('bar-station',(city.station||0)/base*100);
  width('bar-reserve',(city.reserve||0)/base*100);
  width('bar-load',(city.load||0)/base*100);
  const deficit = Number.isFinite(city.load)&&Number.isFinite(city.station) ? Math.max(0,city.load-city.station-(city.reserve||0)):null;
  numText('deficit',kw(deficit));
  numText('blackout',!hasData||typeof city.blackout!=='boolean'?'—':city.blackout?'ГОРОД ОБЕСТОЧЕН':'Электроснабжение есть');
  numText('grid-state',!hasData?'Нет данных':city.blackout===true?'БЛЭКАУТ':city.blackout===false?'Сеть':'Нет данных');
  $('grid-state').className='mini-status '+(city.blackout===true?'bad':city.blackout===false?'ok':'');
  const filled=Number.isFinite(rx.fresh)&&Number.isFinite(rx.spent)?rx.fresh+rx.spent:null;
  const channels=Number.isFinite(rx.chans)?rx.chans:60;
  numText('rods-count',filled===null?'—':fmt(filled));
  document.querySelector('.donut small').textContent=`из ${fmt(channels)} каналов`;
  $('donut').style.background=filled===null?'conic-gradient(#355269 0% 100%)':`conic-gradient(var(--green) 0% ${Math.min(100,100*filled/channels)}%, #2b4051 ${Math.min(100,100*filled/channels)}% 100%)`;
  numText('fresh',fmt(rx.fresh));numText('spent',fmt(rx.spent));
  numText('wear',pct(rx.wear));numText('setpoint',Number.isFinite(s.setp)?fmt(s.setp)+'%':'—');
  numText('rx-power',pct(s.power));numText('temp',Number.isFinite(s.temp)?fmt(s.temp)+' °C':'—');
  numText('pressure',Number.isFinite(s.press)?`${fmt(s.press)} кгс/см²`:'—');
  numText('pumps',Number.isFinite(s.pumps)?`${fmt(s.pumps)} / 2`:'—');
  numText('rx-status',rx.found===false?'НЕ НАЙДЕН':rx.stage||'—');
  const rpm=val(tb,'rpm');numText('rpm',fmt(rpm));width('bar-rpm',rpm===null?0:rpm/3300*100);
  numText('tb-load',Number.isFinite(tb.load)?`${fmt(tb.load,2)} МВт`:'—');
  numText('steam',Number.isFinite(tb.press)?`${fmt(tb.press)} кгс/см²`:'—');
  numText('vac',pct(tb.vac));numText('oil',pct(tb.oil));
  numText('bearing',Number.isFinite(tb.bear)?`${fmt(tb.bear)} °C`:'—');
  numText('tb-grid',tb.grid===true?'ПОДКЛЮЧЕН':tb.grid===false?'ОТКЛЮЧЕН':'—');
  numText('fouling',Number.isFinite(tb.foul)&&Number.isFinite(tb.foulMax)&&tb.foulMax>0?pct(tb.foul/tb.foulMax):'—');
  numText('oil-left',Number.isFinite(tb.oilLeft)?min(tb.oilLeft):'—');
  numText('foul-left',Number.isFinite(tb.foulLeft)?min(tb.foulLeft):'—');
  numText('tb-status',tb.tripped?'СРАБОТАЛА ЗАЩИТА':tb.grid?'В СЕТИ':rpm>50?'НА ХОЛОСТОМ':tb.found===false?'НЕ НАЙДЕН':tb.found===true?'СТОИТ':'НЕТ ДАННЫХ');
  numText('waste',Number.isFinite(s.wastePct)?`${fmt(s.wastePct)}%`:'—');
  numText('rack',Number.isFinite(ws.rack?.rods)?`${fmt(ws.rack.rods)} ТВЭЛ (${fmt(ws.rack.cases)} ящ.)`:'—');
  numText('drum',Number.isFinite(ws.drum?.rods)?`${fmt(ws.drum.rods)}/${fmt(ws.drum.pockets)}${ws.drum.sealed?' · закатана':''}`:'—');
  numText('sent',fmt(ws.lift?.sent));
  numText('panel-parts',Number.isFinite(s.slotsOk)?`${fmt(s.slotsOk)}/${fmt(s.slotsAll)}`:'—');
  numText('trip',s.tripped===true?'СРАБОТАЛА':s.tripped===false?'НЕ СРАБОТАЛА':'—');
  numText('panel-status',s.panel===true?'ВКЛЮЧЁН':s.panel===false?'ОБЕСТОЧЕН':'—');
  numText('vent',s.ventOn===true?'ВКЛЮЧЕНА':s.ventOn===false?'ОТКЛЮЧЕНА':'—');
  $('issue-total').textContent=hasProblems?`${probs.length} замечаний`:'Нет данных';
  renderProblems(probs,hasProblems);renderEvents(d.events||[]);renderChart(d.history||[]);
}
function el(type,className,text) {const n=document.createElement(type);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function renderProblems(probs,hasData) {
  const root=$('problem-list');root.replaceChildren();
  if (!hasData){root.append(el('div','empty','Нет данных об неисправностях.'));return;}
  if (!probs.length){root.append(el('div','empty','По полученной сводке замечаний нет.'));return;}
  for(const pr of probs){const node=el('div','problem '+(pr.sev===1?'critical':pr.sev===2?'warning':''));
    node.append(el('div','mark',pr.sev===1?'!':'⚑'));
    const body=el('div');body.append(el('b','',pr.text||'Замечание'));
    if(pr.act)body.append(el('p','',pr.act));
    if(pr.shop)body.append(el('p','',`F4: ${pr.shop}`));
    node.append(body);root.append(node);
  }
}
function renderEvents(events){const root=$('event-list');root.replaceChildren();if(!events.length){root.append(el('div','empty','Новых событий пока не зарегистрировано.'));return;}
  for(const evt of events.slice(0,14)){const node=el('div','event');node.append(el('time','',new Date(evt.at).toLocaleString('ru-RU')));node.append(el('span','',evt.text));root.append(node);}
}
function renderChart(history){const svg=$('chart');svg.replaceChildren();numText('chart-samples',`${history.length} измерений`);
  const xmlns='http://www.w3.org/2000/svg';
  function make(name,attrs={}){const n=document.createElementNS(xmlns,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));svg.append(n);return n;}
  const valid=history.filter(p=>Number.isFinite(p.power)||Number.isFinite(p.demand));
  if (!valid.length){make('text',{x:320,y:110,'text-anchor':'middle',fill:'#7f91a2'}).textContent='Ожидание измерений';return;}
  const max=Math.max(1000,...valid.map(x=>Math.max(x.power||0,x.demand||0)))*1.1;
  const left=45,right=620,top=12,bottom=196;
  for(let i=0;i<=4;i++){const y=top+(bottom-top)*i/4;make('line',{x1:left,x2:right,y1:y,y2:y,stroke:'#2d4252','stroke-width':1,'stroke-dasharray':'4 5'});make('text',{x:36,y:y+4,fill:'#7f91a2','text-anchor':'end','font-size':'10'}).textContent=fmt(max*(4-i)/4/1000,1);}
  const xs=valid.map((p,i)=>valid.length===1?(left+right)/2:left+i/(valid.length-1)*(right-left));
  const points=(key)=>valid.map((p,i)=>Number.isFinite(p[key])?`${xs[i]},${bottom-(p[key]/max)*(bottom-top)}`:null).filter(Boolean).join(' ');
  // Missing values do not become fake zero measurements.
  if(valid.some(p=>Number.isFinite(p.demand)))make('polyline',{points:points('demand'),stroke:'#f6b965','stroke-width':2.5,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'});
  if(valid.some(p=>Number.isFinite(p.power)))make('polyline',{points:points('power'),stroke:'#47d5a6','stroke-width':3,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'});
  const first=valid[0],last=valid[valid.length-1];
  make('text',{x:left,y:216,fill:'#7f91a2','font-size':'10'}).textContent=new Date(first.t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  make('text',{x:right,y:216,fill:'#7f91a2','font-size':'10','text-anchor':'end'}).textContent=new Date(last.t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
}

export function showError(message) {
  const banner = $('banner');
  banner.classList.remove('hidden');
  banner.textContent = message;
  $('mode-chip').className = 'chip';
  $('mode-chip').textContent = 'НЕ ПОДКЛЮЧЕНО';
  $('side-status').textContent = 'Ошибка подключения';
  $('footer-state').textContent = 'Нет подключения к базе';
}
setInterval(() => {
  numText('clock', new Date().toLocaleTimeString('ru-RU'));
  if (current && current.updatedAt) {
    const age = Date.now() - Date.parse(current.updatedAt);
    if (age > (current.staleAfterSeconds || 15) * 1000 && current.connected) {
      render({...current, connected:false});
    }
  }
}, 1000);
