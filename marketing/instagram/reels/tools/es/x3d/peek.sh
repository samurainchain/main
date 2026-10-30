#!/bin/bash
# x3d/peek.sh NN "t1,t2,..." -> x3d/sheet-NN.jpg
n=$1; ts=$2
node render.cjs stage-${n}x.html $ts >/dev/null || exit 1
python3 - "$n" "$ts" <<'PY'
import sys
from PIL import Image
n, ts = sys.argv[1], sys.argv[2].split(',')
ims = [Image.open(f'peek-stage-{n}x-{float(t):g}.png').convert('RGB').resize((270, 480)) for t in ts]
cols = min(8, len(ims)); rows = -(-len(ims) // cols)
sheet = Image.new('RGB', (270 * cols, 480 * rows))
for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * 270, (i // cols) * 480))
sheet.save(f'x3d/sheet-{n}.jpg', quality=85)
PY
