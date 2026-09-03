const contactForm=document.getElementById('contactForm');
const contactResult=document.getElementById('contactResult');
const contactSubmit=document.getElementById('contactSubmit');

function contactMessage(text,type='success'){
  contactResult.hidden=!text;
  contactResult.className=`form-result ${type}`;
  contactResult.textContent=text;
}

contactForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  contactMessage('');
  if(!contactForm.reportValidity()) return;
  const old=contactSubmit.textContent;
  contactSubmit.disabled=true;
  contactSubmit.textContent='Enviando…';
  try{
    const payload={
      name:document.getElementById('contactName').value,
      email:document.getElementById('contactEmail').value,
      subject:document.getElementById('contactSubject').value,
      message:document.getElementById('contactMessage').value,
      website:document.getElementById('contactWebsite').value
    };
    const res=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok) throw new Error(data.message||'No se pudo enviar el mensaje.');
    contactForm.reset();
    contactMessage('Mensaje enviado. Te responderemos lo antes posible.');
  }catch(error){
    contactMessage(error.message||'No se pudo enviar el mensaje. Inténtalo de nuevo.','error');
  }finally{
    contactSubmit.disabled=false;
    contactSubmit.textContent=old;
  }
});
