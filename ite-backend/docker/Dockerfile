FROM postgres:16-alpine

ENV POSTGRES_USER=ite_user
ENV POSTGRES_PASSWORD=ite_password
ENV POSTGRES_DB=ite_db

COPY init.sql /docker-entrypoint-initdb.d/

EXPOSE 5432
