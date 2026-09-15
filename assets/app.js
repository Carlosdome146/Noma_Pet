let PRODUCTS=[];
let PRODUCT_SOURCE='d1';
let CATALOG_ERROR='';
let DETAIL_VARIANT_ID=null;

async function loadProducts(){
  CATALOG_ERROR='';
  try{
    const res=await fetch('/api/products',{headers:{Accept:'application/json'}});
    if(!res.ok) throw new Error('No se pudo cargar el catálogo.');
    const data=await res.json();
    if(!data?.ok||!Array.isArray(data.products)) throw new Error('Respuesta de catálogo no válida.');
    PRODUCTS=data.products;
  }catch(e){
    PRODUCTS=[];
    CATALOG_ERROR=e?.message||'No se pudo cargar el catálogo.';
  }
}

function money(n){return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(n||0))}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function normalizeCategory(value=''){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function productHref(p){return `/producto/${encodeURIComponent(p?.slug||p?.id||'')}`}
function productLogistics(p){const v=variantsOf(p).length?defaultVariant(p):null;const warehouse=v?.warehouse||p?.warehouse||'';const min=v?.shippingDaysMin??p?.shippingDaysMin??null;const max=v?.shippingDaysMax??p?.shippingDaysMax??null;const parts=[];if(warehouse)parts.push(`Envío desde ${warehouse}`);if(min!=null&&max!=null)parts.push(`${min}–${max} días`);return parts.join(' · ')}
function showCatalogMessage(message=''){const el=document.getElementById('catalogMessage');if(!el)return;el.hidden=!message;el.textContent=message}
function cart(){try{return JSON.parse(localStorage.getItem('noma-cart')||'[]')}catch(_){return []}}
function saveCart(c){localStorage.setItem('noma-cart',JSON.stringify(c));syncBadge()}
function cartItemKey(item){return `${item.id}::${item.variantId||''}`}
function variantsOf(p){return Array.isArray(p?.variants)?p.variants:[]}
function defaultVariant(p){const list=variantsOf(p);return list.find(v=>v.id===p.defaultVariantId)||list.find(v=>v.isDefault)||list[0]||null}
function variantById(p,id){if(!id)return defaultVariant(p);return variantsOf(p).find(v=>v.id===id)||defaultVariant(p)}
function itemPrice(p,variantId){const v=variantsOf(p).length?variantById(p,variantId):null;return v?Number(v.price||0):Number(p?.price||0)}
function itemName(p,variantId){const v=variantsOf(p).length?variantById(p,variantId):null;return v?`${p.name} · ${v.name}`:p.name}
function syncBadge(){document.querySelectorAll('.cartbadge').forEach(el=>el.textContent=cart().reduce((a,x)=>a+Number(x.qty||0),0))}

function add(id,qty=1,variantId=null){
  const p=PRODUCTS.find(x=>x.id===id);if(!p)return;
  let chosen=variantId;
  if(variantsOf(p).length){
    const v=variantById(p,chosen);
    if(!v){location.href=productHref(p);return}
    chosen=v.id;
    if(v.stockStatus==='out'){alert('Esta variante está agotada.');return}
  }
  const c=cart();const key=`${id}::${chosen||''}`;const hit=c.find(x=>cartItemKey(x)===key);
  hit?hit.qty+=qty:c.push({id,variantId:chosen||null,qty});saveCart(c);
  const b=document.querySelector(`[data-add="${CSS.escape(id)}"]`);if(b){const old=b.textContent;b.textContent='✓ Añadido';setTimeout(()=>b.textContent=old,1000)}
}

function productVisual(p){if(p.imageUrl)return `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy">`;return p.emoji||'🐾'}
function productPriceHtml(p){return p.hasVariants&&variantsOf(p).length>1?`<span class="price-prefix">Desde</span> ${money(p.priceFrom??p.price)}`:money(p.priceFrom??p.price)}
function productCard(p){
  const hasVariants=variantsOf(p).length>0;
  const href=productHref(p);
  const action=hasVariants
    ? `<a class="btn primary" href="${href}">Ver opciones</a>`
    : `<button class="btn primary" data-add="${escapeHtml(p.id)}" onclick="add('${String(p.id).replace(/'/g,"\\'")}')">Añadir</button>`;
  const logistics=productLogistics(p);
  return `<article class="product" data-cat="${escapeHtml(normalizeCategory(p.cat))}"><a href="${href}" class="photo"><span class="tag">${escapeHtml(p.tag||'Selección')}</span>${productVisual(p)}</a><div class="product-body"><h3><a href="${href}">${escapeHtml(p.name)}</a></h3><p>${escapeHtml(p.desc||'')}</p>${logistics?`<div class="product-logistics">${escapeHtml(logistics)}</div>`:''}<div class="price"><div><strong>${productPriceHtml(p)}</strong><div class="meta">${hasVariants?`${variantsOf(p).length} opciones · IVA incluido`:'IVA incluido'}</div></div>${action}</div></div></article>`
}
function renderProducts(target='products',limit){const el=document.getElementById(target);if(!el)return;if(CATALOG_ERROR){showCatalogMessage('No hemos podido cargar la tienda. Inténtalo de nuevo en unos instantes.');el.innerHTML='';return}if(!PRODUCTS.length){showCatalogMessage('Ahora mismo no hay productos publicados.');el.innerHTML='';return}el.innerHTML=PRODUCTS.slice(0,limit||PRODUCTS.length).map(productCard).join('')}
function applyFilter(cat='all'){cat=normalizeCategory(cat)||'all';document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',normalizeCategory(x.dataset.filter)===cat));document.querySelectorAll('.product').forEach(p=>p.style.display=(cat==='all'||normalizeCategory(p.dataset.cat)===cat)?'flex':'none')}
function initFilters(){document.querySelectorAll('.filter').forEach(f=>f.addEventListener('click',()=>applyFilter(f.dataset.filter)));const requested=new URLSearchParams(location.search).get('cat');if(requested&&document.querySelector(`[data-filter="${CSS.escape(normalizeCategory(requested))}"]`))applyFilter(requested)}
function productImages(p){if(Array.isArray(p.images)&&p.images.length)return p.images;if(p.imageUrl)return[{url:p.imageUrl,alt:p.name||''}];return[]}

function variantButtons(p,selectedId){
  const list=variantsOf(p);if(!list.length)return'';
  return `<div class="variant-selector"><span class="variant-label">Elige una opción</span><div class="variant-options">${list.map(v=>`<button type="button" class="variant-option ${v.id===selectedId?'active':''}" data-select-variant="${escapeHtml(v.id)}" ${v.stockStatus==='out'?'disabled':''}><b>${escapeHtml(v.name)}</b><span>${money(v.price)}</span>${v.stockStatus==='out'?'<small>Agotada</small>':''}</button>`).join('')}</div></div>`;
}

function updateDetailVariant(p,variantId){
  const v=variantById(p,variantId);if(!v)return;
  DETAIL_VARIANT_ID=v.id;
  document.querySelectorAll('[data-select-variant]').forEach(btn=>btn.classList.toggle('active',btn.dataset.selectVariant===v.id));
  const price=document.getElementById('detailPrice');if(price)price.textContent=money(v.price);
  const meta=document.getElementById('detailVariantMeta');
  if(meta){
    const bits=[];
    if(v.warehouse)bits.push(`Envío desde ${v.warehouse}`);
    if(v.shippingDaysMin!=null&&v.shippingDaysMax!=null)bits.push(`${v.shippingDaysMin}–${v.shippingDaysMax} días`);
    meta.textContent=bits.join(' · ');
  }
  const addBtn=document.getElementById('detailAddBtn');if(addBtn)addBtn.disabled=v.stockStatus==='out';
}

function renderDetail(){
  const el=document.getElementById('detail');if(!el)return;
  const params=new URLSearchParams(location.search);
  const legacyId=params.get('id');
  const pathMatch=location.pathname.match(/^\/producto\/([^/]+)\/?$/);
  const slug=pathMatch?decodeURIComponent(pathMatch[1]):'';
  const p=PRODUCTS.find(x=>legacyId?x.id===legacyId:(x.slug===slug||x.id===slug));
  if(!p){el.innerHTML='<div class="feature"><h2>Producto no encontrado</h2><p>Puede que ya no esté disponible.</p><a class="btn primary" href="/tienda.html">Volver a la tienda</a></div>';return}
  document.title=p.name+' — NÓMA PET';
  const imgs=productImages(p);let visual;
  if(imgs.length){const first=imgs[0];const thumbs=imgs.length>1?`<div class="gallery-thumbs">${imgs.map((img,i)=>`<button class="gallery-thumb ${i===0?'active':''}" type="button" data-gallery-index="${i}"><img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt||p.name)}"></button>`).join('')}</div>`:'';visual=`<div class="product-gallery"><div class="bigphoto"><img id="galleryMainImage" src="${escapeHtml(first.url)}" alt="${escapeHtml(first.alt||p.name)}"></div>${thumbs}</div>`}else visual=`<div class="bigphoto">${p.emoji||'🐾'}</div>`;
  const selected=defaultVariant(p);DETAIL_VARIANT_ID=selected?.id||null;
  const baseLogistics=!selected&&(p.warehouse||p.shippingDaysMin!=null)?`<div class="detail-logistics">${[p.warehouse?`Envío desde ${escapeHtml(p.warehouse)}`:'',(p.shippingDaysMin!=null&&p.shippingDaysMax!=null)?`${p.shippingDaysMin}–${p.shippingDaysMax} días`:'' ].filter(Boolean).join(' · ')}</div>`:''; const logistics=selected?(selected.warehouse||selected.shippingDaysMin!=null?`<div id="detailVariantMeta" class="detail-logistics"></div>`:'') : baseLogistics;
  el.innerHTML=`${visual}<div class="detail"><span class="eyebrow">Selección NÓMA PET</span><h1>${escapeHtml(p.name)}</h1><div class="pricebig" id="detailPrice">${money(selected?.price??p.price)}</div>${variantButtons(p,DETAIL_VARIANT_ID)}${logistics}<p class="lead product-description">${escapeHtml(p.description||p.desc||'')}</p><div class="detail-trust"><span>✓ IVA incluido</span><span>✓ Seguimiento de pedido</span><span>✓ Desistimiento 14 días</span></div><div style="display:flex;gap:12px;align-items:center;margin:24px 0"><div class="qty"><button onclick="changeQty(-1)">−</button><span id="qty">1</span><button onclick="changeQty(1)">+</button></div><button id="detailAddBtn" class="btn primary" type="button">Añadir al carrito</button></div></div>`;
  if(imgs.length>1){el.querySelectorAll('[data-gallery-index]').forEach(btn=>btn.addEventListener('click',()=>{const index=Number(btn.dataset.galleryIndex);const img=imgs[index];const main=document.getElementById('galleryMainImage');if(!img||!main)return;main.src=img.url;main.alt=img.alt||p.name;el.querySelectorAll('[data-gallery-index]').forEach(x=>x.classList.toggle('active',x===btn))}))}
  el.querySelectorAll('[data-select-variant]').forEach(btn=>btn.addEventListener('click',()=>updateDetailVariant(p,btn.dataset.selectVariant)));
  document.getElementById('detailAddBtn')?.addEventListener('click',()=>add(p.id,Number(document.getElementById('qty').textContent),DETAIL_VARIANT_ID));
  if(selected)updateDetailVariant(p,selected.id);
}
function changeQty(d){const q=document.getElementById('qty');if(q)q.textContent=Math.max(1,Number(q.textContent)+d)}

function resolveCartRow(x){const p=PRODUCTS.find(y=>y.id===x.id);if(!p)return null;const v=variantsOf(p).length?variantById(p,x.variantId):null;return{p,v,qty:Math.max(1,Number(x.qty||1)),key:cartItemKey(x)}}
function renderCart(){
  const list=document.getElementById('cart-items'),sum=document.getElementById('summary');if(!list||!sum)return;
  const rows=cart().map(resolveCartRow).filter(Boolean);if(!rows.length){list.innerHTML='<div class="feature"><h3>Tu carrito está vacío</h3><p>Prueba a añadir uno de los productos del catálogo.</p><a class="btn primary" href="tienda.html">Ir a tienda</a></div>';sum.innerHTML='';return}
  let subtotal=0;list.innerHTML=rows.map(({p,v,qty,key})=>{const price=v?Number(v.price):Number(p.price);subtotal+=price*qty;return `<div class="cartitem"><div class="cartthumb">${p.imageUrl?`<img src="${escapeHtml(p.imageUrl)}" alt="">`:p.emoji||'🐾'}</div><div><b>${escapeHtml(p.name)}</b>${v?`<div class="cart-variant">${escapeHtml(v.name)}</div>`:''}<div class="meta">${money(price)} · Cantidad ${qty}</div><button style="border:0;background:none;padding:6px 0;color:#8a4a34;cursor:pointer" data-remove-key="${escapeHtml(key)}">Eliminar</button></div><div class="right"><b>${money(price*qty)}</b></div></div>`}).join('');
  list.querySelectorAll('[data-remove-key]').forEach(btn=>btn.addEventListener('click',()=>removeItem(btn.dataset.removeKey)));
  const shipping=subtotal>=39.90?0:3.90;sum.innerHTML=`<h3>Resumen</h3><div class="row"><span>Productos</span><b>${money(subtotal)}</b></div><div class="row"><span>Envío</span><b>${shipping?money(shipping):"Gratis"}</b></div><div class="row total"><span>Total</span><span>${money(subtotal+shipping)}</span></div>${subtotal<39.90?'<p class="tiny">Envío gratis desde 39,90 €.</p>':'<p class="tiny">Has conseguido envío gratis.</p>'}<a class="btn primary" style="width:100%;margin-top:14px" href="checkout.html">Continuar al pago</a>`
}
function removeItem(key){saveCart(cart().filter(x=>cartItemKey(x)!==key));renderCart()}

function adminRows(){const tb=document.getElementById('adminRows');if(!tb)return;tb.innerHTML=PRODUCTS.map(p=>`<tr><td>${p.emoji||'🐾'} ${escapeHtml(p.name)}</td><td>${escapeHtml(p.cat)}</td><td>${productPriceHtml(p)}</td><td><span class="status">Publicado</span></td><td></td></tr>`).join('')}

document.addEventListener('DOMContentLoaded',async()=>{await loadProducts();syncBadge();renderProducts();renderProducts('featured',6);initFilters();renderDetail();renderCart();adminRows()});
