
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const revealEls=[...document.querySelectorAll('.fade-up')];
 if(!reduced && 'IntersectionObserver' in window){
   const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('in-view');observer.unobserve(entry.target)}},{threshold:.12,rootMargin:'0px 0px -25px 0px'});
   revealEls.forEach((node,i)=>{node.classList.add('fade-up');node.style.setProperty('--delay',((i%4)*65)+'ms');observer.observe(node);});
 }else revealEls.forEach(node=>node.classList.add('in-view'));
 const header=document.querySelector('.site-header'),ball=document.querySelector('.ball-wrap');
 let scheduled=false;
 function onScroll(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{header.classList.toggle('scrolled',scrollY>12);header.style.setProperty('--scroll-progress', String(Math.min(1,scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight))));if(!reduced&&ball&&scrollY<850)ball.style.setProperty('--ball-y', Math.min(scrollY*.085,34)+'px');scheduled=false;});}
 addEventListener('scroll',onScroll,{passive:true});
 document.getElementById('explore-bottom')?.addEventListener('click',()=>{document.getElementById('competiciones').scrollIntoView({behavior:reduced?'auto':'smooth'})});
})();

/* Interacción del selector Apple: resplandor sutil siguiendo el cursor */
(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 for(const card of document.querySelectorAll('.ap-card')){
   let frame=0;
   card.addEventListener('pointermove',event=>{
     if(event.pointerType==='touch'||frame)return;
     frame=requestAnimationFrame(()=>{
       frame=0;const rect=card.getBoundingClientRect();
       card.style.setProperty('--cx',`${event.clientX-rect.left}px`);
       card.style.setProperty('--cy',`${event.clientY-rect.top}px`);
     });
   },{passive:true});
 }
})();
