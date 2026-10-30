#!/bin/bash
# x3d/finish.sh NN cover_time  -> tiltless-es-NN-3d.mp4 and cover-es-NN-3d.jpg
set -e
n=$1; ct=$2
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 mix-$n.wav)
../wenv/bin/python x3d/sfx2.py x3d/sfx-$n.json x3d/sfx-$n.wav $dur
ffmpeg -y -v error -i mix-$n.wav -i x3d/sfx-$n.wav -filter_complex "[1:a]volume=0.9[s];[0:a][s]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[a]" -map "[a]" -ar 48000 x3d/mix-${n}x.wav
ffmpeg -y -v error -framerate 60 -i x3d/frames-$n/%05d.jpg -i x3d/mix-${n}x.wav -vf "tmix=frames=2:weights='1 1',fps=30,vignette=PI/5,noise=alls=3:allf=t" -c:v libx264 -preset slow -crf 20 -maxrate 12M -bufsize 24M -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart tiltless-es-$n-3d.mp4
ffmpeg -y -v error -ss $ct -i tiltless-es-$n-3d.mp4 -frames:v 1 -q:v 2 cover-es-$n-3d.jpg
ls -la tiltless-es-$n-3d.mp4; ffprobe -v error -show_entries format=duration -of csv=p=0 tiltless-es-$n-3d.mp4
