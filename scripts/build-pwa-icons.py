from pathlib import Path
from PIL import Image
out=Path(__file__).resolve().parents[1]/'public'/'icons'
out.mkdir(parents=True,exist_ok=True)
logo=Image.open(out.parent/'brand'/'afyllx-logo.png').convert('RGBA')
logo=logo.crop(logo.getchannel('A').getbbox())
for name,size in [('icon-192.png',192),('icon-512.png',512),('icon-maskable-512.png',512),('apple-touch-icon.png',180),('favicon-32.png',32)]:
    # Keep the full mark within the maskable icon's central safe circle.
    mark=logo.copy()
    mark.thumbnail((round(size*.68),round(size*.68)),Image.Resampling.LANCZOS)
    im=Image.new('RGBA',(size,size),'white')
    im.alpha_composite(mark,((size-mark.width)//2,(size-mark.height)//2))
    im.convert('RGB').save(out/name,optimize=True)
print('Generated 5 AFYLLX app/browser icons')
