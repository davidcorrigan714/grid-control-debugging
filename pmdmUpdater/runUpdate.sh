#!/bin/sh


#docker run -d --rm -e AZDO_USER_EMAIL=productadmin@ni.com -e AZDO_ADMIN_PWD pmdmupdater

#DNS weirdness in Ubuntu 18.04 - https://github.com/docker/libnetwork/issues/2187
 docker run -d --rm  -e AZDO_USER_EMAIL=productadmin@ni.com -e AZDO_ADMIN_PWD=pmdmUpdater --dns `cat /run/systemd/resolve/resolv.conf | grep nameserver | head -n 1 | awk '{print $2}'` pmdmupdater