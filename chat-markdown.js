import katex from './assets/vendor/katex-0.19.0.mjs';
// Small Markdown surface: all source text is escaped. No HTML, images or embeds.
export const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function publicLink(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return''}}
function math(source,display){
  try{
    if(source.length>2000)throw new Error('expression too large');
    return `<span class="chat-math${display?' display':''}">${katex.renderToString(source,{output:'mathml',displayMode:display,throwOnError:true,trust:false,strict:'ignore',maxExpand:200,maxSize:10,macros:{}})}</span>`;
  }catch{return `<code class="math-fallback">${escapeHTML(source)}</code>`}
}
function bareURL(source){
  const match=source.match(/^https?:\/\/[^\s<>"`]+/);if(!match)return'';
  let url=match[0].replace(/[.,;:!?]+$/,'');
  while(url.endsWith(')')&&(url.match(/\)/g)||[]).length>(url.match(/\(/g)||[]).length)url=url.slice(0,-1);
  return url.replace(/\]+$/,'');
}
function inline(source,depth=0){
  if(depth>5)return escapeHTML(source);
  let out='',i=0;
  while(i<source.length){
    const rest=source.slice(i);
    const code=rest.match(/^(`+)([\s\S]*?)\1(?!`)/);
    if(code){out+=`<code>${escapeHTML(code[2].replace(/\n/g,' '))}</code>`;i+=code[0].length;continue}
    const equation=rest.match(/^\\\(([\s\S]+?)\\\)/)||rest.match(/^\\\[([\s\S]+?)\\\]/)||rest.match(/^\$\$([\s\S]+?)\$\$/)||rest.match(/^\$(?!\s|\d+(?:[.,]\d+)?\s)([^$\n]+?)\$/);
    if(equation){out+=math(equation[1],rest.startsWith('\\[')||rest.startsWith('$$'));i+=equation[0].length;continue}
    if(rest[0]==='\\'&&/^[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]$/.test(rest[1]||'')){out+=escapeHTML(rest[1]);i+=2;continue}
    const link=rest.match(/^\[([^\]\n]+)\]\((https?:\/\/(?:[^\s<>()]|\([^\s<>]*\))+)\)/);
    if(link){const url=publicLink(link[2]);out+=url?`<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${inline(link[1],depth+1)}</a>`:escapeHTML(link[0]);i+=link[0].length;continue}
    const invalidLink=rest.match(/^\[[^\]\n]+\]\([^\n]*?\)/);
    if(invalidLink){out+=escapeHTML(invalidLink[0]);i+=invalidLink[0].length;continue}
    const bare=depth===0?bareURL(rest):'',url=publicLink(bare);
    if(url){out+=`<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(bare)}</a>`;i+=bare.length;continue}
    let matched=false;
    for(const [mark,tag] of [['**','strong'],['__','strong'],['~~','del'],['*','em'],['_','em']]){
      if(!rest.startsWith(mark)||(mark.includes('_')&&/\w/.test(source[i-1]||'')))continue;
      const end=source.indexOf(mark,i+mark.length),body=source.slice(i+mark.length,end);
      if(end>i+mark.length&&!/^\s|\s$/.test(body)){out+=`<${tag}>${inline(body,depth+1)}</${tag}>`;i=end+mark.length;matched=true;break}
    }
    if(matched)continue;
    out+=escapeHTML(source[i++]);
  }
  return out;
}
export function renderMarkdown(value){
  // xAI citations use [[1]](url); display discreet numbered links.
  const lines=String(value||'').replace(/\r\n?/g,'\n').replace(/\[\[(\d+)\]\](?=\(https?:\/\/)/g,'[$1]').split('\n'),out=[];
  const special=line=>/^\s*(```|~~~|#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s)/.test(line);
  for(let i=0;i<lines.length;){
    if(!lines[i].trim()){i++;continue}
    const fence=lines[i].match(/^\s*(`{3,}|~{3,})([\w+-]*)\s*$/);
    if(fence){const code=[];i++;while(i<lines.length&&!new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;out.push(`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`);continue}
    const heading=lines[i].match(/^\s*(#{1,6})\s+(.+?)\s*#*$/);
    if(heading){const level=heading[1].length;out.push(`<h${level}>${inline(heading[2])}</h${level}>`);i++;continue}
    if(/^\s*>/.test(lines[i])){const quote=[];while(i<lines.length&&/^\s*>/.test(lines[i]))quote.push(lines[i++].replace(/^\s*>\s?/,''));out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);continue}
    const list=lines[i].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
    if(list){
      const ordered=Boolean(list[2]),items=[];
      while(i<lines.length){const item=lines[i].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);if(!item||Boolean(item[2])!==ordered)break;let text=item[3];i++;while(i<lines.length&&/^\s{2,}\S/.test(lines[i])&&!special(lines[i]))text+=' '+lines[i++].trim();items.push(`<li>${inline(text)}</li>`)}
      const tag=ordered?'ol':'ul',start=ordered&&list[2]!=='1'?` start="${Number(list[2])}"`:'';out.push(`<${tag}${start}>${items.join('')}</${tag}>`);continue;
    }
    const paragraph=[lines[i++]];while(i<lines.length&&lines[i].trim()&&!special(lines[i]))paragraph.push(lines[i++]);
    out.push(`<p>${inline(paragraph.join('\n')).replace(/ {2,}\n/g,'<br>').replace(/\n/g,' ')}</p>`);
  }
  return out.join('');
}
