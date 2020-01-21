ffmpeg -loglevel verbose -re -i videos/Schannel.mp4 -c:v h264 -c:a aac -strict -2 -f flv rtmp://localhost:1935/live2/6332a39c-c5da-4df7-9319-1454f311ffb1
# ffmpeg -f video4linux2 -i /dev/video0 -c:v libx264 -an -f flv rtmp://localhost/myapp/stream
