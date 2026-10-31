"""Portable rebuild for the new host. Never generates a replacement signing key."""
from pathlib import Path
from urllib.parse import urlparse
import os, json, subprocess, tempfile, zipfile, hashlib, shutil

root=Path(__file__).resolve().parent
origin=os.environ.get('MEALCHECK_URL','').rstrip('/')
url=urlparse(origin)
if url.scheme!='https' or not url.hostname or url.path or url.query or url.fragment or url.username or url.password or url.port not in (None,443):
    raise SystemExit('Set MEALCHECK_URL to the actual deployed HTTPS origin, without path/query/credentials.')
if url.hostname.endswith('.chatgpt.site'):
    raise SystemExit('The migrated APK must use the newly verified independent host.')
required=['ANDROID_TOOLS_JSON','OUTPUT_DIR','SIGNING_KEYSTORE','SIGNING_PASSWORD_FILE']
if any(not os.environ.get(k) for k in required):raise SystemExit('Set '+', '.join(required))
tools=json.loads(Path(os.environ['ANDROID_TOOLS_JSON']).read_text())
jdk,bt,jar=Path(tools['jdk']),Path(tools['buildTools']),Path(tools['androidJar'])
output=Path(os.environ['OUTPUT_DIR']).resolve();output.mkdir(parents=True,exist_ok=True)
key=Path(os.environ['SIGNING_KEYSTORE']).resolve();password=Path(os.environ['SIGNING_PASSWORD_FILE']).read_text().strip()
if not key.is_file() or not password:raise SystemExit('Existing signing key/password required for an installable update.')
env=dict(os.environ);env['JAVA_HOME']=str(jdk);env['PATH']=str(jdk/'bin')+os.pathsep+env['PATH'];env['AFYLLX_SIGN_PASSWORD']=password
work=Path(tempfile.mkdtemp(prefix='apk-build-',dir=output)).resolve()
assert work.is_relative_to(output) and work!=output
def run(args):subprocess.run([str(a) for a in args],cwd=work,env=env,check=True,stdout=subprocess.DEVNULL)
try:
    source=work/'source';shutil.copytree(root,source,ignore=shutil.ignore_patterns('__pycache__','*.apk'))
    generated=source/'src/vn/afyllx/mealcheck/BuildConfig.java'
    generated.write_text('package vn.afyllx.mealcheck; final class BuildConfig { static final String ORIGIN='+json.dumps(origin)+'; }',encoding='utf-8')
    classes=work/'classes';classes.mkdir();dex=work/'dex';dex.mkdir()
    executable=lambda name:name+'.exe' if os.name=='nt' else name
    run([bt/executable('aapt2'),'compile','--dir',source/'res','-o',work/'resources.zip'])
    run([bt/executable('aapt2'),'link','-o',work/'unsigned.apk','--manifest',source/'AndroidManifest.xml','-I',jar,work/'resources.zip','--auto-add-overlay'])
    run([jdk/'bin'/executable('javac'),'-encoding','UTF-8','-source','8','-target','8','-classpath',jar,'-d',classes,*source.glob('src/**/*.java')])
    with zipfile.ZipFile(work/'classes.jar','w') as z:
        for p in classes.rglob('*.class'):z.write(p,p.relative_to(classes).as_posix())
    run([jdk/'bin'/executable('java'),'-cp',bt/'lib/d8.jar','com.android.tools.r8.D8','--release','--min-api','26','--lib',jar,'--output',dex,work/'classes.jar'])
    with zipfile.ZipFile(work/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:z.write(dex/'classes.dex','classes.dex')
    run([bt/executable('zipalign'),'-f','4',work/'unsigned.apk',work/'aligned.apk'])
    apk=output/'AFYLLX-MealCheck-1.0.1.apk'
    if apk.exists():raise SystemExit('Refusing to overwrite an existing APK. Choose another output directory.')
    run([jdk/'bin'/executable('java'),'-jar',bt/'lib/apksigner.jar','sign','--ks',key,'--ks-key-alias','afyllx','--ks-pass','env:AFYLLX_SIGN_PASSWORD','--key-pass','env:AFYLLX_SIGN_PASSWORD','--out',apk,work/'aligned.apk'])
    run([jdk/'bin'/executable('java'),'-jar',bt/'lib/apksigner.jar','verify',apk])
    apk.with_suffix('.apk.sha256').write_text(hashlib.sha256(apk.read_bytes()).hexdigest()+'  '+apk.name+'\n')
    print(json.dumps({'apk':str(apk),'signed':True,'origin':origin}))
finally:
    if work.is_relative_to(output) and work!=output:shutil.rmtree(work)
