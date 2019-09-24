ffmpeg -loglevel verbose -re -i ~/Downloads/THPT2019.mp4 -c:v h264 -c:a aac -strict -2 -f flv rtmp://localhost:1935/live2/6371b1f6-6c49-449a-aee4-42a3c791e446
# ffmpeg -f video4linux2 -i /dev/video0 -c:v libx264 -an -f flv rtmp://localhost/myapp/stream
