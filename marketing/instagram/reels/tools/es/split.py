import json, subprocess
words = json.load(open('combined-words.json'))
segs = {'03': (0.0, 31.45), '02': (32.6, 70.6), '04': (71.8, 100.9), '06': (101.9, 133.25), '07': (134.0, 156.53)}
LEAD = 0.25
for n, (a, b) in segs.items():
    start = max(0, a - 0.08)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(start), '-to', str(b + 0.05), '-i', 'combined.mp3', '-af', f'adelay={int(LEAD*1000)}|{int(LEAD*1000)},afade=t=in:d=0.03', '-ar', '48000', f'vo-{n}.wav'], check=True)
    ws = [dict(w, s=round(w['s'] - start + LEAD, 3), e=round(w['e'] - start + LEAD, 3)) for w in words if a - 0.05 <= w['s'] < b]
    json.dump(ws, open(f'words-{n}.json', 'w'), ensure_ascii=False)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f'vo-{n}.wav'], capture_output=True, text=True).stdout)
    print(n, round(dur, 2), ' '.join(f"{w['w']}@{w['s']}" for w in ws)[:2000])
