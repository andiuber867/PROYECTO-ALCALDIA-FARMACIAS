import { branches } from "./data.js?v=5";
import { loadState, loadSharedState, saveState } from "./store.js?v=7";

let state = loadState();
let role = "admin";
let branchFilter = "all";
let saleType = "normal";
let cart = [];
let auditView = "sales";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const branchName = (id) => branches.find((b) => b.id === id)?.name || "Todas las sucursales";
const money = (n) => `Bs ${Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateFmt = (value) => new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
const dateTimeFmt = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Sin fecha", time: "--:--" };
  return {
    date: new Intl.DateTimeFormat("es-BO", { day:"2-digit", month:"short", year:"numeric" }).format(date),
    time: new Intl.DateTimeFormat("es-BO", { hour:"2-digit", minute:"2-digit", hour12:false }).format(date),
  };
};
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const daysTo = (value) => Math.ceil((new Date(`${value}T12:00:00`) - new Date()) / 86400000);
const initials = (name) => name.split(" ").slice(0, 2).map((x) => x[0]).join("").toUpperCase();
const currentMonth = () => new Date().toISOString().slice(0, 7);
const inBranch = (item, selected = branchFilter) => selected === "all" || item.branchId === selected;

function expiryState(expiry) {
  const days = daysTo(expiry);
  if (days <= 90) return { key: "red", label: days < 0 ? "Vencido" : "Hasta 3 meses", days };
  if (days <= 180) return { key: "yellow", label: "Hasta 6 meses", days };
  return { key: "green", label: "Vigente", days };
}

function showToast(title, message) {
  $("#toastTitle").textContent = title;
  $("#toastMessage").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => $("#toast").classList.remove("show"), 3400);
}

function updateSyncStatus({ status, message }) {
  const dot = $(".system-dot");
  const label = $("#syncStatus");
  dot?.classList.toggle("syncing", status === "syncing");
  dot?.classList.toggle("offline", status === "local");
  if (label) label.textContent = message;
}

function fillBranchSelects() {
  const all = `<option value="all">Todas las sucursales</option>`;
  const options = branches.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
  $("#branchSelect").innerHTML = all + options;
  $("#reportBranch").innerHTML = all + options;
  $("#entryBranch").innerHTML = options;
  $("#userBranch").innerHTML = options;
  $("#entryBranch").value = "santa-fe";
  $("#userBranch").value = "santa-fe";
}

function navigate(view) {
  const access = { dashboard: ["admin"], inventory: ["admin", "vendedor"], sales: ["admin", "vendedor"], entries: ["admin", "tecnico"], reports: ["admin"], users: ["admin"] };
  if (access[view] && !access[view].includes(role)) {
    showToast("Acceso restringido", "Este módulo no está disponible para el rol seleccionado.");
    return;
  }
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === `view-${view}`));
  $$(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  $("#sidebar").classList.remove("open");
  $("#drawerBackdrop").classList.remove("mobile-nav");
  if (view === "inventory") renderInventory();
  if (view === "sales") renderSaleProducts();
  if (view === "reports") renderReports();
  if (view === "users") renderUsers();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyRole(goToRoleHome = false) {
  const profile = {
    admin: ["María Aguilera", "Administradora", "María"],
    tecnico: ["Carlos Rivero", "Técnico de farmacia", "Carlos"],
    vendedor: ["Ana Rojas", "Vendedora", "Ana"],
  }[role];
  $("#profileName").textContent = profile[0];
  $("#profileRole").textContent = profile[1];
  $("#greetingName").textContent = profile[2];
  $(".profile>span").textContent = initials(profile[0]);
  $$('[data-roles]').forEach((el) => {
    el.classList.toggle("hidden", !el.dataset.roles.split(",").includes(role));
  });
  $$(".admin-only").forEach((el) => el.classList.toggle("hidden", role !== "admin"));
  $$(".technician-only").forEach((el) => el.classList.toggle("hidden", role !== "tecnico"));
  const assignments = { tecnico: "san-carlos", vendedor: "santa-fe" };
  const roleHome = { admin: "dashboard", tecnico: "entries", vendedor: "inventory" };
  if (role === "admin") {
    if (goToRoleHome) branchFilter = "all";
  } else {
    branchFilter = assignments[role];
  }
  $("#branchSelect").value = branchFilter;
  $("#branchSelect").disabled = false;
  $("#branchSelect option[value='all']").disabled = role !== "admin";
  $("#branchSelect").title = role === "admin" ? "Filtrar por sucursal" : "Cambiar sucursal para la demostración";
  $("#entryBranch").disabled = role === "tecnico";
  if (role === "tecnico") $("#entryBranch").value = branchFilter;
  $("#entryBranchLabel").textContent = role === "tecnico" ? `Sucursal de prueba: ${branchName(branchFilter)}` : "Sucursal seleccionable";
  $("#inventorySubtitle").textContent = role === "vendedor"
    ? `Existencias, precios y vencimientos de la farmacia ${branchName(branchFilter)}.`
    : "Existencias, precios y vencimientos de cada sucursal.";
  $("#dashboardSubtitle").textContent = role === "admin"
    ? "Este es el movimiento consolidado de las seis farmacias."
    : `Actividad y existencias asignadas a la farmacia ${branchName(branchFilter)}.`;
  renderAll();
  const active = $(".nav-item.active")?.dataset.view;
  const allowed = { dashboard: ["admin"], inventory: ["admin", "vendedor"], sales: ["admin", "vendedor"], entries: ["admin", "tecnico"], reports: ["admin"], users: ["admin"] };
  if (goToRoleHome || (active && !allowed[active]?.includes(role))) navigate(roleHome[role]);
}

function metricCard(label, value, hint, icon, tone = "") {
  return `<article class="metric ${tone}"><div class="metric-head"><span>${label}</span><span class="metric-icon"><svg><use href="#${icon}"/></svg></span></div><strong>${value}</strong><small>${hint}</small></article>`;
}

function renderDashboard() {
  const inv = state.inventory.filter((x) => inBranch(x));
  const sales = state.sales.filter((x) => inBranch(x));
  const monthSales = sales.filter((x) => x.date.startsWith(currentMonth()));
  const revenue = monthSales.reduce((a, x) => a + x.total, 0);
  const susItems = monthSales.filter((x) => x.type === "sus").reduce((a, x) => a + x.items, 0);
  const low = inv.filter((x) => x.quantity <= 40).length;
  const alerts = inv.filter((x) => expiryState(x.expiry).key !== "green").length;
  $("#metricGrid").innerHTML = [
    metricCard("Ventas del mes", money(revenue), "<b>+12,4%</b> frente al mes anterior", "i-chart"),
    metricCard("Entregas por SUS", susItems.toLocaleString("es-BO"), "medicamentos entregados sin costo", "i-cart"),
    metricCard("Lotes en inventario", inv.length.toLocaleString("es-BO"), `${inv.reduce((a,x)=>a+x.quantity,0).toLocaleString("es-BO")} unidades disponibles`, "i-box"),
    metricCard("Alertas activas", alerts, `${low} lotes tienen existencias bajas`, "i-bell", alerts ? "warning" : ""),
  ].join("");
  renderMonthlyChart(sales);
  renderExpiryLists(inv);
  renderBranchCards();
}

function renderMonthlyChart(sales) {
  const values = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const rows = sales.filter((x) => x.date.startsWith(key));
    values.push({ label: new Intl.DateTimeFormat("es", { month: "short" }).format(d).replace(".", ""), normal: rows.filter(x=>x.type==="normal").reduce((a,x)=>a+x.total,0), sus: rows.filter(x=>x.type==="sus").reduce((a,x)=>a+x.items,0) * 7 });
  }
  const max = Math.max(1, ...values.flatMap((x) => [x.normal, x.sus]));
  $("#salesChart").innerHTML = values.map((x) => `<div class="chart-month" title="${x.label}: ${money(x.normal)}"><i class="bar-sales" style="height:${Math.max(4, x.normal/max*160)}px"></i><i class="bar-sus" style="height:${Math.max(4, x.sus/max*160)}px"></i><span>${x.label}</span></div>`).join("");
}

function renderExpiryLists(inv = state.inventory.filter((x) => inBranch(x))) {
  const expiring = inv.map((x) => ({ ...x, exp: expiryState(x.expiry) })).filter((x) => x.exp.key !== "green").sort((a,b)=>a.exp.days-b.exp.days);
  $("#alertCount").textContent = expiring.length;
  $("#inventoryBadge").textContent = expiring.length;
  const row = (x) => `<div class="expiry-item ${x.exp.key}"><i></i><div><strong>${x.name}</strong><small>${branchName(x.branchId)} · Lote ${x.lot}</small></div><time>${x.exp.days < 0 ? "Vencido" : `${x.exp.days} días`}</time></div>`;
  $("#expiryList").innerHTML = expiring.slice(0, 4).map(row).join("") || `<div class="empty-cart"><strong>Sin alertas</strong><p>No hay lotes próximos a vencer.</p></div>`;
  const red = expiring.filter((x) => x.exp.key === "red");
  const yellow = expiring.filter((x) => x.exp.key === "yellow");
  $("#drawerAlerts").innerHTML = `${red.length ? `<h3 class="alert-group-title">Atención inmediata</h3>${red.map(row).join("")}` : ""}${yellow.length ? `<h3 class="alert-group-title">Próximos seis meses</h3>${yellow.map(row).join("")}` : ""}` || `<div class="empty-cart"><strong>Todo al día</strong><p>No existen alertas activas.</p></div>`;
}

function renderBranchCards() {
  $("#branchCards").innerHTML = branches.map((b) => {
    const lots = state.inventory.filter((x) => x.branchId === b.id);
    const sales = state.sales.filter((x) => x.branchId === b.id && x.date.startsWith(currentMonth()));
    const total = sales.reduce((a,x)=>a+x.total,0);
    return `<button class="branch-card" data-branch="${b.id}"><div class="branch-card-head"><span>${b.code}</span><strong>${b.name}</strong></div><b>${money(total)}</b><small>${lots.reduce((a,x)=>a+x.quantity,0).toLocaleString("es-BO")} unidades</small></button>`;
  }).join("");
  $$(".branch-card").forEach((el) => el.addEventListener("click", () => { branchFilter = el.dataset.branch; $("#branchSelect").value = branchFilter; navigate("inventory"); }));
}

function renderInventory() {
  const query = $("#inventorySearch").value.trim().toLowerCase();
  const status = $("#expiryFilter").value;
  const rows = state.inventory.filter((x) => inBranch(x)).filter((x) => !query || `${x.name} ${x.lot}`.toLowerCase().includes(query)).filter((x) => status === "all" || expiryState(x.expiry).key === status).sort((a,b)=>new Date(a.expiry)-new Date(b.expiry));
  $("#inventoryCount").textContent = `${rows.length} lotes encontrados`;
  $("#inventoryTable").innerHTML = rows.map((x) => {
    const exp = expiryState(x.expiry);
    const price = x.priceConfigured === false ? `<span class="badge gray">Pendiente</span>` : `<strong>${money(x.salePrice)}</strong>${role === "admin" ? `<small>Margen ${x.margin ?? 30} %</small>` : ""}`;
    const adminCost = role === "admin" ? `<td><strong>${money(x.unitCost)}</strong><small>Costo registrado</small></td>` : "";
    const adminAction = role === "admin" ? `<td><button class="table-action" data-price-id="${x.id}">${x.priceConfigured === false ? "Definir precio" : "Editar margen"}</button></td>` : "";
    return `<tr><td><strong>${x.name}</strong><small>Ingreso: ${dateFmt(x.entryDate)}</small></td><td>${branchName(x.branchId)}</td><td>${x.lot}</td><td><span class="stock">${x.quantity}</span> unid.</td><td>${dateFmt(x.expiry)}</td>${adminCost}<td>${price}</td><td><span class="badge ${exp.key}">${exp.label}</span></td>${adminAction}</tr>`;
  }).join("") || `<tr><td colspan="${role === "admin" ? 9 : 7}"><div class="empty-cart"><strong>Sin resultados</strong><p>Prueba con otro término o filtro.</p></div></td></tr>`;
  $$('[data-price-id]').forEach((el) => el.addEventListener("click", () => openPriceDialog(el.dataset.priceId)));
}

function saleBranch() {
  return branchFilter === "all" ? "santa-fe" : branchFilter;
}

function renderSaleProducts() {
  const bid = saleBranch();
  $("#saleBranchLabel").textContent = branchName(bid);
  const products = state.inventory.filter((x) => x.branchId === bid && x.quantity > 0 && daysTo(x.expiry) >= 0 && (saleType === "sus" || (x.priceConfigured !== false && x.salePrice > 0))).sort((a,b)=>a.name.localeCompare(b.name));
  $("#saleProduct").innerHTML = products.map((x) => `<option value="${x.id}">${x.name} · ${x.lot} (${x.quantity} disp.)</option>`).join("");
  renderCart();
}

function itemPrice(item) {
  if (saleType === "sus") return 0;
  return item.salePrice;
}

function renderCart() {
  if (!cart.length) {
    $("#cartList").innerHTML = `<div class="empty-cart"><span><svg><use href="#i-cart"/></svg></span><strong>Aún no agregaste medicamentos</strong><p>Selecciona un lote disponible para comenzar.</p></div>`;
  } else {
    $("#cartList").innerHTML = cart.map((x, i) => `<div class="cart-row"><div><strong>${x.name}</strong><small>Lote ${x.lot} · ${x.quantity} unidad${x.quantity > 1 ? "es" : ""}</small></div><span></span><div class="cart-price">${saleType === "sus" ? "Sin costo" : money(itemPrice(x)*x.quantity)}</div><button class="remove-item" data-remove="${i}" aria-label="Quitar"><svg><use href="#i-close"/></svg></button></div>`).join("");
  }
  $$('[data-remove]').forEach((el) => el.addEventListener("click", () => { cart.splice(+el.dataset.remove, 1); renderCart(); }));
  const total = cart.reduce((a,x)=>a+itemPrice(x)*x.quantity,0);
  const profit = cart.reduce((a,x)=>a+Math.max(0,itemPrice(x)-x.unitCost)*x.quantity,0);
  $("#summaryItems").textContent = cart.reduce((a,x)=>a+x.quantity,0);
  $("#summarySubtotal").textContent = saleType === "sus" ? "Sin costo" : money(total);
  $("#summaryTotal").textContent = saleType === "sus" ? "Bs 0,00" : money(total);
  $("#summaryProfit").textContent = money(profit);
  $("#summaryTitle").textContent = saleType === "sus" ? "Entrega SUS" : "Venta normal";
  $(".sale-summary").classList.toggle("sus-mode", saleType === "sus");
}

function addToCart() {
  const product = state.inventory.find((x) => x.id === $("#saleProduct").value);
  const quantity = +$("#saleQuantity").value;
  if (!product || quantity < 1) return showToast("Dato incompleto", "Selecciona un medicamento y una cantidad válida.");
  const already = cart.filter((x)=>x.id===product.id).reduce((a,x)=>a+x.quantity,0);
  if (quantity + already > product.quantity) return showToast("Existencias insuficientes", `Solo hay ${product.quantity} unidades disponibles en este lote.`);
  cart.push({ ...product, quantity });
  $("#saleQuantity").value = 1;
  renderCart();
  showToast("Medicamento agregado", `${product.name} se añadió al movimiento.`);
}

function completeSale() {
  if (!cart.length) return showToast("Movimiento vacío", "Agrega al menos un medicamento antes de registrar.");
  const total = cart.reduce((a,x)=>a+itemPrice(x)*x.quantity,0);
  const profit = cart.reduce((a,x)=>a+Math.max(0,itemPrice(x)-x.unitCost)*x.quantity,0);
  const now = new Date();
  const lines = cart.map((line) => ({ inventoryId:line.id, name:line.name, lot:line.lot, quantity:line.quantity, unitPrice:+itemPrice(line).toFixed(2), unitCost:line.unitCost, subtotal:+(itemPrice(line)*line.quantity).toFixed(2) }));
  cart.forEach((line) => { const inv = state.inventory.find((x)=>x.id===line.id); inv.quantity -= line.quantity; });
  state.sales.unshift({ id:`MOV-${Date.now()}`, date:now.toISOString().slice(0,10), timestamp:now.toISOString(), branchId:saleBranch(), type:saleType, items:cart.reduce((a,x)=>a+x.quantity,0), total:+total.toFixed(2), profit:+profit.toFixed(2), responsible:$("#profileName").textContent, notes:$("#saleNotes").value.trim(), lines });
  saveState(state); cart = []; $("#saleNotes").value = "";
  renderAll(); renderSaleProducts();
  showToast(saleType === "sus" ? "Entrega SUS registrada" : "Venta registrada", "El inventario y los reportes se actualizaron correctamente.");
}

function submitEntry(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const expiry = data.get("expiry");
  if (new Date(expiry) <= new Date(data.get("entryDate"))) return showToast("Fechas no válidas", "El vencimiento debe ser posterior al ingreso.");
  const margin = role === "admin" ? +data.get("margin") : null;
  const unitCost = +data.get("unitCost");
  const now = new Date();
  const item = { id:`LOT-${Date.now()}`, name:data.get("name").trim(), lot:data.get("lot").trim().toUpperCase(), branchId:role === "tecnico" ? branchFilter : data.get("branch"), quantity:+data.get("quantity"), unitCost, salePrice:margin !== null ? +(unitCost * (1 + margin / 100)).toFixed(2) : 0, margin, priceConfigured:role === "admin", entryDate:data.get("entryDate"), expiry };
  state.inventory.unshift(item);
  state.entries ||= [];
  state.entries.unshift({ id:`ING-${Date.now()}`, date:item.entryDate, timestamp:now.toISOString(), branchId:item.branchId, inventoryId:item.id, name:item.name, lot:item.lot, quantity:item.quantity, unitCost:item.unitCost, expiry:item.expiry, responsible:$("#profileName").textContent });
  saveState(state); event.currentTarget.reset(); $("#entryForm [name='entryDate']").value = new Date().toISOString().slice(0,10);
  if (role === "tecnico") $("#entryBranch").value = branchFilter;
  renderAll(); showToast("Lote guardado", role === "tecnico" ? "Quedó pendiente de precio para que administración lo habilite para ventas." : "El medicamento ya está disponible en el inventario de la sucursal.");
}

function openPriceDialog(productId) {
  const product = state.inventory.find((x) => x.id === productId);
  if (!product || role !== "admin") return;
  $("#priceForm [name='productId']").value = product.id;
  $("#priceProductName").textContent = product.name;
  $("#priceProductMeta").textContent = `${branchName(product.branchId)} · Lote ${product.lot}`;
  $("#priceUnitCost").textContent = money(product.unitCost);
  $("#priceForm [name='margin']").value = Number(product.margin ?? 30);
  updatePricePreview();
  $("#priceDialog").showModal();
}

function updatePricePreview() {
  const product = state.inventory.find((x) => x.id === $("#priceForm [name='productId']").value);
  const margin = Number($("#priceForm [name='margin']").value);
  $("#priceResult").textContent = product && Number.isFinite(margin) && margin >= 0 ? money(product.unitCost * (1 + margin / 100)) : money(0);
}

function submitPrice(event) {
  event.preventDefault();
  if (role !== "admin") return;
  const data = new FormData(event.currentTarget);
  const product = state.inventory.find((x) => x.id === data.get("productId"));
  if (!product) return;
  const margin = Number(data.get("margin"));
  if (!Number.isFinite(margin) || margin < 0) return showToast("Margen no válido", "Ingresa un porcentaje igual o mayor a cero.");
  product.margin = margin;
  product.salePrice = +(product.unitCost * (1 + product.margin / 100)).toFixed(2);
  product.priceConfigured = true;
  saveState(state);
  $("#priceDialog").close();
  renderAll();
  renderSaleProducts();
  showToast("Precio protegido", `${product.name} quedó configurado con ${product.margin} % de ganancia.`);
}

function reportRows() {
  const month = $("#reportMonth").value || currentMonth();
  const bid = $("#reportBranch").value || "all";
  const type = $("#reportType").value || "all";
  const query = $("#reportSearch").value.trim().toLowerCase();
  return state.sales.filter((x) => x.date.startsWith(month) && inBranch(x, bid) && (type === "all" || x.type === type)).filter((x) => !query || `${x.id} ${x.responsible} ${x.notes || ""} ${(x.lines || []).map((line) => `${line.name} ${line.lot}`).join(" ")}`.toLowerCase().includes(query));
}

function reportEntries() {
  const month = $("#reportMonth").value || currentMonth();
  const bid = $("#reportBranch").value || "all";
  const query = $("#reportSearch").value.trim().toLowerCase();
  return (state.entries || []).filter((x) => x.date.startsWith(month) && inBranch(x, bid)).filter((x) => !query || `${x.id} ${x.responsible} ${x.name} ${x.lot}`.toLowerCase().includes(query));
}

function movementProducts(lines = []) {
  return lines.map((line) => `<div class="movement-product"><strong>${escapeHtml(line.name)}</strong><small>Lote ${escapeHtml(line.lot)} · ${line.quantity} unid.</small></div>`).join("") || `<span class="muted">Sin desglose disponible</span>`;
}

function openMovement(kind, id) {
  if (role !== "admin") return;
  if (kind === "sale") {
    const movement = state.sales.find((x) => x.id === id);
    if (!movement) return;
    const stamp = dateTimeFmt(movement.timestamp || `${movement.date}T12:00:00`);
    $("#movementTitle").textContent = movement.type === "sus" ? "Detalle de entrega SUS" : "Detalle de venta";
    $("#movementDetail").innerHTML = `<div class="movement-meta"><div><span>Código</span><strong>${escapeHtml(movement.id)}</strong></div><div><span>Fecha y hora</span><strong>${stamp.date} · ${stamp.time}</strong></div><div><span>Sucursal</span><strong>${branchName(movement.branchId)}</strong></div><div><span>Responsable</span><strong>${escapeHtml(movement.responsible)}</strong></div></div><h3>Medicamentos registrados</h3><div class="detail-lines">${(movement.lines || []).map((line) => `<div><span><strong>${escapeHtml(line.name)}</strong><small>Lote ${escapeHtml(line.lot)} · ${line.quantity} unidades × ${movement.type === "sus" ? "Sin costo" : money(line.unitPrice)}</small></span><b>${movement.type === "sus" ? "SUS" : money(line.subtotal)}</b></div>`).join("")}</div><div class="movement-totals"><span>Total de unidades <b>${movement.items}</b></span><span>Total cobrado <b>${movement.type === "sus" ? money(0) : money(movement.total)}</b></span><span>Ganancia estimada <b>${money(movement.profit)}</b></span></div>${movement.notes ? `<div class="movement-notes"><span>Observaciones</span><p>${escapeHtml(movement.notes)}</p></div>` : ""}`;
  } else {
    const entry = (state.entries || []).find((x) => x.id === id);
    if (!entry) return;
    const stamp = dateTimeFmt(entry.timestamp || `${entry.date}T12:00:00`);
    $("#movementTitle").textContent = "Detalle del ingreso de lote";
    $("#movementDetail").innerHTML = `<div class="movement-meta"><div><span>Código</span><strong>${escapeHtml(entry.id)}</strong></div><div><span>Fecha y hora</span><strong>${stamp.date} · ${stamp.time}</strong></div><div><span>Sucursal</span><strong>${branchName(entry.branchId)}</strong></div><div><span>Responsable</span><strong>${escapeHtml(entry.responsible)}</strong></div></div><h3>Información del lote</h3><div class="entry-detail-grid"><div><span>Medicamento</span><strong>${escapeHtml(entry.name)}</strong></div><div><span>Número de lote</span><strong>${escapeHtml(entry.lot)}</strong></div><div><span>Cantidad ingresada</span><strong>${entry.quantity} unidades</strong></div><div><span>Costo unitario</span><strong>${money(entry.unitCost)}</strong></div><div><span>Valor del ingreso</span><strong>${money(entry.unitCost * entry.quantity)}</strong></div><div><span>Vencimiento</span><strong>${dateFmt(entry.expiry)}</strong></div></div>`;
  }
  $("#movementDialog").showModal();
}

function renderReports() {
  const rows = reportRows();
  const entries = reportEntries();
  const normal = rows.filter((x)=>x.type==="normal");
  const sus = rows.filter((x)=>x.type==="sus");
  const revenue = normal.reduce((a,x)=>a+x.total,0);
  const profit = normal.reduce((a,x)=>a+x.profit,0);
  $("#reportMetrics").innerHTML = [metricCard("Dinero recaudado", money(revenue), `${normal.length} ventas registradas`, "i-chart"),metricCard("Ganancia estimada", money(profit), "Visible solo para administración", "i-grid"),metricCard("Unidades entregadas", rows.reduce((a,x)=>a+x.items,0), `${sus.reduce((a,x)=>a+x.items,0)} corresponden al SUS`, "i-cart"),metricCard("Lotes ingresados", entries.length, `${entries.reduce((a,x)=>a+x.quantity,0).toLocaleString("es-BO")} unidades recibidas`, "i-box")].join("");
  const totals = branches.map((b)=>({ ...b, value: rows.filter(x=>x.branchId===b.id).reduce((a,x)=>a+x.total,0) }));
  const max = Math.max(1,...totals.map(x=>x.value));
  $("#branchBarChart").innerHTML = totals.map((x)=>`<div class="branch-bar"><span>${x.name}</span><div><i style="width:${x.value/max*100}%"></i></div><b>${money(x.value)}</b></div>`).join("");
  const normalCount = normal.reduce((a,x)=>a+x.items,0); const susCount=sus.reduce((a,x)=>a+x.items,0); const all=Math.max(1,normalCount+susCount); const pct=Math.round(normalCount/all*100);
  $("#donutChart").innerHTML = `<div class="donut" style="background:conic-gradient(var(--green-700) 0 ${pct}%, #b9dc43 ${pct}% 100%)"><div class="donut-center"><strong>${normalCount+susCount}</strong><span>ítems</span></div></div><div class="donut-legend"><div><i style="background:var(--green-700)"></i>Venta normal · ${pct}%</div><div><i style="background:#b9dc43"></i>SUS · ${100-pct}%</div></div>`;
  $("#salesAuditCount").textContent = rows.length;
  $("#entryAuditCount").textContent = entries.length;
  $$('[data-audit-view]').forEach((button) => button.classList.toggle("active", button.dataset.auditView === auditView));
  if (auditView === "sales") {
    $("#auditTitle").textContent = "Ventas y entregas SUS";
    $("#reportRowsLabel").textContent = `${rows.length} movimientos con responsable y desglose por lote`;
    $("#reportTableHead").innerHTML = `<tr><th>Fecha y hora</th><th>Responsable</th><th>Sucursal</th><th>Tipo</th><th>Medicamentos / lotes</th><th>Cantidad</th><th>Total</th><th></th></tr>`;
    $("#reportTable").innerHTML = [...rows].sort((a,b)=>(b.timestamp || b.date).localeCompare(a.timestamp || a.date)).map((x)=>{ const stamp=dateTimeFmt(x.timestamp || `${x.date}T12:00:00`); return `<tr><td><strong>${stamp.date}</strong><small>${stamp.time} · ${escapeHtml(x.id)}</small></td><td><strong>${escapeHtml(x.responsible)}</strong><small>Vendedor responsable</small></td><td>${branchName(x.branchId)}</td><td><span class="badge ${x.type}">${x.type === "sus" ? "Entrega SUS" : "Venta"}</span></td><td class="products-cell">${movementProducts(x.lines)}</td><td><strong>${x.items} unid.</strong></td><td><strong>${x.type === "sus" ? money(0) : money(x.total)}</strong><small>${x.type === "sus" ? "Sin cobro" : `Ganancia ${money(x.profit)}`}</small></td><td><button class="table-action" data-movement-kind="sale" data-movement-id="${x.id}">Ver detalle</button></td></tr>`; }).join("") || `<tr><td colspan="8"><div class="empty-cart"><strong>Sin movimientos</strong><p>No hay ventas o entregas con estos filtros.</p></div></td></tr>`;
  } else {
    $("#auditTitle").textContent = "Ingresos de medicamentos por lote";
    $("#reportRowsLabel").textContent = `${entries.length} ingresos con trazabilidad de responsable, costo y vencimiento`;
    $("#reportTableHead").innerHTML = `<tr><th>Fecha y hora</th><th>Responsable</th><th>Sucursal</th><th>Medicamento</th><th>Lote</th><th>Cantidad</th><th>Costo / valor</th><th>Vencimiento</th><th></th></tr>`;
    $("#reportTable").innerHTML = [...entries].sort((a,b)=>(b.timestamp || b.date).localeCompare(a.timestamp || a.date)).map((x)=>{ const stamp=dateTimeFmt(x.timestamp || `${x.date}T12:00:00`); return `<tr><td><strong>${stamp.date}</strong><small>${stamp.time} · ${escapeHtml(x.id)}</small></td><td><strong>${escapeHtml(x.responsible)}</strong><small>Registró el lote</small></td><td>${branchName(x.branchId)}</td><td><strong>${escapeHtml(x.name)}</strong></td><td>${escapeHtml(x.lot)}</td><td><strong>${x.quantity} unid.</strong></td><td><strong>${money(x.unitCost)}</strong><small>Total ${money(x.unitCost*x.quantity)}</small></td><td>${dateFmt(x.expiry)}</td><td><button class="table-action" data-movement-kind="entry" data-movement-id="${x.id}">Ver detalle</button></td></tr>`; }).join("") || `<tr><td colspan="9"><div class="empty-cart"><strong>Sin ingresos</strong><p>No hay lotes ingresados con estos filtros.</p></div></td></tr>`;
  }
  $$('[data-movement-id]').forEach((button) => button.addEventListener("click", () => openMovement(button.dataset.movementKind, button.dataset.movementId)));
}

function exportReport() {
  const rows = reportRows();
  const entries = reportEntries();
  const body = rows.flatMap((x)=>(x.lines || []).map((line)=>`<tr><td>${x.date}</td><td>${dateTimeFmt(x.timestamp).time}</td><td>${x.id}</td><td>${branchName(x.branchId)}</td><td>${x.type.toUpperCase()}</td><td>${line.name}</td><td>${line.lot}</td><td>${line.quantity}</td><td>${line.unitPrice}</td><td>${line.subtotal}</td><td>${x.profit}</td><td>${x.responsible}</td></tr>`)).join("");
  const entryBody = entries.map((x)=>`<tr><td>${x.date}</td><td>${dateTimeFmt(x.timestamp).time}</td><td>${x.id}</td><td>${branchName(x.branchId)}</td><td>${x.name}</td><td>${x.lot}</td><td>${x.quantity}</td><td>${x.unitCost}</td><td>${x.unitCost*x.quantity}</td><td>${x.expiry}</td><td>${x.responsible}</td></tr>`).join("");
  const html = `<html><head><meta charset="UTF-8"></head><body><table border="1"><tr><th colspan="12">Ventas y entregas SUS · Farmacias Municipales de San Carlos</th></tr><tr><th>Fecha</th><th>Hora</th><th>Código</th><th>Sucursal</th><th>Tipo</th><th>Medicamento</th><th>Lote</th><th>Cantidad</th><th>Precio unitario Bs</th><th>Subtotal Bs</th><th>Ganancia Bs</th><th>Responsable</th></tr>${body}</table><br/><table border="1"><tr><th colspan="11">Ingresos de lotes</th></tr><tr><th>Fecha</th><th>Hora</th><th>Código</th><th>Sucursal</th><th>Medicamento</th><th>Lote</th><th>Cantidad</th><th>Costo unitario Bs</th><th>Valor total Bs</th><th>Vencimiento</th><th>Responsable</th></tr>${entryBody}</table></body></html>`;
  const blob = new Blob([html], { type:"application/vnd.ms-excel;charset=utf-8" });
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`reporte-farmacias-${$("#reportMonth").value || currentMonth()}.xls`; a.click(); URL.revokeObjectURL(a.href);
  showToast("Reporte exportado", "El archivo compatible con Excel se descargó correctamente.");
}

function renderUsers() {
  const query = $("#userSearch").value.trim().toLowerCase();
  const users = state.users.filter((x)=>`${x.name} ${x.email}`.toLowerCase().includes(query));
  const roles = [{ key:"admin",title:"Administradores",desc:"Acceso total y reportes",icon:"i-lock"},{key:"tecnico",title:"Técnicos",desc:"Ingreso y consulta de inventario",icon:"i-box"},{key:"vendedor",title:"Vendedores",desc:"Ventas, SUS y consulta",icon:"i-cart"}];
  $("#roleSummary").innerHTML = roles.map((r)=>`<article class="role-card"><span><svg><use href="#${r.icon}"/></svg></span><div><h3>${r.title}</h3><p>${r.desc}</p><b>${state.users.filter(x=>x.role===r.key).length} usuarios</b></div></article>`).join("");
  $("#userCount").textContent=`${users.length} usuarios`;
  const labels={admin:"Administrador",tecnico:"Técnico",vendedor:"Vendedor"};
  $("#usersTable").innerHTML=users.map((x)=>`<tr><td><div class="user-cell"><span class="user-avatar">${initials(x.name)}</span><div><strong>${x.name}</strong><small>${x.email}</small></div></div></td><td>${labels[x.role]}</td><td>${x.branchId==="all"?"Todas":branchName(x.branchId)}</td><td><span class="badge ${x.active?"green":"gray"}">${x.active?"Activo":"Inactivo"}</span></td><td>${x.lastAccess}</td></tr>`).join("");
}

function submitUser(event) {
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  state.users.push({ id:`U-${Date.now()}`,name:data.get("name").trim(),email:data.get("email").trim(),role:data.get("role"),branchId:data.get("role")==="admin"?"all":data.get("branch"),active:true,lastAccess:"Aún no ingresó" });
  saveState(state); $("#userDialog").close(); event.currentTarget.reset(); renderUsers(); showToast("Usuario creado", "El nuevo acceso se agregó correctamente a la demo.");
}

function renderAll() {
  renderDashboard(); renderInventory(); renderExpiryLists();
  if ($("#view-reports").classList.contains("active")) renderReports();
  if ($("#view-users").classList.contains("active")) renderUsers();
}

function registerWebMCP() {
  const context=document.modelContext;
  if (!context?.registerTool) return;
  try {
    context.registerTool({ name:"consultar_inventario",title:"Consultar inventario",description:"Consulta los lotes disponibles de una sucursal de las farmacias municipales.",inputSchema:{type:"object",properties:{sucursal:{type:"string",enum:branches.map(x=>x.id)}},required:["sucursal"],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:({sucursal})=>state.inventory.filter(x=>x.branchId===sucursal).map(x=>({medicamento:x.name,lote:x.lot,existencias:x.quantity,vencimiento:x.expiry})) });
  } catch (_) { /* Browser without full WebMCP support */ }
}

function bindEvents() {
  window.addEventListener("pharmacy-sync", (event) => updateSyncStatus(event.detail));
  $$(".nav-item,[data-go]").forEach((el)=>el.addEventListener("click",()=>navigate(el.dataset.view||el.dataset.go)));
  $("#roleSelect").addEventListener("change",(e)=>{role=e.target.value;cart=[];applyRole(true);});
  $("#branchSelect").addEventListener("change",(e)=>{
    branchFilter=e.target.value;
    cart=[];
    if(role === "tecnico") {
      $("#entryBranch").value = branchFilter;
      $("#entryBranchLabel").textContent = `Sucursal de prueba: ${branchName(branchFilter)}`;
    }
    if(role === "vendedor") {
      $("#inventorySubtitle").textContent = `Existencias, precios y vencimientos de la farmacia ${branchName(branchFilter)}.`;
    }
    renderAll();
    renderSaleProducts();
  });
  $("#inventorySearch").addEventListener("input",renderInventory); $("#expiryFilter").addEventListener("change",renderInventory);
  $$('[data-sale-type]').forEach((el)=>el.addEventListener("click",()=>{saleType=el.dataset.saleType;cart=[];$$('[data-sale-type]').forEach(x=>x.classList.toggle("active",x===el));renderSaleProducts();}));
  $("#addToCart").addEventListener("click",addToCart); $("#completeSale").addEventListener("click",completeSale); $("#entryForm").addEventListener("submit",submitEntry);
  $("#reportMonth").addEventListener("change",renderReports); $("#reportBranch").addEventListener("change",renderReports); $("#reportType").addEventListener("change",renderReports); $("#reportSearch").addEventListener("input",renderReports); $("#exportReport").addEventListener("click",exportReport);
  $$('[data-audit-view]').forEach((button) => button.addEventListener("click", () => { auditView=button.dataset.auditView; renderReports(); }));
  $("#userSearch").addEventListener("input",renderUsers); $("#newUserButton").addEventListener("click",()=>$("#userDialog").showModal()); $("#userForm").addEventListener("submit",submitUser);
  $("#priceForm [name='margin']").addEventListener("input", updatePricePreview); $("#priceForm").addEventListener("submit", submitPrice);
  $$('[data-close-price]').forEach((el) => el.addEventListener("click", () => $("#priceDialog").close()));
  $$('[data-close-movement]').forEach((el) => el.addEventListener("click", () => $("#movementDialog").close()));
  $$('[data-close-user]').forEach((el) => el.addEventListener("click", () => $("#userDialog").close()));
  const openAlerts=()=>{$("#alertDrawer").classList.add("open");$("#drawerBackdrop").classList.add("open");}; const closeAlerts=()=>{$("#alertDrawer").classList.remove("open");$("#drawerBackdrop").classList.remove("open");};
  $("#notificationButton").addEventListener("click",openAlerts); $("#closeAlerts").addEventListener("click",closeAlerts); $("#drawerBackdrop").addEventListener("click",()=>{closeAlerts();$("#sidebar").classList.remove("open");$("#drawerBackdrop").classList.remove("mobile-nav");});
  $("#menuButton").addEventListener("click",()=>{$("#sidebar").classList.toggle("open");$("#drawerBackdrop").classList.toggle("mobile-nav");});
}

async function hydrateSharedState(showUpdate = false) {
  const shared = await loadSharedState(state, !showUpdate);
  if (!shared) return;
  const changed = shared.sharedUpdatedAt && shared.sharedUpdatedAt !== state.sharedUpdatedAt;
  state = shared;
  renderAll();
  if ($("#view-sales").classList.contains("active")) renderSaleProducts();
  if (showUpdate && changed) showToast("Datos actualizados", "Se cargaron movimientos realizados desde otro dispositivo.");
}

fillBranchSelects();
$("#reportMonth").value=currentMonth();
$("#entryForm [name='entryDate']").value=new Date().toISOString().slice(0,10);
const minExpiry=new Date();minExpiry.setDate(minExpiry.getDate()+1);$("#entryForm [name='expiry']").min=minExpiry.toISOString().slice(0,10);
bindEvents(); applyRole(); renderSaleProducts(); registerWebMCP();
hydrateSharedState();
setInterval(() => { if (document.visibilityState === "visible") hydrateSharedState(true); }, 15000);
window.addEventListener("focus", () => hydrateSharedState(true));
