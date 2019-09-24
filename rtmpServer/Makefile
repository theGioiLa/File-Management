SERVICE_DIR = services
TRANSMISSION_SV = node $(SERVICE_DIR)/transmission.js > logs/services/transmission
reload:
	sudo nginx -c nginx.conf -p . -s reload 

start:
	sudo nginx -c nginx.conf -p . 

quit:
	sudo nginx -c nginx.conf -p . -s quit 
