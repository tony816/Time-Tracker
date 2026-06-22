(function(root){
  const ctl=root&&root.TimeTrackerInlinePlanDropdownController;
  if(!ctl||ctl.__chipboardPatchInstalledV2)return;
  const PREVIEW='__chipDragPreviewPatch';
  const DRAG='__chipDragDropPatch';
  function panel(ctx){return ctx&&ctx.inlinePlanDropdown&&ctx.inlinePlanDropdown.isConnected?ctx.inlinePlanDropdown:null;}
  function norm(ctx,v){return ctx&&typeof ctx.normalizeActivityText==='function'?ctx.normalizeActivityText(v||''):String(v||'').trim();}
  function style(doc){
    if(!doc||!doc.head||doc.getElementById('chip-drag-preview-style'))return;
    const s=doc.createElement('style');
    s.id='chip-drag-preview-style';
    s.textContent='.activity-chip-drag-preview{position:fixed;left:0;top:0;box-sizing:border-box;pointer-events:none;z-index:99999;opacity:.94;will-change:transform;filter:drop-shadow(0 12px 22px rgba(15,23,42,.22))}.activity-chip-preview-source{opacity:.42}.activity-chip-board-drag-active{cursor:grabbing;overscroll-behavior:contain}';
    doc.head.appendChild(s);
  }
  function addCls(el,...names){if(el&&el.classList)el.classList.add(...names.filter(Boolean));}
  function remCls(el,...names){if(el&&el.classList)el.classList.remove(...names.filter(Boolean));}
  function focusAnchor(ctx){
    const p=panel(ctx);if(!p)return;
    const t=ctx.inlinePlanTarget||{};
    const i=Number.isInteger(t.baseIndex)?t.baseIndex:(Number.isInteger(t.startIndex)?t.startIndex:null);
    const doc=p.ownerDocument||document;
    const a=t.anchor&&t.anchor.isConnected?t.anchor:(Number.isInteger(i)?doc.querySelector(`[data-index="${i}"] .planned-merged-main-container`)||doc.querySelector(`[data-index="${i}"] .planned-input`)||doc.querySelector(`[data-index="${i}"]`):null);
    if(a&&typeof ctx.positionInlinePlanDropdown==='function')ctx.positionInlinePlanDropdown(a);
  }
  function emptyTarget(ctx){
    const t=ctx&&ctx.inlinePlanTarget;
    if(!t||t.mode==='plan-segment-replace'||typeof ctx.isPlanSlotEmptyForInline!=='function')return false;
    const s=Number.isInteger(t.startIndex)?t.startIndex:0;
    const e=Number.isInteger(t.endIndex)?t.endIndex:s;
    for(let i=Math.min(s,e);i<=Math.max(s,e);i+=1){if(!ctx.isPlanSlotEmptyForInline(i))return false;}
    return true;
  }
  function add(ctx,e){
    if(e&&e.preventDefault)e.preventDefault();
    if(e&&e.stopImmediatePropagation)e.stopImmediatePropagation();else if(e&&e.stopPropagation)e.stopPropagation();
    const p=panel(ctx);if(!p)return;
    const input=p.querySelector('.inline-plan-input');
    const v=norm(ctx,input&&input.value);
    if(!v)return;
    const top=Number(p.scrollTop)||0;
    if(typeof ctx.addPlannedActivityOption==='function')ctx.addPlannedActivityOption(v,false);
    if(input)input.value='';
    ctx.currentPlanSource='local';
    if(emptyTarget(ctx)&&typeof ctx.applyInlinePlanSelection==='function')ctx.applyInlinePlanSelection(v,{keepOpen:true,keepOpenOnMobile:true});
    else if(typeof ctx.renderInlinePlanDropdownOptions==='function')ctx.renderInlinePlanDropdownOptions();
    const live=panel(ctx);if(!live)return;
    live.scrollTop=top;
    bind(ctx);
    focusAnchor(ctx);
  }
  function bindAdd(ctx){
    const p=panel(ctx);if(!p)return;
    const btn=p.querySelector('.inline-plan-add-btn');
    if(btn&&btn.dataset.keepOpenPatch!=='true'){
      btn.dataset.keepOpenPatch='true';
      btn.addEventListener('click',e=>add(ctx,e),true);
      btn.addEventListener('pointerdown',e=>{if(e.stopPropagation)e.stopPropagation();},true);
      btn.addEventListener('mousedown',e=>{if(e.stopPropagation)e.stopPropagation();},true);
      btn.addEventListener('touchstart',e=>{if(e.stopPropagation)e.stopPropagation();},{capture:true,passive:true});
    }
    const input=p.querySelector('.inline-plan-input');
    if(input&&input.dataset.keepOpenEnterPatch!=='true'){
      input.dataset.keepOpenEnterPatch='true';
      input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&norm(ctx,input.value))add(ctx,e);},true);
    }
  }
  function clearPreview(ctx){
    const st=ctx&&ctx[PREVIEW];if(!st)return;
    if(st.ghost&&st.ghost.parentNode)st.ghost.parentNode.removeChild(st.ghost);
    if(st.source)remCls(st.source,'activity-chip-preview-source');
    ctx[PREVIEW]=null;
  }
  function makePreview(ctx,chip,e){
    const doc=chip.ownerDocument||document,r=chip.getBoundingClientRect();
    style(doc);clearPreview(ctx);
    const ghost=chip.cloneNode(true);
    ghost.classList.add('activity-chip-drag-preview');
    ghost.classList.remove('activity-chip-drop-before','activity-chip-drop-after','activity-chip-drop-nest','activity-chip-drop-invalid','activity-chip-dragging');
    ghost.setAttribute('aria-hidden','true');
    ghost.style.width=`${Math.max(1,Math.round(r.width||chip.offsetWidth||1))}px`;
    ghost.style.height=`${Math.max(1,Math.round(r.height||chip.offsetHeight||1))}px`;
    doc.body.appendChild(ghost);
    const ox=(e.clientX||0)-r.left,oy=(e.clientY||0)-r.top;
    const moveTo=ev=>{ghost.style.transform=`translate3d(${Math.round((ev.clientX||0)-ox)}px,${Math.round((ev.clientY||0)-oy)}px,0)`;};
    moveTo(e);addCls(chip,'activity-chip-preview-source');
    ctx[PREVIEW]={ghost,source:chip,moveTo};
    return ctx[PREVIEW];
  }
  function clearFeedback(board){
    if(!board||!board.querySelectorAll)return;
    board.querySelectorAll('.activity-chip-drop-before,.activity-chip-drop-after,.activity-chip-drop-nest,.activity-chip-drop-invalid,.activity-chip-dragging').forEach(el=>remCls(el,'activity-chip-drop-before','activity-chip-drop-after','activity-chip-drop-nest','activity-chip-drop-invalid','activity-chip-dragging'));
  }
  function dropIntent(doc,sourceChip,e){
    const hit=doc&&doc.elementFromPoint?doc.elementFromPoint(Number(e.clientX)||0,Number(e.clientY)||0):null;
    const chip=hit&&hit.closest?hit.closest('.activity-chip[data-activity-id]'):null;
    if(!chip||chip===sourceChip)return null;
    const targetId=chip.dataset&&chip.dataset.activityId?String(chip.dataset.activityId).trim():'';
    if(!targetId)return null;
    const r=chip.getBoundingClientRect();
    const w=r&&Number.isFinite(r.width)&&r.width>0?r.width:1;
    const ratio=Math.max(0,Math.min(1,((Number(e.clientX)||0)-(r.left||0))/w));
    if(ratio<=0.25)return{type:'reorder',placement:'before',targetId,targetChip:chip};
    if(ratio>=0.75)return{type:'reorder',placement:'after',targetId,targetChip:chip};
    return{type:'nest',placement:'after',targetId,targetChip:chip};
  }
  function paint(ctx,state,intent,validation){
    clearFeedback(state.board);
    addCls(state.sourceChip,'activity-chip-dragging');
    if(!intent||!intent.targetChip)return;
    if(!validation||!validation.valid){addCls(intent.targetChip,'activity-chip-drop-invalid');return;}
    if(intent.type==='nest'){addCls(intent.targetChip,'activity-chip-drop-nest');return;}
    addCls(intent.targetChip,intent.placement==='after'?'activity-chip-drop-after':'activity-chip-drop-before');
  }
  function cleanupDrag(ctx){
    const st=ctx&&ctx[DRAG];if(!st)return;
    const doc=st.doc,w=st.win;
    if(doc){doc.removeEventListener('pointermove',st.move,true);doc.removeEventListener('pointerup',st.up,true);doc.removeEventListener('pointercancel',st.cancel,true);doc.removeEventListener('keydown',st.key,true);}
    if(w)w.removeEventListener('blur',st.cancel,true);
    clearFeedback(st.board);remCls(st.board,'activity-chip-board-drag-active');clearPreview(ctx);ctx[DRAG]=null;
  }
  function startDrag(ctx,e){
    const p=panel(ctx);if(!p||!ctx.inlinePlanChipEditMode||!e||e.button>0)return;
    const target=e.target;if(!target||!target.closest||!target.closest('[data-chip-drag-handle="true"]'))return;
    const chip=target.closest('.activity-chip[data-activity-id]');if(!chip||!p.contains(chip))return;
    const sourceId=chip.dataset&&chip.dataset.activityId?String(chip.dataset.activityId).trim():'';if(!sourceId)return;
    if(e.preventDefault)e.preventDefault();
    if(e.stopImmediatePropagation)e.stopImmediatePropagation();else if(e.stopPropagation)e.stopPropagation();
    cleanupDrag(ctx);
    const doc=chip.ownerDocument||document,win=doc.defaultView||window,board=chip.closest('.activity-chip-board');
    const preview=makePreview(ctx,chip,e);
    const st={doc,win,board,sourceChip:chip,sourceId,pid:Number.isFinite(e.pointerId)?e.pointerId:null,intent:null,validation:null};
    st.move=ev=>{
      if(st.pid!==null&&Number.isFinite(ev.pointerId)&&ev.pointerId!==st.pid)return;
      if(preview&&preview.moveTo)preview.moveTo(ev);
      const intent=dropIntent(doc,chip,ev);
      const validation=intent&&ctl.validateActivityChipboardDrop?ctl.validateActivityChipboardDrop.call(ctx,sourceId,intent):{valid:false,status:'missing-target'};
      st.intent=intent;st.validation=validation;paint(ctx,st,intent,validation);
      if(ev.cancelable)ev.preventDefault();if(ev.stopPropagation)ev.stopPropagation();
    };
    st.up=ev=>{
      if(st.pid!==null&&ev&&Number.isFinite(ev.pointerId)&&ev.pointerId!==st.pid)return;
      const intent=st.intent,validation=st.validation;
      cleanupDrag(ctx);
      if(intent&&validation&&validation.valid&&ctl.applyActivityChipboardDrop)ctl.applyActivityChipboardDrop.call(ctx,sourceId,intent);
      if(ev&&ev.cancelable)ev.preventDefault();if(ev&&ev.stopPropagation)ev.stopPropagation();
    };
    st.cancel=ev=>{cleanupDrag(ctx);if(ev&&ev.stopPropagation)ev.stopPropagation();};
    st.key=ev=>{if(ev.key==='Escape'){cleanupDrag(ctx);if(ev.stopPropagation)ev.stopPropagation();}};
    ctx[DRAG]=st;addCls(chip,'activity-chip-dragging');addCls(board,'activity-chip-board-drag-active');
    doc.addEventListener('pointermove',st.move,true);doc.addEventListener('pointerup',st.up,true);doc.addEventListener('pointercancel',st.cancel,true);doc.addEventListener('keydown',st.key,true);win.addEventListener('blur',st.cancel,true);
  }
  function bindPreview(ctx){
    const p=panel(ctx);if(!p||p.dataset.chipPreviewPatch==='true')return;
    p.dataset.chipPreviewPatch='true';
    p.addEventListener('pointerdown',e=>startDrag(ctx,e),true);
  }
  function bind(ctx){bindAdd(ctx);bindPreview(ctx);}
  function wrap(name,fn){const old=ctl[name];if(typeof old!=='function'||old.__chipboardPatchWrappedV2)return;const w=function(...args){return fn.call(this,old,args);};w.__chipboardPatchWrappedV2=true;ctl[name]=w;}
  wrap('openInlinePlanDropdown',function(old,args){const r=old.apply(this,args);if(r)bind(this);return r;});
  wrap('renderInlinePlanDropdownOptions',function(old,args){const r=old.apply(this,args);bind(this);return r;});
  wrap('cleanupInlinePlanChipDragState',function(old,args){const r=old.apply(this,args);cleanupDrag(this);return r;});
  wrap('setInlinePlanChipEditMode',function(old,args){const r=old.apply(this,args);if(!r)cleanupDrag(this);bind(this);return r;});
  wrap('closeInlinePlanDropdown',function(old,args){cleanupDrag(this);return old.apply(this,args);});
  ctl.__chipboardPatchInstalledV2=true;
})(typeof globalThis!=='undefined'?globalThis:this);
