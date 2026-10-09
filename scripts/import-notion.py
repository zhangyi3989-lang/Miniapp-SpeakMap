import pathlib,csv,re,json,sys
root=pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv)!=3: raise SystemExit('Usage: python scripts/import-notion.py MOTHER_EXPORT_DIR FUNCTION_EXPORT_DIR')
src=pathlib.Path(sys.argv[1])
rows=list(csv.DictReader(next(src.glob('*_all.csv')).open(encoding='utf-8-sig')));docs={}
for p in src.glob('*.md'):
 t=p.read_text();m=re.search(r'^编号: ([A-F]\d\d)$',t,re.M)
 if m:docs[m[1]]=t
result=[]
for r in sorted([r for r in rows if r['编号']],key=lambda r:int(r['学习顺序'])):
 t=docs[r['编号']];start=t.find('\n# ',2);body=t[start+1:] if start>=0 else t
 blocks=[]
 for l in body.splitlines():
  if not l.strip():continue
  if re.search(r'\]\([^)]*\.md\)',l):continue
  typ='h1' if l.startswith('# ') else 'h2' if l.startswith('## ') else 'h3' if l.startswith('###') else 'quote' if l.startswith('>') else 'rule' if l.strip()=='---' else 'body'
  text=re.sub(r'^[>#\s]+','',l).replace('**','').strip()
  if text:blocks.append({'type':typ,'text':text})
 lines=[re.sub(r'^[>#\s]+','',l).replace('**','').strip() for l in body.splitlines()];pairs=[]
 for i,l in enumerate(lines):
  if re.match(r'^[A-Za-z]',l) and re.search(r'[.!?。]$',l) and not re.search(r'[\u4e00-\u9fff]',l):
   for n in lines[i+1:i+5]:
    if not n:continue
    if re.search('[\u4e00-\u9fff]',n) and not n.startswith(('→','①')) and (l,n) not in pairs:pairs.append((l,n))
    break
 assert len(pairs)>=6
 intro=next((b['text'] for b in blocks[1:] if b['type']=='quote'),r['思维动作'])
 result.append({'id':r['编号'],'skeleton':r['母句'].strip(),'meaning':intro,'scenes':[r['分类'],r['思维动作']],'category':r['分类'],'order':int(r['学习顺序']),'type':r['类型'],'blocks':blocks,'pairs':[{'en':a,'zh':b} for a,b in pairs],'source':'用户提供的 Notion 导出'})
assert len(result)==34 and len(docs)==34
(root/'data/motherCatalog.js').write_text('module.exports = '+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n')
frows=list(csv.DictReader(next(pathlib.Path(sys.argv[2]).glob('*_all.csv')).open(encoding='utf-8-sig')))
f=[]
for r in frows:
 fid,name=r['模块'].split(' ',1);active=[r[k] for k in ['主动掌握1','主动掌握2'] if r[k]];aux=[r[k] for k in ['辅助/认识即可1','辅助/认识即可2'] if r[k]]
 f.append({'id':fid,'name':name,'action':r['功能'],'expressions':active+aux,'primary':active,'supporting':aux})
(root/'data/functionalExpressions.js').write_text('module.exports = '+json.dumps(f,ensure_ascii=False,indent=2)+';\n')
print('Imported',len(result),'mothers,',sum(len(m['blocks']) for m in result),'blocks,',len(f),'functions')
