from pathlib import Path
from PIL import Image
out=Path(__file__).resolve().parents[1]/'public'/'icons'
out.mkdir(parents=True,exist_ok=True)
logo=Image.open(out.parent/'brand'/'afyllx-logo.png').convert('RGBA')
logo=logo.crop(logo.getchannel('A').getbbox())
# Branded URLs bypass old launcher/browser icon caches. Keep legacy files for old installs.
for name,size in [('afyllx-icon-192.png',192),('afyllx-icon-512.png',512),('afyllx-icon-maskable-512.png',512),('afyllx-apple-touch-icon.png',180),('afyllx-favicon-32.png',32)]:
    # Keep the full mark within the maskable icon's central safe circle.
    mark=logo.copy()
    mark.thumbnail((round(size*.68),round(size*.68)),Image.Resampling.LANCZOS)
    im=Image.new('RGBA',(size,size),'white')
    im.alpha_composite(mark,((size-mark.width)//2,(size-mark.height)//2))
    im.convert('RGB').save(out/name,optimize=True)
print('Generated 5 AFYLLX app/browser icons')
