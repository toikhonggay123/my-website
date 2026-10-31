from pathlib import Path
from PIL import Image, ImageDraw
out=Path(__file__).resolve().parents[1]/'public'/'icons'
out.mkdir(parents=True,exist_ok=True)
for name,size in [('icon-192.png',192),('icon-512.png',512),('icon-maskable-512.png',512),('apple-touch-icon.png',180)]:
    scale=4
    im=Image.new('RGB',(size*scale,size*scale),'#3264e6')
    d=ImageDraw.Draw(im)
    def points(coords):return [(round(x*size*scale),round(y*size*scale)) for x,y in coords]
    def line(coords,width):d.line(points(coords),fill='white',width=round(width*size*scale),joint='curve')
    # Code-native mark: fork + attendance check, safely inside the maskable icon circle.
    for x in [.30,.37,.44]:line([(x,.27),(x,.45)],.027)
    line([(.30,.43),(.30,.48),(.37,.52),(.44,.48),(.44,.43)],.029)
    line([(.37,.51),(.37,.73)],.035)
    line([(.52,.53),(.60,.62),(.76,.38)],.05)
    im.resize((size,size),Image.Resampling.LANCZOS).save(out/name,optimize=True)
print('Generated 4 PWA icons')
