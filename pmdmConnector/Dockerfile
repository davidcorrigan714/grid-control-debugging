############################################################
# Dockerfile to build Flask App
# Based on https://github.com/Craicerjack/apache-flask/blob/master/Dockerfile
############################################################

# Set the base image
FROM debian:latest

RUN apt-get update && apt-get install -y apache2 \
    libapache2-mod-wsgi-py3 \
    build-essential \
    python3 \
    python3-dev\
    python3-pip \
    vim \
	nano \
 && apt-get clean \
 && apt-get autoremove \
 && rm -rf /var/lib/apt/lists/*

# Copy over and install the requirements
COPY ./requirements.txt /var/www/apache-flask/app/requirements.txt
RUN pip3 install -r /var/www/apache-flask/app/requirements.txt

# Copy over the apache configuration file and enable the site
COPY ./apache-flask.conf /etc/apache2/sites-available/apache-flask.conf
RUN a2ensite apache-flask
RUN a2enmod headers
RUN a2enmod ssl

# Copy over the wsgi file
COPY ./apache-flask.wsgi /var/www/apache-flask/apache-flask.wsgi

RUN mkdir /var/certs/

COPY ./cert /var/certs

COPY ./pmdmConnector.py /var/www/apache-flask/pmdmConnector.py
#COPY ./app /var/www/apache-flask/app/

RUN a2dissite 000-default.conf
RUN a2ensite apache-flask.conf

EXPOSE 443

WORKDIR /var/www/apache-flask

# CMD ["/bin/bash"]
CMD  /usr/sbin/apache2ctl -D FOREGROUND
# The commands below get apache running but there are issues accessing it online
# The port is only available if you go to another port first
# ENTRYPOINT ["/sbin/init"]
# CMD ["/usr/sbin/apache2ctl"]
