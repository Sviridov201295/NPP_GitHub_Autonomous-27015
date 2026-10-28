import { render, showError } from './app.js';
const $ = id => document.getElementById(id);
const DEMO = new URLSearchParams(location.search).get('demo') === '1';
const STALE_MS = 30 * 60 * 1000; // CI runs around every 10 minutes; jobs may be delayed.
let recent = null;

function write(id, value) { $(id).textContent = value == null || value === '' ? '—' : String(value); }
function time(ms){ return Number.isFinite(ms) ? new Date(ms).toLocaleString('ru-RU') : '—'; }
function drawRuleFields(rules){
  const rows=Object.entries(rules || {});
  const root=$('query-fields-list'); root.replaceChildren();
  $('query-npp-fields').hidden = rows.length === 0;
  for (const [key, value] of rows) {
    const row=document.createElement('div');row.className='query-rule-row';
    const label=document.createElement('span');label.textContent=key;
    const val=document.createElement('b');val.textContent=String(value);
    row.append(label,val);root.append(row);
  }
}
function draw(data){
  const checked=Date.parse(data?.checkedAt || '');
  const fresh=Number.isFinite(checked) && Date.now()-checked < STALE_MS && checked <= Date.now()+60000;
  const available=Boolean(data?.infoOk && fresh);
  const publicNpp = available && data?.rulesOk && data?.nppTelemetry?.s?.city &&
    Object.keys(data.nppTelemetry.s.city).length>0;
  const telemetry=publicNpp?(DEMO?{...data.nppTelemetry,source:'demo'}:data.nppTelemetry):null;
  $('query-state').textContent=DEMO?'ДЕМО':!fresh?'УСТАРЕЛО':available?'A2S ОТВЕТИЛ':'НЕТ ОТВЕТА';
  $('query-state').className='mini-status '+(available?'ok':'bad');
  write('query-info',data?.infoOk?'Получен': 'Не получен');
  write('query-name',data?.server?.name);
  write('query-players',data?.server?`${data.server.players} / ${data.server.maxPlayers}`:null);
  write('query-map',data?.server?.map);
  write('query-updated',time(checked));
  write('query-rules',data?.rulesOk?`${data.ruleCount??0} записей`:'Не доступны');
  let explanation;
  if (DEMO) explanation='ТЕСТОВЫЕ данные. Они не получены с Garry’s Mod-сервера.';
  else if (!fresh) explanation='Запланированный опрос давно не выполнялся: данные устарели. Проверьте GitHub Actions.';
  else if (!data?.infoOk) explanation='Не получен ответ A2S_INFO по UDP. Это не означает, что игровой сервер обязательно выключен. Возможны фильтрация или другой query-порт.';
  else if (!data?.rulesOk) explanation='A2S_INFO работает, но A2S_RULES недоступен. Внутренние данные АЭС не извлечены.';
  else if (!Object.keys(data.nppRules||{}).length) explanation='Порт ответил, но сервер не публикует параметры АЭС в A2S_RULES. Температура, ТВЭЛы, турбина и аварии недоступны.';
  else explanation='Найдены явно опубликованные сервером поля, связанные с АЭС. Только известные по имени значения отображаются без догадок.';
  write('query-explanation',explanation);
  drawRuleFields(data?.nppRules||{});
  render({
    connected: Boolean(publicNpp),
    updatedAt: Number.isFinite(checked)?new Date(checked).toISOString():null,
    staleAfterSeconds: STALE_MS/1000,
    telemetry,
    events:[], history:[]
  });
  // The A2S collector cannot inspect private net messages or 60 fuel channels.
  if (!publicNpp && !DEMO) {
    $('banner').textContent = 'Нет публичных показателей АЭС. A2S_INFO отвечает только за сведения о сервере; данные реактора, ТВЭЛов и турбины в стандартные ответы не входят.';
  }
}
function makeDemo(){
  const now=new Date().toISOString();
  return {checkedAt:now,infoOk:true,rulesOk:true,ruleCount:6,
    server:{name:'SYNDICATE · ДЕМОНСТРАЦИЯ',map:'rp_demo',players:21,maxPlayers:64},
    nppRules:{'NC_Station_KW':'2300','NC_Reserve_KW':'300','Syndicate_CityPower_Load':'2200'},
    nppTelemetry:{source:'a2s_rules',s:{city:{station:2300,reserve:300,load:2200}}}};
}
async function update(){
  if (DEMO){draw(makeDemo());return;}
  try{
    const url=new URL('./data/source-query.json',location.href);
    url.searchParams.set('t',String(Date.now()));
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    recent=await response.json();
    draw(recent);
  } catch(err){
    showError('Нет файла результатов опроса. Проверьте GitHub Actions: '+String(err?.message||err));
    $('query-state').textContent='НЕТ ДАННЫХ';
    write('query-explanation','Сайт размещён, но автоматический опрос ещё не опубликован.');
  }
}
update();
setInterval(update,60000);
