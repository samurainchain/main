import sys
from PIL import Image
name, ts = sys.argv[1], sys.argv[2].split(',')
ims = [Image.open(f'peek-stage-{name}-{t}.png').resize((300, 533)) for t in ts]
s = Image.new('RGB', (305 * len(ims), 533), 'white')
for i, im in enumerate(ims): s.paste(im, (i * 305, 0))
s.save(f'sheet-{name}.png')
