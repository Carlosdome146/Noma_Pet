const DEMO_PRODUCTS=[
{id:'roller',name:'Rodillo reutilizable quitapelos',price:22.90,cat:'limpieza',emoji:'🧹',tag:'TOP',desc:'Recoge pelo de sofás, ropa y asientos sin recambios adhesivos.'},
{id:'bottle',name:'Botella 3 en 1 de paseo',price:21.90,cat:'paseo',emoji:'💧',tag:'PASEO',desc:'Agua, bebedero y espacio auxiliar en un formato compacto.'},
{id:'slow',name:'Comedero lento',price:18.90,cat:'hogar',emoji:'🥣',tag:'DIARIO',desc:'Diseño laberinto para alargar el tiempo de comida de forma sencilla.'},
{id:'hammock',name:'Protector de asiento tipo hamaca',price:49.90,cat:'viaje',emoji:'🚗',tag:'VIAJE',desc:'Protección impermeable para el asiento trasero, fácil de colocar y limpiar.'},
{id:'glove',name:'Guante de cepillado',price:14.90,cat:'limpieza',emoji:'🧤',tag:'CUIDADO',desc:'Cepillado cómodo para retirar pelo suelto durante el cuidado diario.'},
{id:'bags',name:'Kit paseo bolsas + dispensador',price:12.90,cat:'paseo',emoji:'♻️',tag:'RECURRENTE',desc:'Un básico ligero y recurrente para los paseos de cada día.'}
];
let PRODUCTS=[...DEMO_PRODUCTS];
let PRODUCT_SOURCE='demo';

async function loadProducts(){
  try{
    const res=await fetch('/api/products',{headers:{Accept:'application/json'}});
    if(!res.ok) throw new Error('API no disponible');
    const data=await res.json();
    if(data?.ok && Array.isArray(data.products) && data.products.length){
      PRODUCTS=data.products;
      PRODUCT_SOURCE='d1';
    }
  }catch(e){
    PRODUCTS=[...DEMO_PRODUCTS];
    PRODUCT_SOURCE='demo';
  }
}

function money(n){return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n)}
function cart(){return JSON.parse(localStorage.getItem('noma-cart')||'[]')}
function saveCart(c){localStorage.setItem('noma-cart',JSON.stringify(c));syncBadge()}
function syncBadge(){document.querySelectorAll('.cartbadge').forEach(el=>el.textContent=cart().reduce((a,x)=>a+x.qty,0))}
function add(id,qty=1){const c=cart();const hit=c.find(x=>x.id===id);hit?hit.qty+=qty:c.push({id,qty});saveCart(c);const b=document.querySelector('[data-add="'+id+'"]');if(b){const old=b.textContent;b.textContent='✓ Añadido';setTimeout(()=>b.textContent=old,1000)}}
function productVisual(p,cls='photo'){
  if(p.imageUrl) return `<img src="${p.imageUrl}" alt="${escapeHtml(p.name)}" loading="lazy">`;
  return p.emoji||'🐾';
}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function productCard(p){return `<article class="product" data-cat="${p.cat}"><a href="producto.html?id=${encodeURIComponent(p.id)}" class="photo"><span class="tag">${escapeHtml(p.tag||'')}</span>${productVisual(p)}</a><div class="product-body"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.desc||'')}</p><div class="price"><div><strong>${money(p.price)}</strong><div class="meta">IVA y envío: por configurar</div></div><button class="btn primary" data-add="${p.id}" onclick="add('${p.id}')">Añadir</button></div></div></article>`}
function renderProducts(target='products',limit){const el=document.getElementById(target);if(!el)return;el.innerHTML=PRODUCTS.slice(0,limit||PRODUCTS.length).map(productCard).join('')}
function initFilters(){document.querySelectorAll('.filter').forEach(f=>f.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));f.classList.add('active');const cat=f.dataset.filter;document.querySelectorAll('.product').forEach(p=>p.style.display=(cat==='all'||p.dataset.cat===cat)?'flex':'none')}))}
function productImages(p){
  if(Array.isArray(p.images)&&p.images.length)return p.images;
  if(p.imageUrl)return [{url:p.imageUrl,alt:p.name||''}];
  return [];
}
function renderDetail(){
  const el=document.getElementById('detail');if(!el)return;
  const id=new URLSearchParams(location.search).get('id')||PRODUCTS[0]?.id;
  const p=PRODUCTS.find(x=>x.id===id)||PRODUCTS[0];
  if(!p){el.innerHTML='<p>Producto no encontrado.</p>';return}
  document.title=p.name+' — NÓMA PET';
  const imgs=productImages(p);
  let visual;
  if(imgs.length){
    const first=imgs[0];
    const thumbs=imgs.length>1?`<div class="gallery-thumbs">${imgs.map((img,i)=>`<button class="gallery-thumb ${i===0?'active':''}" type="button" data-gallery-index="${i}"><img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt||p.name)}"></button>`).join('')}</div>`:'';
    visual=`<div class="product-gallery"><div class="bigphoto"><img id="galleryMainImage" src="${escapeHtml(first.url)}" alt="${escapeHtml(first.alt||p.name)}"></div>${thumbs}</div>`;
  }else{
    visual=`<div class="bigphoto">${p.emoji||'🐾'}</div>`;
  }
  el.innerHTML=`${visual}<div class="detail"><span class="eyebrow">Selección funcional</span><h1>${escapeHtml(p.name)}</h1><div class="pricebig">${money(p.price)}</div><p class="lead">${escapeHtml(p.description||p.desc||'')}</p><ul class="bullets"><li>✓ Producto ligero y sencillo de explicar</li><li>✓ Sin electrónica ni consumibles regulados</li><li>✓ Ideal para demostraciones en vídeo corto</li><li>✓ Proveedor y plazo UE pendientes de homologación</li></ul><div style="display:flex;gap:12px;align-items:center;margin:24px 0"><div class="qty"><button onclick="changeQty(-1)">−</button><span id="qty">1</span><button onclick="changeQty(1)">+</button></div><button class="btn primary" onclick="add('${p.id}',Number(document.getElementById('qty').textContent))">Añadir al carrito</button></div><div class="notice">Antes de vender, verificaremos muestra, materiales, operador responsable en la UE, documentación GPSR, coste real puesto en España y política de devolución del proveedor.</div></div>`;
  if(imgs.length>1){
    el.querySelectorAll('[data-gallery-index]').forEach(btn=>btn.addEventListener('click',()=>{
      const index=Number(btn.dataset.galleryIndex);const img=imgs[index];const main=document.getElementById('galleryMainImage');
      if(!img||!main)return;main.src=img.url;main.alt=img.alt||p.name;
      el.querySelectorAll('[data-gallery-index]').forEach(x=>x.classList.toggle('active',x===btn));
    }));
  }
}
function changeQty(d){const q=document.getElementById('qty');q.textContent=Math.max(1,Number(q.textContent)+d)}
function renderCart(){const list=document.getElementById('cart-items'),sum=document.getElementById('summary');if(!list||!sum)return;const c=cart();if(!c.length){list.innerHTML='<div class="feature"><h3>Tu carrito está vacío</h3><p>Prueba a añadir uno de los productos del catálogo.</p><a class="btn primary" href="tienda.html">Ir a tienda</a></div>';sum.innerHTML='';return}let subtotal=0;const rows=[];for(const x of c){const p=PRODUCTS.find(y=>y.id===x.id);if(!p)continue;subtotal+=p.price*x.qty;rows.push(`<div class="cartitem"><div class="cartthumb">${p.imageUrl?`<img src="${p.imageUrl}" alt="">`:p.emoji||'🐾'}</div><div><b>${escapeHtml(p.name)}</b><div class="meta">${money(p.price)} · Cantidad ${x.qty}</div><button style="border:0;background:none;padding:6px 0;color:#8a4a34;cursor:pointer" onclick="removeItem('${x.id}')">Eliminar</button></div><div class="right"><b>${money(p.price*x.qty)}</b></div></div>`)}list.innerHTML=rows.join('');sum.innerHTML=`<h3>Resumen</h3><div class="row"><span>Productos</span><b>${money(subtotal)}</b></div><div class="row"><span>Envío</span><span>Por calcular</span></div><div class="row total"><span>Total</span><span>${money(subtotal)}</span></div><a class="btn primary" style="width:100%;margin-top:14px" href="checkout.html">Continuar al checkout</a><p class="tiny">El pedido y seguimiento ya están preparados. El cobro con Stripe se activa en la siguiente fase.</p>`}
function removeItem(id){saveCart(cart().filter(x=>x.id!==id));renderCart()}
function adminRows(){const tb=document.getElementById('adminRows');if(!tb)return;tb.innerHTML=PRODUCTS.map(p=>`<tr><td>${p.emoji||'🐾'} ${escapeHtml(p.name)}</td><td>${escapeHtml(p.cat)}</td><td>${money(p.price)}</td><td><span class="status">Publicado</span></td><td><button class="btn secondary" onclick="alert('La escritura desde /admin se activará después de proteger el panel con Cloudflare Access.')">Editar</button></td></tr>`).join('');const note=document.getElementById('dataSource');if(note)note.textContent=PRODUCT_SOURCE==='d1'?'D1 conectado: el catálogo se está leyendo desde Cloudflare D1.':'Modo fallback: el catálogo se está leyendo desde los datos locales de demostración.'}

document.addEventListener('DOMContentLoaded',async()=>{await loadProducts();syncBadge();renderProducts();renderProducts('featured',3);initFilters();renderDetail();renderCart();adminRows()});
