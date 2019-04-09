#!/bin/sh

#DNS weirdness in Ubuntu 18.04 - https://github.com/docker/libnetwork/issues/2187
docker run -i --init --rm --cap-add=SYS_ADMIN \
   -e AZDO_USER_EMAIL=productadmin@ni.com -e AZDO_USER_PWD=mypassword \
   --dns `cat /run/systemd/resolve/resolv.conf | grep nameserver | head -n 1 | awk '{print $2}'` \
   --name pmdmupdater pmdmupdater
