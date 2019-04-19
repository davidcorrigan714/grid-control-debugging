#!/bin/sh

#DNS weirdness in Ubuntu 18.04 - https://github.com/docker/libnetwork/issues/2187
docker run -i --init --rm -p 443:443 -d \
   -e SERVERNAME=azdo-dev.natinst.com \
   --dns `cat /run/systemd/resolve/resolv.conf | grep nameserver | head -n 1 | awk '{print $2}'` \
   --name pmdmconnector pmdmconnector
