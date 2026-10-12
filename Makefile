# Local development. Needs Docker, Go and Node (see README.md). GNU make 3.81 or newer.
SHELL = /bin/sh
.PHONY: db

db:
	docker compose -f $(CURDIR)/deploy/docker-compose.yml up -d --wait postgres
