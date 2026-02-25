const state={data:[],filtered:[],query:'',sort:'az',focusedCard:null}
const els={grid:document.getElementById('grid'),summary:document.getElementById('summary'),search:document.getElementById('search'),sort:document.getElementById('sort'),tplCard:document.getElementById('card-tpl'),modal:document.getElementById('modal'),modalTitle:document.getElementById('modalTitle'),modalDesc:document.getElementById('modalDesc'),modalGallery:document.getElementById('modalGallery'),modalSources:document.getElementById('modalSources'),modalDownload:document.getElementById('modalDownload'),modalCopy:document.getElementById('modalCopy'),logoBtn:document.getElementById('logoBtn'),backToTop:document.getElementById('backToTop')}

const norm=s=>(s||'').toLowerCase()
const toRawImage=u=>{
  if(!u)return u
  if(u.includes('github.com/')&&u.includes('/blob/')){
    return u.replace('https://github.com/','https://raw.githubusercontent.com/').replace('/blob/','/')
  }
  return u
}

async function boot(){
  if(location.protocol==='file:'){
    document.body.innerHTML='<div style="padding:20px;font-family:system-ui"><p>Please start a local web server (e.g. <code>python -m http.server</code>).</p></div>';return
  }
  const res=await fetch('./wotlk_addons.json',{cache:'no-store'})
  if(!res.ok)throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const json=await res.json()
  state.data=json.map(d=>({...d,_search:(`${d.name||''} ${d.description_text||''}`).toLowerCase(),_hasImages:Array.isArray(d.image_urls)&&d.image_urls.length>0}))
  bindUI();applyFilters()
}

function bindUI(){
  let t
  els.search.addEventListener('input',e=>{clearTimeout(t);t=setTimeout(()=>{state.query=norm(e.target.value);applyFilters()},180)})
  els.sort.addEventListener('change',e=>{state.sort=e.target.value;applyFilters()})
  els.modal.addEventListener('click',e=>{if(e.target.hasAttribute('data-close'))closeModal()})
  window.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()})
  const toTop=()=>window.scrollTo({top:0,behavior:'smooth'})
  els.logoBtn.addEventListener('click',toTop)
  els.backToTop.addEventListener('click',toTop)
}

function applyFilters(){
  const q=state.query
  state.filtered=state.data.filter(d=>!q||d._search.includes(q))
  switch(state.sort){
    case 'az': state.filtered.sort((a,b)=>a.name.localeCompare(b.name)); break
    case 'za': state.filtered.sort((a,b)=>b.name.localeCompare(a.name)); break
    case 'img': state.filtered.sort((a,b)=>(b._hasImages?1:0)-(a._hasImages?1:0)||a.name.localeCompare(b.name)); break
  }
  render()
}

function render(){
  els.grid.innerHTML=''
  const frag=document.createDocumentFragment()
  state.filtered.forEach(d=>frag.appendChild(renderCard(d)))
  els.grid.appendChild(frag)
  els.summary.textContent=`${state.filtered.length} addons`
}

function renderCard(d){
  const node=els.tplCard.content.firstElementChild.cloneNode(true)
  const img=node.querySelector('.thumb')
  const wrap=node.querySelector('.thumbWrap')
  if(d.image_urls&&d.image_urls.length){
    img.src=toRawImage(d.image_urls[0])
    img.alt=`Image for ${d.name}`
    img.onerror=()=>{img.remove();wrap.classList.add('noimg')}
  }else{
    img.remove();wrap.classList.add('noimg')
  }
  node.querySelector('.title').textContent=d.name
  node.querySelector('.desc').textContent=(d.description_text||'').trim()

  const dl=node.querySelector('.dl')
  if(d.primary_download){dl.href=d.primary_download}
  else{dl.classList.add('disabled');dl.textContent='No Download';dl.removeAttribute('href')}

  const srcWrap=node.querySelector('.sources')
  if(Array.isArray(d.source)&&d.source.length){d.source.forEach(s=>srcWrap.appendChild(makeSourceBadge(s)))}

  node.addEventListener('click',e=>{const tag=e.target.tagName.toLowerCase();if(tag==='a'||e.target.closest('a'))return;openModal(d)})
  node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openModal(d)}})
  node.addEventListener('focusin',()=>{state.focusedCard=node})
  return node
}

function makeSourceBadge(s){
  const url=s.url||''
  const label=(s.label||url).trim()
  const a=document.createElement('a')
  a.className='badge';a.href=url;a.target='_blank';a.rel='noopener'
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg')
  icon.setAttribute('viewBox','0 0 24 24')
  if(/github\.com/i.test(url)||/github/i.test(label)){
    icon.innerHTML='<path fill="currentColor" d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.41-1.35-1.79-1.35-1.79-1.1-.76.08-.74.08-.74 1.22.09 1.86 1.25 1.86 1.25 1.08 1.85 2.83 1.32 3.52 1 .11-.78.42-1.32.76-1.62-2.67-.3-5.47-1.34-5.47-5.97 0-1.32.47-2.4 1.24-3.24-.12-.3-.54-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.92 1.24 3.24 0 4.64-2.8 5.66-5.47 5.97.43.37.81 1.1.81 2.23v3.31c0 .32.22.7.82.58A12 12 0 0 0 12 .5Z"/>'
  }else if(/curseforge\.com/i.test(url)||/curseforge/i.test(label)){
    icon.innerHTML='<path fill="currentColor" d="M3 6h18l-2 5H5L3 6zm2 7h14v3H5v-3zm3 4h8v2H8v-2z"/>'
  }else{
    icon.innerHTML='<path fill="currentColor" d="M10.59 13.41a1 1 0 0 1 0-1.41l3-3a1 1 0 1 1 1.41 1.41l-3 3a1 1 0 0 1-1.41 0Zm-5 5a3 3 0 0 1 0-4.24l2.12-2.12a1 1 0 0 1 1.41 1.41L7 15.59a1 1 0 1 0 1.41 1.41l2.12-2.12a1 1 0 1 1 1.41 1.41L9.83 18.4a3 3 0 0 1-4.24 0Zm7.58-9.9a1 1 0 0 1 0-1.41l2.12-2.12a3 3 0 1 1 4.24 4.24l-2.12 2.12a1 1 0 0 1-1.41-1.41l2.12-2.12a1 1 0 1 0-1.41-1.41L13.17 7.1a1 1 0 0 1-1.41 0Z"/>'
  }
  const span=document.createElement('span');span.className='label';span.textContent=label
  a.appendChild(icon);a.appendChild(span)
  return a
}

function openModal(d){
  els.modalTitle.textContent=d.name
  els.modalDesc.textContent=(d.description_text||'').trim()
  els.modalGallery.innerHTML=''
  if(d.image_urls&&d.image_urls.length){
    d.image_urls.forEach((url,i)=>{
      const img=document.createElement('img')
      img.src=toRawImage(url)
      img.alt=`Image ${i+1} for ${d.name}`
      img.loading='lazy'
      img.onerror=()=>img.remove()
      els.modalGallery.appendChild(img)
    })
  }
  els.modalSources.innerHTML=''
  if(Array.isArray(d.source)&&d.source.length){d.source.forEach(s=>els.modalSources.appendChild(makeSourceBadge(s)))}
  if(d.primary_download){els.modalDownload.href=d.primary_download;els.modalDownload.style.display=''}
  else{els.modalDownload.style.display='none'}
  els.modalCopy.onclick=async()=>{const url=d.primary_download||location.href;await navigator.clipboard.writeText(url);els.modalCopy.textContent='Copied!';setTimeout(()=>els.modalCopy.textContent='Copy Link',1200)}
  els.modal.setAttribute('aria-hidden','false')
  setTimeout(()=>els.modal.querySelector('.modal__close').focus(),0)
}

function closeModal(){
  els.modal.setAttribute('aria-hidden','true')
  if(state.focusedCard){state.focusedCard.focus()}
}

boot().catch(err=>{
  console.error(err)
  document.body.innerHTML=`<div style="padding:20px;font-family:system-ui"><h2>Failed to load data</h2><p><strong>${String(err.message)}</strong></p><p>Ensure <code>wotlk_addons.json</code> is in the same folder and you use a local web server.</p></div>`
})
