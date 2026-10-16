"""Record upstream provenance and inventory paths without copying upstream code."""
import csv, hashlib, json, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'docs'
revisions={}
for name,folder,license_file in [('n8n','/workspace/Floxi.SI/research/upstreams/n8n','LICENSE.md'),('dify','/workspace/Floxi.SI/research/upstreams/dify','LICENSE')]:
    base=pathlib.Path(folder)
    commit=subprocess.check_output(['git','-C',folder,'rev-parse','HEAD'],text=True).strip()
    paths=subprocess.check_output(['git','-C',folder,'ls-tree','-r','--name-only',commit],text=True).splitlines()
    license_body=subprocess.check_output(['git','-C',folder,'show',f'{commit}:{license_file}'])
    revisions[name]={'repository':f'https://github.com/{"n8n-io/n8n" if name=="n8n" else "langgenius/dify"}','commit':commit,'licenseFile':license_file,'licenseSha256':hashlib.sha256(license_body).hexdigest(),'trackedFileCount':len(paths),'reviewScope':'targeted; not exhaustive; no upstream code incorporated'}
    with (out/'upstream-inventories'/f'{name}-tracked-files.csv').open('w') as f:
        w=csv.writer(f);w.writerow(['commit','path','review_disposition']);w.writerows((commit,p,'Not reviewed') for p in paths)
    selected=[p for p in paths if (p.endswith('.node.ts') and '/nodes/' in p)] if name=='n8n' else [p for p in paths if (('/workflow/nodes/' in p or '/apps/' in p or '/agent' in p or '/skills/' in p) and p.endswith(('.py','.tsx','.ts')))]
    filename='N8N_ALL_NODE_TYPES.csv' if name=='n8n' else 'DIFY_ALL_BLOCKS_APPS_AGENTS_SKILLS.csv'
    with (out/filename).open('w') as f:
        w=csv.writer(f);w.writerow(['repository_commit','source_path','type_or_operation','review_status','runtime_coverage']);w.writerows((commit,p,'Not extracted','Path inventoried only','Not ported') for p in selected)
(out/'UPSTREAM_REVISIONS.lock.json').write_text(json.dumps(revisions,indent=2)+'\n')
print(json.dumps(revisions,indent=2))
