#!/bin/sh

#DNS weirdness line is for in Ubuntu 18.04 - https://github.com/docker/libnetwork/issues/2187

docker run -i --init --rm --cap-add=SYS_ADMIN \
   -e AZDO_USER_EMAIL=email@ni.com -e AZDO_USER_PWD=password \
   --dns `cat /run/systemd/resolve/resolv.conf | grep nameserver | head -n 1 | awk '{print $2}'` \
   --name puppeteer-chrome pmdmupdater \
   node -e "`cat update.js`"

