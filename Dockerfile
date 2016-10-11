FROM mhart/alpine-node-auto:latest
MAINTAINER jim@bamboocando.com

RUN mkdir /Stagapp-master && apk update
RUN apk add curl
VOLUME /Stagapp-master/public
ADD package.json /Stagapp-master
WORKDIR /Stagapp-master
RUN npm install
ADD . /Stagapp-master
#RUN curl -LOu jahbini:Tqbfj0tlD https://github.com/jahbini/Stagserv/archive/master.zip && unzip master.zip && rm master.zip

CMD sleep 1000
