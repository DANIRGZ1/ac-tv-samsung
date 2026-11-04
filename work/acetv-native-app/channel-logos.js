(function(root){'use strict';
function logo(name){var s=String(name||'').toLowerCase();try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}s=s.replace(/[._+-]/g,' ').replace(/\s+/g,' ').trim();var m,n,file=null;
function numbered(match,base,max,first){if(!match)return null;var value=match[1]?Number(match[1]):1;if(value<1||value>max)return null;return value===1?first:base+value+'-es.png';}
if(/^dazn\s*(?:la\s*liga)/.test(s)){file=numbered(s.match(/^dazn\s*la\s*liga\s*(\d+)?\b/),'dazn-laliga-',5,'dazn-laliga-es.png');}
else if(/^dazn\s*f1\b/.test(s))file='dazn-f1-es.png';
else if((m=s.match(/^dazn\s*(\d+)?(?:\s|$)/)))file=m[1]?numbered(m,'dazn-',4,'dazn-1-es.png'):'dazn-es.png';
else if((m=s.match(/^eurosport\s*(\d+)?(?:\s|$)/)))file=numbered(m,'eurosport-',2,'eurosport-1-es.png');
else if(/^(?:m |movistar )/.test(s)){
 if((m=s.match(/(?:liga\s*(?:de\s*)?|l\s*)campeones\s*(\d+)?(?:\s|$)/))){n=m[1]?Number(m[1]):1;if(n===1)file='liga-de-campeones-por-movistar-plus-es.png';else if(n>=3&&n<=17)file='liga-de-campeones-'+n+'-por-movistar-plus-es.png';}
 else if((m=s.match(/(?:la\s*liga)(?:\s*tv)?\s*(\d+)?(?:\s|$)/))){n=m[1]?Number(m[1]):1;if(n>=1&&n<=7)file='laliga-tv-'+(n===1?'':n+'-')+'por-movistar-plus-es.png';}
 else if((m=s.match(/deportes\s*(\d+)?(?:\s|$)/))){n=m[1]?Number(m[1]):1;if(n>=1&&n<=8)file='deportes-'+(n===1?'':n+'-')+'por-movistar-plus-es.png';}
 else if(/\bvamos\b/.test(s))file='vamos-por-movistar-plus-es.png';
 else if(/^(?:m|movistar) (?:plus)?\s*(?:hd|fhd|uhd|4k)?$/.test(s))file='movistar-plus-es.png';
}
else if((m=s.match(/^(?:la|tve)\s*([12])(?:\s|$)/)))file='tve-'+m[1]+'-es.png';
else if(/^antena\s*3(?:\s|$)/.test(s))file='antena-3-es.png';
else if(/^telecinco(?:\s|$)/.test(s))file='telecinco-es.png';
else if(/^la\s*sexta(?:\s|$)/.test(s))file='lasexta-es.png';
else if(/^cuatro(?:\s|$)/.test(s))file='cuatro-es.png';
else if(/^(?:canal\s*)?24\s*h(?:oras)?(?:\s|$)/.test(s))file='24h-es.png';
else if(/^clan(?:\s|$)/.test(s))file='clan-es.png';
else if((m=s.match(/^la\s*liga\s*(?:tv\s*)?hypermotion\s*(\d+)?(?:\s|$)/)))file=numbered(m,'laliga-tv-hypermotion-',5,'laliga-tv-hypermotion-es.png');
return file?'assets/logos/'+file:null;}
var api={resolve:logo};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ChannelLogos=api;
}(this));
