import { useMemo, useState, useEffect } from "react";
import { Fish, TrendingUp, TrendingDown, CalendarClock, AlertTriangle, Download, History as HistoryIcon, CalendarDays, Settings, ChevronLeft, ChevronRight, ClipboardCheck, SlidersHorizontal, X, CheckCircle2 } from "lucide-react";

const KEY = "stock-salmon-local-v1";
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const NAV = [{id:"inicio",label:"Inicio",Icon:Fish},{id:"historial",label:"Historial",Icon:HistoryIcon},{id:"calendario",label:"Calendario",Icon:CalendarDays},{id:"ajustes",label:"Ajustes",Icon:Settings}];

function loadStore() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && Array.isArray(v.movements) ? {config:v.config || null,movements:v.movements} : {config:null,movements:[]}; }
  catch { return {config:null,movements:[]}; }
}
function intInput(v) { return /^\d+$/.test(String(v)) && Number.isSafeInteger(Number(v)) ? Number(v) : null; }
function dayKey(v) { const d=new Date(v); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function startDay(v) { const d=new Date(v); d.setHours(0,0,0,0); return d; }
function endDay(v) { const d=new Date(v); d.setHours(23,59,59,999); return d; }
function total(list, fn) { return list.reduce((a,x)=>a+fn(x),0); }
function fmtDate(v, options={day:"2-digit",month:"short"}) { return new Date(v).toLocaleDateString("es-CL",options); }
function fmtTime(v) { return new Date(v).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"}); }
function estado(stock, threshold) { return stock<=0?{label:"Crítico",cls:"critical"}:stock<=threshold?{label:"Bajo",cls:"low"}:{label:"Normal",cls:"normal"}; }
function exportCSV(list) {
  const headers=["Fecha","Hora","Tipo","Cantidad","Stock resultante","Cantidad anterior","Cantidad física","Diferencia","Nota"];
  const names={ingreso:"Ingreso",retiro:"Retiro",ajuste:"Ajuste"};
  const rows=list.map(m=>{const d=new Date(m.created_date);return [d.toLocaleDateString("es-CL"),fmtTime(d),names[m.tipo]||m.tipo,m.cantidad,m.stock_resultante,m.cantidad_anterior??"",m.cantidad_fisica??"",m.diferencia??"",m.nota||""];});
  const csv=[headers,...rows].map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8;"}));
  const a=document.createElement("a");a.href=url;a.download="stock-salmon-"+dayKey(new Date())+".csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function Button({children,onClick,variant="primary",className="",disabled=false,type="button"}) { return <button type={type} onClick={onClick} disabled={disabled} className={"btn btn-"+variant+" "+className}>{children}</button>; }
function Field({label,...props}) { return <label className="field"><span>{label}</span><input {...props}/></label>; }
function Card({children,className=""}) { return <section className={"card "+className}>{children}</section>; }
function Pill({stock,threshold}) { const s=estado(stock,threshold);return <span className={"status-pill "+s.cls}><i className="status-dot"/>{s.label}</span>; }
function StatCard({label,value,sub,accent="slate"}) { return <div className="stat-card"><p className="stat-label">{label}</p><p className={"stat-value "+accent}>{value}</p>{sub&&<p className="stat-sub">{sub}</p>}</div>; }
function Modal({title,description,onClose,children,footer}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></header><div className="modal-body">{children}</div>{footer&&<footer className="modal-footer">{footer}</footer>}</section></div>; }
function Toast({toast,onClose}) { return <div className={"toast "+(toast.type==="error"?"toast-error":"")} role="status">{toast.type==="error"?<AlertTriangle size={19}/>:<CheckCircle2 size={19}/>}<div><strong>{toast.title}</strong>{toast.description&&<p>{toast.description}</p>}</div>{onClose&&<button onClick={onClose} aria-label="Cerrar aviso"><X size={16}/></button>}</div>; }

export default function App() {
  const [store,setStore]=useState(loadStore);
  const [tab,setTab]=useState("inicio");
  const [toast,setToast]=useState(null);
  const [dialog,setDialog]=useState(null);
  const [busy,setBusy]=useState(false);
  const notify=(title,description="",type="success")=>setToast({title,description,type});
  useEffect(()=>{if(!toast)return;const t=window.setTimeout(()=>setToast(null),3200);return()=>window.clearTimeout(t);},[toast]);
  const persist=(next)=>{try{localStorage.setItem(KEY,JSON.stringify(next));setStore(next);return true;}catch{notify("No se pudo guardar","El almacenamiento del dispositivo no está disponible. El cambio no fue confirmado.","error");return false;}};
  const initial=(raw)=>{const n=intInput(raw);if(n===null){notify("Cantidad inválida","Ingresa un número entero igual o mayor que cero.","error");return;}const now=new Date().toISOString();if(persist({config:{id:"local-config",stock_inicial:n,stock_actual:n,umbral_bajo:10,configurado:true,created_date:now},movements:[]}))notify("Configuración guardada","Stock inicial: "+n+" lomos.");};
  const addMovement=async({tipo,cantidad,cantidadFisica=null,nota=""})=>{
    if(busy)return;setBusy(true);
    try{
      const c=store.config;if(!c?.configurado)throw new Error("Primero configura el stock inicial.");
      let result,diff=null,qty=cantidad;
      if(tipo==="ingreso"){if(!Number.isSafeInteger(cantidad)||cantidad<=0)throw new Error("El ingreso debe ser un entero mayor que cero.");result=c.stock_actual+cantidad;}
      else if(tipo==="retiro"){if(!Number.isSafeInteger(cantidad)||cantidad<=0)throw new Error("El retiro debe ser un entero mayor que cero.");if(cantidad>c.stock_actual)throw new Error("La cantidad a retirar supera el stock disponible en cámara.");result=c.stock_actual-cantidad;}
      else if(tipo==="ajuste"){if(!Number.isSafeInteger(cantidadFisica)||cantidadFisica<0)throw new Error("La cantidad física debe ser un entero igual o mayor que cero.");result=cantidadFisica;diff=cantidadFisica-c.stock_actual;qty=diff;}
      else throw new Error("Tipo de movimiento no válido.");
      if(!Number.isSafeInteger(result)||result<0)throw new Error("El stock resultante no es válido.");
      const m={id:Date.now()+"-"+Math.random().toString(36).slice(2,9),created_date:new Date().toISOString(),tipo,cantidad:qty,stock_resultante:result,cantidad_anterior:tipo==="ajuste"?c.stock_actual:null,cantidad_fisica:tipo==="ajuste"?cantidadFisica:null,diferencia:tipo==="ajuste"?diff:null,nota:String(nota||"").trim()};
      const next={config:{...c,stock_actual:result},movements:[m,...store.movements]};
      if(persist(next)){notify(tipo==="ajuste"?"Recuento guardado":"Movimiento guardado",tipo==="ajuste"?(diff===0?"Sin diferencia. Stock sin cambios.":"Ajuste de "+(diff>0?"+":"")+diff+" lomos registrado."):"Stock actual: "+result+" lomos.");setDialog(null);}
    }catch(e){notify("No se pudo guardar",e.message||"Ocurrió un error inesperado.","error");}finally{setBusy(false);}
  };
  if(!store.config?.configurado)return <><Setup onConfirm={initial}/>{toast&&<Toast toast={toast} onClose={()=>setToast(null)}/>}</>;
  const c=store.config, movements=store.movements, stock=c.stock_actual, threshold=c.umbral_bajo??10, todayKey=dayKey(new Date());
  const today=movements.filter(m=>dayKey(m.created_date)===todayKey);
  const ingToday=total(today.filter(m=>m.tipo==="ingreso"),m=>m.cantidad),retToday=total(today.filter(m=>m.tipo==="retiro"),m=>m.cantidad);
  const activeDays=(days)=>new Set(movements.filter(m=>{const diff=Math.floor((startDay(new Date())-startDay(m.created_date))/86400000);return diff>=0&&diff<days;}).map(m=>dayKey(m.created_date))).size;
  const byDay=(days)=>{const out=[];for(let i=0;i<days;i++){const d=startDay(new Date());d.setDate(d.getDate()-i);out.push(total(movements.filter(m=>m.tipo==="retiro"&&dayKey(m.created_date)===dayKey(d)),m=>m.cantidad));}return out;};
  const days7=activeDays(7),days14=activeDays(14),avg7=total(byDay(7),n=>n)/7,avg14=days14>=7?total(byDay(14),n=>n)/14:null;
  const estimate=days7<3?"Recolectando datos de consumo":avg7===0?"Sin retiros registrados":Math.floor(stock/avg7)+" días aprox.";
  return <>
    <div className="app-shell"><main className="main-content">
      {tab==="inicio"&&<Home stock={stock} threshold={threshold} estimate={estimate} ingToday={ingToday} retToday={retToday} avg7={avg7} avg14={avg14} days7={days7} onMovement={tipo=>setDialog({kind:"movement",tipo})}/>}
      {tab==="historial"&&<HistoryPage movements={movements}/>}
      {tab==="calendario"&&<CalendarPage movements={movements}/>}
      {tab==="ajustes"&&<SettingsPage config={c} onSave={n=>{if(persist({...store,config:{...c,umbral_bajo:n}}))notify("Umbral actualizado","Alerta de stock bajo en "+n+" lomos.");}} onRecount={()=>setDialog({kind:"recount"})}/>}
    </main><nav className="bottom-nav" aria-label="Navegación principal">{NAV.map(({id,label,Icon})=><button key={id} onClick={()=>setTab(id)} className={"nav-item "+(tab===id?"active":"")}><Icon size={21} strokeWidth={tab===id?2.4:2}/><span>{label}</span></button>)}</nav></div>
    {dialog?.kind==="movement"&&<MovementModal tipo={dialog.tipo} stock={stock} busy={busy} onClose={()=>!busy&&setDialog(null)} onConfirm={addMovement}/>}
    {dialog?.kind==="recount"&&<RecountModal stock={stock} busy={busy} onClose={()=>!busy&&setDialog(null)} onConfirm={n=>addMovement({tipo:"ajuste",cantidad:n-stock,cantidadFisica:n})}/>}
    {toast&&<Toast toast={toast} onClose={()=>setToast(null)}/>}
  </>;
}

function Setup({onConfirm}) {
  const [value,setValue]=useState("");const valid=intInput(value)!==null;
  return <div className="setup-screen"><div className="setup-wrap"><div className="brand-mark"><Fish size={29}/></div><h1>Stock Salmón</h1><p className="setup-subtitle">Control de inventario en cámara de frío</p><form className="card setup-card" onSubmit={e=>{e.preventDefault();if(valid)onConfirm(value);}}><label className="setup-question" htmlFor="initial-stock">¿Cuántos lomos de salmón hay actualmente en cámara?</label><input id="initial-stock" className="stock-input" type="number" min="0" step="1" inputMode="numeric" value={value} onChange={e=>setValue(e.target.value)} placeholder="0" autoFocus/><p className="help-text">Ingresa un número entero positivo o cero. Podrás corregirlo después con un recuento físico.</p><Button type="submit" disabled={!valid} className="full-width">Guardar y comenzar</Button></form></div></div>;
}
function Home({stock,threshold,estimate,ingToday,retToday,avg7,avg14,days7,onMovement}) {
  return <div className="page-stack">
    {stock<=0&&<div className="alert critical-alert"><AlertTriangle size={18}/>Stock crítico: cámara vacía</div>}
    {stock>0&&stock<=threshold&&<div className="alert low-alert"><AlertTriangle size={18}/>Stock bajo: revisar reposición</div>}
    <Card className="stock-main"><div className="stock-heading"><Fish size={17}/>Stock en cámara</div><div className="stock-number-row"><span className="stock-number">{stock}</span><span className="stock-unit">lomos</span></div><Pill stock={stock} threshold={threshold}/></Card>
    <section className="estimate-card"><div className="estimate-icon"><CalendarClock size={21}/></div><div><p>Duración estimada del stock</p><strong>{estimate}</strong></div></section>
    <div className="stats-grid"><StatCard label="Ingresos hoy" value={"+"+ingToday} accent="green"/><StatCard label="Retiros hoy" value={"-"+retToday} accent="orange"/><StatCard label="Prom. retiros 7 días" value={days7>=1?avg7.toFixed(1):"—"} sub="promedio por día natural"/><StatCard label="Prom. retiros 14 días" value={avg14!==null?avg14.toFixed(1):"—"} sub="requiere 7 días con actividad"/></div>
    <div className="action-grid"><Button onClick={()=>onMovement("ingreso")} className="action-button green-button"><TrendingUp size={25}/><span>INGRESO</span></Button><Button onClick={()=>onMovement("retiro")} className="action-button orange-button"><TrendingDown size={25}/><span>SACAR</span></Button></div>
    <p className="footnote">La estimación es orientativa y no garantiza la duración real del stock.</p>
  </div>;
}
function MovementModal({tipo,stock,busy,onClose,onConfirm}) {
  const [value,setValue]=useState("");const [note,setNote]=useState("");const n=intInput(value),income=tipo==="ingreso";
  const valid=n!==null&&n>0&&(income||n<=stock),result=valid?(income?stock+n:stock-n):null;
  return <Modal title={income?"Ingreso a cámara":"Sacar de cámara"} description={income?"Registra los lomos que entran al inventario.":"Registra los lomos que salen de la cámara."} onClose={onClose} footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button onClick={()=>valid&&onConfirm({tipo,cantidad:n,nota:note})} disabled={!valid||busy}>{busy?"Guardando…":"Confirmar"}</Button></>}>
    <div className="current-stock"><span>Stock actual</span><strong>{stock} lomos</strong></div><Field label="Cantidad de lomos" type="number" min="1" step="1" inputMode="numeric" autoFocus value={value} onChange={e=>setValue(e.target.value)} placeholder="0"/>
    {!income&&n!==null&&n>stock&&<p className="field-error">No puedes retirar más de los {stock} lomos disponibles.</p>}
    {valid&&<div className={"result-line "+(income?"positive":"")}><span>Stock resultante</span><strong>{result} lomos</strong></div>}
    <Field label="Nota (opcional)" value={note} onChange={e=>setNote(e.target.value)} placeholder="Ej. preparación de turno"/>
  </Modal>;
}
function RecountModal({stock,busy,onClose,onConfirm}) {
  const [value,setValue]=useState("");const n=intInput(value),valid=n!==null,diff=valid?n-stock:null;
  return <Modal title="Recuento físico" description="Introduce la cantidad real contada en cámara. El ajuste no borra el historial anterior." onClose={onClose} footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button onClick={()=>valid&&onConfirm(n)} disabled={!valid||busy}>{busy?"Guardando…":"Confirmar ajuste"}</Button></>}>
    <div className="current-stock"><span>Stock registrado</span><strong>{stock} lomos</strong></div><Field label="Cantidad física contada" type="number" min="0" step="1" inputMode="numeric" autoFocus value={value} onChange={e=>setValue(e.target.value)} placeholder="0"/>
    {valid&&<div className={"result-line "+(diff>0?"positive":diff<0?"negative":"")}><span>Diferencia</span><strong>{diff===0?"0 (sin cambios)":(diff>0?"+":"")+diff+" lomos"}</strong></div>}
  </Modal>;
}
function HistoryPage({movements}) {
  const [filter,setFilter]=useState("todo"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[date,setDate]=useState("");
  const list=useMemo(()=>{const now=new Date();let s=null,e=null;if(filter==="hoy"){s=startDay(now);e=endDay(now);}else if(filter==="semana"){s=startDay(now);s.setDate(s.getDate()-((s.getDay()+6)%7));e=new Date(s);e.setDate(e.getDate()+7);e.setMilliseconds(e.getMilliseconds()-1);}else if(filter==="fecha"&&date){s=startDay(date+"T00:00:00");e=endDay(date+"T00:00:00");}else if(filter==="rango"&&from&&to&&from<=to){s=startDay(from+"T00:00:00");e=endDay(to+"T00:00:00");}return movements.filter(m=>{const d=new Date(m.created_date);if(filter==="rango"&&(!from||!to||from>to))return false;return(!s||d>=s)&&(!e||d<=e);});},[movements,filter,from,to,date]);
  const filters=[["hoy","Hoy"],["semana","Semana"],["rango","Rango"],["fecha","Fecha"],["todo","Todo"]];
  const style={ingreso:{label:"Ingreso",cls:"move-income",sign:"+"},retiro:{label:"Retiro",cls:"move-out",sign:"-"},ajuste:{label:"Ajuste",cls:"move-adjust",sign:""}};
  return <div className="page-stack"><div className="page-title-row"><h1>Historial</h1><Button variant="outline" className="csv-button" onClick={()=>exportCSV(list)} disabled={!list.length}><Download size={16}/>CSV</Button></div>
    <div className="filter-row">{filters.map(f=><button key={f[0]} className={"filter-chip "+(filter===f[0]?"selected":"")} onClick={()=>setFilter(f[0])}>{f[1]}</button>)}</div>
    {filter==="rango"&&<div className="date-pair"><Field label="Desde" type="date" value={from} onChange={e=>setFrom(e.target.value)}/><Field label="Hasta" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>}
    {filter==="fecha"&&<Field label="Seleccionar fecha" type="date" value={date} onChange={e=>setDate(e.target.value)}/>}
    {!list.length?<div className="empty-state"><HistoryIcon size={39}/><p>Sin movimientos para este filtro.</p></div>:<div className="movement-list">{list.map(m=>{const t=style[m.tipo]||style.ajuste;return <article className="movement-row" key={m.id}><div className="movement-date"><span>{fmtDate(m.created_date)}</span><strong>{fmtTime(m.created_date)}</strong></div><div className="movement-info"><span className={"move-pill "+t.cls}>{t.label}</span>{m.nota&&<p>{m.nota}</p>}{m.tipo==="ajuste"&&<small>Físico: {m.cantidad_fisica} · Anterior: {m.cantidad_anterior}</small>}</div><div className="movement-amount"><strong>{t.sign+Math.abs(m.cantidad)}</strong><span>Stock: {m.stock_resultante}</span></div></article>;})}</div>}
  </div>;
}
function CalendarPage({movements}) {
  const now=new Date();const [year,setYear]=useState(now.getFullYear()),[month,setMonth]=useState(now.getMonth()),[selected,setSelected]=useState(now.getDate());
  const grouped=useMemo(()=>{const map={};movements.filter(m=>{const d=new Date(m.created_date);return d.getFullYear()===year&&d.getMonth()===month;}).forEach(m=>{const day=new Date(m.created_date).getDate();if(!map[day])map[day]={ingresos:0,retiros:0,ajustes:0,count:0,stockFinal:m.stock_resultante,latest:""};if(m.tipo==="ingreso")map[day].ingresos+=m.cantidad;else if(m.tipo==="retiro")map[day].retiros+=m.cantidad;else map[day].ajustes++;map[day].count++;if(!map[day].latest||new Date(m.created_date)>new Date(map[day].latest)){map[day].latest=m.created_date;map[day].stockFinal=m.stock_resultante;}});return map;},[movements,year,month]);
  const offset=(new Date(year,month,1).getDay()+6)%7,totalDays=new Date(year,month+1,0).getDate();
  const cells=[...Array(offset).fill(null),...Array.from({length:totalDays},(_,i)=>i+1)];
  const change=d=>{const next=new Date(year,month+d,1);setYear(next.getFullYear());setMonth(next.getMonth());setSelected(null);};
  const data=selected?grouped[selected]:null;
  return <div className="page-stack"><h1>Calendario</h1><Card className="calendar-card"><div className="calendar-header"><button className="icon-button" onClick={()=>change(-1)} aria-label="Mes anterior"><ChevronLeft size={21}/></button><strong>{MONTHS[month]} {year}</strong><button className="icon-button" onClick={()=>change(1)} aria-label="Mes siguiente"><ChevronRight size={21}/></button></div>
    <div className="calendar-grid weekday-grid">{DAYS.map(d=><span key={d}>{d}</span>)}</div><div className="calendar-grid day-grid">{cells.map((d,i)=>d===null?<span className="calendar-blank" key={"blank-"+i}/>:<button key={d} onClick={()=>setSelected(d)} className={"calendar-day "+(selected===d?"chosen ":"")+(d===now.getDate()&&month===now.getMonth()&&year===now.getFullYear()?"today ":"")+(grouped[d]?"has-movement":"")}><span>{d}</span>{grouped[d]&&selected!==d&&<i className="day-dots">{grouped[d].ingresos>0&&<b className="dot-income"/>}{grouped[d].retiros>0&&<b className="dot-out"/>}</i>}</button>)}</div>
    <div className="legend"><span><i className="dot-income"/>Ingresos</span><span><i className="dot-out"/>Retiros</span></div></Card>
    {selected!==null&&<Card className="day-detail"><h2>{selected} de {MONTHS[month]} {year}</h2>{data?<div className="detail-list"><div><span>Total ingresado</span><strong className="green">+{data.ingresos}</strong></div><div><span>Total retirado</span><strong className="orange">-{data.retiros}</strong></div>{data.ajustes>0&&<div><span>Ajustes físicos</span><strong>{data.ajustes}</strong></div>}<div><span>Movimientos</span><strong>{data.count}</strong></div><div><span>Stock final del día</span><strong>{data.stockFinal} lomos</strong></div></div>:<p className="muted">Sin movimientos este día.</p>}</Card>}
  </div>;
}
function SettingsPage({config,onSave,onRecount}) {
  const [threshold,setThreshold]=useState(String(config.umbral_bajo??10)),[saving,setSaving]=useState(false);
  useEffect(()=>setThreshold(String(config.umbral_bajo??10)),[config.umbral_bajo]);
  const n=intInput(threshold),valid=n!==null;
  const save=()=>{if(!valid||saving)return;setSaving(true);try{onSave(n);}finally{setSaving(false);}};
  return <div className="page-stack"><h1>Ajustes</h1><Card className="settings-card"><div className="section-heading"><ClipboardCheck size={19}/><h2>Recuento físico</h2></div><p className="description">Cuenta los lomos reales en cámara. Se guardará un ajuste con la diferencia sin borrar el historial anterior.</p><Button onClick={onRecount} className="full-width tall-button">Hacer recuento</Button></Card>
    <Card className="settings-card"><div className="section-heading"><SlidersHorizontal size={19}/><h2>Umbral de stock bajo</h2></div><p className="description">Cuando el stock sea igual o inferior a este número se mostrará la alerta de reposición.</p><Field label="Lomos" type="number" min="0" step="1" inputMode="numeric" value={threshold} onChange={e=>setThreshold(e.target.value)}/><Button onClick={save} disabled={!valid||saving} className="full-width settings-save">{saving?"Guardando…":"Guardar umbral"}</Button></Card>
    <Card className="stock-info"><div><span>Stock inicial</span><strong>{config.stock_inicial} lomos</strong></div><div><span>Stock actual</span><strong>{config.stock_actual} lomos</strong></div></Card><p className="storage-note"><CheckCircle2 size={15}/> Los datos se guardan en este dispositivo. Exporta el historial CSV periódicamente como respaldo.</p>
  </div>;
}
