ffmpeg -loglevel verbose -re -i ~/Downloads/Schannel.mp4 -c:v h264 -c:a aac -strict -2 -f flv rtmp://localhost:1935/live2/5a96c693-900a-4412-b02c-f20dc4c15411
# ffmpeg -f video4linux2 -i /dev/video0 -c:v libx264 -an -f flv rtmp://localhost/myapp/stream
