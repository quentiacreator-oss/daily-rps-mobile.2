// RPG du Quotidien — Mobile (single currency: Gemmes, intensité, paliers XP, historique, export/import)
// Data persisted locally (localStorage). PWA-ready.

const STORAGE_KEY = "rpg_quotidien_v1";

const TITLES = [
  "Novice","Aspirant","Aventurier","Vétéran","Héros","Champion","Maître","Grand Maître","Légende"
];

const DEFAULT_DATA = {
  version: "1.0",
  profile: {
    name: "Joueur",
    level: 1,
    xp: 0,
    gems: 0,
  },
  systems: {
    xpCurveBase: 500, // XP needed formula: base * level^1.5
    // Intensité → base XP & gems
    intensity: {
      leger:  { label:"Léger",   baseXP:80,  gems:1 },
      modere: { label:"Modéré",  baseXP:130, gems:2 },
      intense:{ label:"Intense", baseXP:190, gems:3 },
      epique: { label:"Épique",  baseXP:260, gems:4 },
    },
    // Routines par défaut
    routines: [
      { id:"rt_tidy_15",   title:"Rangement 15 min",          intensity:"leger"  },
      { id:"rt_dishes",    title:"Vaisselle + plan propre",    intensity:"leger"  },
      { id:"rt_mobility",  title:"Mobilité / étirements 10’",  intensity:"leger"  },
      { id:"rt_focus25",   title:"Focus 25’ (1 pomodoro)",     intensity:"modere" },
      { id:"rt_walk20",    title:"Marche active 20–30’",       intensity:"modere" },
      { id:"rt_admin10",   title:"Admin 10’ (papiers/factures)", intensity:"leger" },
      { id:"rt_read15",    title:"Lecture 10 pages / 15’",     intensity:"leger"  }
    ],
    // Boutique simple (coûts en gemmes)
    shop: [
      { id:"sh_coffee", label:"Pause café premium", cost:10 },
      { id:"sh_movie",  label:"Soirée film",       cost:25 },
      { id:"sh_dayoff", label:"Journée off planifiée", cost:40 },
      { id:"sh_restaurant", label:"Sortie resto",  cost:60 }
    ],
    historyLimit: 10
  },
  tasks: [], // {id,title,intensity,createdAt,doneCountToday}
  log: []    // {id,title,intensity,xp,gems,dateISO}
};

// --- Utils
const $ = sel => document.querySelector(sel);
const todayISO = () => new Date().toISOString().slice(0,10);

function load(){
  try{
    const s = localStorage.getItem(STORAGE_KEY);
    if(!s) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(s);
    // Merge defaults in case of update
    return deepMerge(structuredClone(DEFAULT_DATA), parsed);
  }catch(e){ return structuredClone(DEFAULT_DATA); }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA)); }

function deepMerge(base, incoming){
  for(const k in incoming){
    if(incoming[k] && typeof incoming[k] === "object" && !Array.isArray(incoming[k])){
      base[k] = deepMerge(base[k] || {}, incoming[k]);
    }else{
      base[k] = incoming[k];
    }
  }
  return base;
}

function xpNeeded(level, base){
  return Math.round(base * Math.pow(level, 1.5));
}

function levelTitle(level){
  return TITLES[Math.min(TITLES.length-1, Math.floor((level-1)/1))];
}

function addHistory(entry){
  DATA.log.unshift(entry);
  if(DATA.log.length > DATA.systems.historyLimit){
    DATA.log = DATA.log.slice(0, DATA.systems.historyLimit);
  }
}

// --- Render
const dateLabel = $("#dateLabel");
const nameInput = $("#profileName");
const gemsEl = $("#gems");
const levelEl = $("#level");
const titleEl = $("#title");
const xpHintEl = $("#xpHint");
const xpFillEl = $("#xpFill");

const taskTitle = $("#taskTitle");
const intensitySel = $("#intensity");
const addTaskBtn = $("#addTaskBtn");
const tasksList = $("#tasksList");
const emptyTasks = $("#emptyTasks");

const routinesList = $("#routinesList");
const historyList = $("#history");
const emptyHistory = $("#emptyHistory");

const exportBtn = $("#exportBtn");
const importInput = $("#importInput");
const resetBtn = $("#resetBtn");

function renderHeader(){
  const d = new Date();
  dateLabel.textContent = d.toLocaleDateString("fr-FR", {weekday:"long", day:"2-digit", month:"long"});
}

function renderProfile(){
  nameInput.value = DATA.profile.name || "";
  gemsEl.textContent = `${DATA.profile.gems} 💎`;
  levelEl.textContent = DATA.profile.level;
  titleEl.textContent = levelTitle(DATA.profile.level);
  const need = xpNeeded(DATA.profile.level, DATA.systems.xpCurveBase);
  xpHintEl.textContent = `${DATA.profile.xp} / ${need} XP`;
  const pct = Math.max(0, Math.min(100, Math.round(DATA.profile.xp / need * 100)));
  xpFillEl.style.width = pct + "%";
}

function renderTasks(){
  tasksList.innerHTML = "";
  const have = DATA.tasks.length>0;
  emptyTasks.classList.toggle("hidden", have);
  DATA.tasks.forEach(t => {
    const row = document.createElement("div");
    row.className = "goal";
    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("div");
    title.textContent = t.title;
    const chip = document.createElement("div");
    chip.className = "chip int-" + t.intensity;
    chip.textContent = DATA.systems.intensity[t.intensity].label;
    meta.append(title, chip);
    const btns = document.createElement("div");
    btns.className = "hstack";
    const val = document.createElement("button");
    const it = DATA.systems.intensity[t.intensity];
    val.className = "btn";
    val.textContent = `Valider +${it.baseXP} XP / +${it.gems}💎`;
    val.addEventListener("click", () => validateTask(t.id));
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "Supprimer";
    del.addEventListener("click", () => deleteTask(t.id));
    btns.append(val, del);
    row.append(meta, btns);
    tasksList.appendChild(row);
  });
}

function renderRoutines(){
  routinesList.innerHTML = "";
  DATA.systems.routines.forEach(rt => {
    const row = document.createElement("div");
    row.className = "routine";
    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("div");
    title.textContent = rt.title;
    const chip = document.createElement("div");
    chip.className = "chip int-" + rt.intensity;
    chip.textContent = DATA.systems.intensity[rt.intensity].label;
    meta.append(title, chip);
    const btn = document.createElement("button");
    const it = DATA.systems.intensity[rt.intensity];
    btn.className = "btn";
    btn.textContent = `+${it.baseXP} XP / +${it.gems}💎`;
    btn.addEventListener("click", () => validateRoutine(rt));
    row.append(meta, btn);
    routinesList.appendChild(row);
  });
}

function renderHistory(){
  historyList.innerHTML = "";
  const have = DATA.log.length>0;
  emptyHistory.classList.toggle("hidden", have);
  DATA.log.forEach(h => {
    const row = document.createElement("div");
    row.className = "history-item";
    const left = document.createElement("div");
    left.innerHTML = `<div style="font-weight:600">${h.title}</div><div class="small muted">${new Date(h.dateISO).toLocaleString("fr-FR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}</div>`;
    const right = document.createElement("div");
    right.className = "small";
    right.textContent = `+${h.xp} XP / +${h.gems}💎`;
    row.append(left, right);
    historyList.appendChild(row);
  });
}

function renderShop(){
  const container = document.getElementById("shop");
  container.innerHTML = "";
  DATA.systems.shop.forEach(item => {
    const row = document.createElement("div");
    row.className = "shop-item";
    const left = document.createElement("div");
    left.innerHTML = `<div style="font-weight:600">${item.label}</div><div class="small muted">${item.cost} 💎</div>`;
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Acheter";
    btn.addEventListener("click", () => buy(item));
    row.append(left, btn);
    container.appendChild(row);
  });
}

// --- Core logic
function addTask(){
  const title = taskTitle.value.trim();
  if(!title) return toast("Titre requis");
  DATA.tasks.unshift({
    id: "t_" + Date.now(),
    title,
    intensity: intensitySel.value,
    createdAt: new Date().toISOString(),
    doneCountToday: 0
  });
  taskTitle.value = "";
  save(); renderTasks();
}

function award(xp, gems){
  DATA.profile.xp += xp;
  DATA.profile.gems += gems;
  // Level loop
  const base = DATA.systems.xpCurveBase;
  while(DATA.profile.xp >= xpNeeded(DATA.profile.level, base)){
    DATA.profile.xp -= xpNeeded(DATA.profile.level, base);
    DATA.profile.level += 1;
    // bonus de niveau : +5 gemmes
    DATA.profile.gems += 5;
    toast(`Niveau ${DATA.profile.level} atteint ! +5💎`);
  }
}

function validateTask(taskId){
  const t = DATA.tasks.find(x=>x.id===taskId);
  if(!t) return;
  const it = DATA.systems.intensity[t.intensity];
  award(it.baseXP, it.gems);
  addHistory({ id: taskId, title: t.title, intensity: t.intensity, xp: it.baseXP, gems: it.gems, dateISO: new Date().toISOString() });
  save(); renderProfile(); renderHistory();
}

function validateRoutine(rt){
  const it = DATA.systems.intensity[rt.intensity];
  award(it.baseXP, it.gems);
  addHistory({ id: rt.id, title: rt.title, intensity: rt.intensity, xp: it.baseXP, gems: it.gems, dateISO: new Date().toISOString() });
  save(); renderProfile(); renderHistory();
}

function deleteTask(taskId){
  DATA.tasks = DATA.tasks.filter(x=>x.id!==taskId);
  save(); renderTasks();
}

function buy(item){
  if(DATA.profile.gems < item.cost) return toast("Gemmes insuffisantes");
  DATA.profile.gems -= item.cost;
  toast(`Achat: ${item.label} (-${item.cost}💎)`);
  save(); renderProfile();
}

// Export / Import / Reset
function exportJSON(){
  const blob = new Blob([JSON.stringify(DATA, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rpg-quotidien-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(String(reader.result));
      DATA = deepMerge(structuredClone(DEFAULT_DATA), parsed);
      save();
      renderAll();
      toast("Import réussi");
    }catch(e){ toast("Fichier invalide"); }
  };
  reader.readAsText(file);
}

function resetLocal(){
  if(confirm("Réinitialiser les données locales ?")){
    DATA = structuredClone(DEFAULT_DATA);
    save();
    renderAll();
  }
}

// UI helpers
function toast(msg){
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.position="fixed"; el.style.left="50%"; el.style.bottom="18px";
  el.style.transform="translateX(-50%)"; el.style.background="rgba(255,255,255,.1)";
  el.style.border="1px solid rgba(255,255,255,.25)"; el.style.padding="10px 14px";
  el.style.borderRadius="12px"; el.style.zIndex=9999; el.style.backdropFilter="blur(6px)";
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .4s"; }, 1400);
  setTimeout(()=>{ el.remove(); }, 1900);
}

// Navigation buttons scroll
document.querySelectorAll(".nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    const anchor = btn.getAttribute("data-goto");
    if(anchor==="top"){ window.scrollTo({top:0, behavior:"smooth"}); return; }
    if(anchor==="tasks"){ document.getElementById("tasksList").scrollIntoView({behavior:"smooth"}); return; }
    if(anchor==="history"){ document.getElementById("history").scrollIntoView({behavior:"smooth"}); return; }
    if(anchor==="shop"){ document.getElementById("shop").scrollIntoView({behavior:"smooth"}); return; }
  });
});

// Events
$("#addTaskBtn").addEventListener("click", addTask);
$("#exportBtn").addEventListener("click", exportJSON);
$("#importInput").addEventListener("change", (e)=>{
  const f = e.target.files?.[0]; if(f) importJSON(f);
});
$("#resetBtn").addEventListener("click", resetLocal);
$("#profileName").addEventListener("change", (e)=>{
  DATA.profile.name = e.target.value.trim() || "Joueur";
  save(); renderProfile();
});

// Init
let DATA = load();

function renderAll(){
  renderHeader(); renderProfile(); renderTasks(); renderRoutines(); renderHistory(); renderShop();
}
renderAll();

// PWA
if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}
