ffmpeg -loglevel verbose -re -i ~/Downloads/Schannel.mp4 -c:v h264 -c:a aac -strict -2 -f flv rtmp://localhost:1935/live2/a90634f9-3a6d-41e8-8fca-014aac100e11
# ffmpeg -f video4linux2 -i /dev/video0 -c:v libx264 -an -f flv rtmp://localhost/myapp/stream
