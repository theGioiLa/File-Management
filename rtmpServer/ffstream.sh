ffmpeg -loglevel verbose -re -i ~/Downloads/Schannel.mp4 -c:v h264 -c:a aac -strict -2 -f flv rtmp://localhost:1935/live2/59ba7eee-af8f-44d6-8eba-db8569d7dda7
# ffmpeg -f video4linux2 -i /dev/video0 -c:v libx264 -an -f flv rtmp://localhost/myapp/stream
