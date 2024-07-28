# WHAT is rest2redis?

This container will update Redis values everytime data is received via a API call.

# REDIS Configuration

You can define REDIS connection via env variables like so:
```
REDIS_HOST_PORT=localhost:6379
REDIS_USER=
REDIS_PASS=
REDIS_PREFIX=rest2redis
REDIS_DB=10
```
The values listed are default so you can only use the env variable if you want to change it.
`REDIS_HOST_PORT` takes user name and password too as `redis://user:pass@server:port`.
`REDIS_PREFIX` defines the prefix that is appended to the path before it is saved to Redis database.

# API calls

API call structure:
```
http[s]://domain.com/{CMD}/{PATH}
```
`{CMD}` is redis command used to save data, only `set` and `publish` are supported atm.
`{PATH}` is the the ID used together with `REDIS_PREFIX` env variable that defines where the data will be saved too.

# Docker

Start your container with this command replacing values to match your system:
```
docker run --name rest2redis -e REDIS_HOST_PORT=localhost:6379 -e REDIS_PASS=1337 -e REDIS_DB=10 -d rmamba/rest2redis
```
