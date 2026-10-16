"""Convert pnpm's installed dependency metadata into an SPDX 2.3 inventory."""
import datetime,json,pathlib,uuid
root=pathlib.Path(__file__).resolve().parents[1]
metadata=json.loads((root/'docs/dependency-licenses.json').read_text())
packages=[]
for license_name,items in metadata.items():
 for item in items:
  for version in item.get('versions',[item.get('version','unknown')]):
   name=item['name'];packages.append({'SPDXID':f'SPDXRef-Package-{len(packages)+1}','name':name,'versionInfo':version,'downloadLocation':'NOASSERTION','filesAnalyzed':False,'licenseConcluded':'NOASSERTION','licenseDeclared':license_name if license_name else 'NOASSERTION','copyrightText':'NOASSERTION','externalRefs':[{'referenceCategory':'PACKAGE-MANAGER','referenceType':'purl','referenceLocator':f'pkg:npm/{name.replace("@","%40")}@{version}'}]})
doc={'spdxVersion':'SPDX-2.3','dataLicense':'CC0-1.0','SPDXID':'SPDXRef-DOCUMENT','name':'Floxi.SI installed dependency inventory','documentNamespace':f'https://floxi.si/spdx/{uuid.uuid4()}','creationInfo':{'creators':['Tool: Floxi license-report.py'],'created':datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},'packages':packages}
(root/'docs/sbom.spdx.json').write_text(json.dumps(doc,indent=2)+'\n')
print(f'Inventoried {len(packages)} installed package versions. Legal conclusions are not asserted.')
