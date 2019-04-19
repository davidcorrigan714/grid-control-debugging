#!/bin/sh

#DNS weirdness in Ubuntu 18.04 - https://github.com/docker/libnetwork/issues/2187
docker run -d -i --init --rm
   --dns `cat /run/systemd/resolve/resolv.conf | grep nameserver | head -n 1 | awk '{print $2}'` \
   --name pmdmConnector pmdmConnector
