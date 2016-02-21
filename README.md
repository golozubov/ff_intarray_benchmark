Prerequisites
-------------

- Install postgresql v9.4 or newer
- Install node v4.2.6 

Running
-------------
- Configure postgres connection (username, password): `./knexfile.js`
- Run `createdb ff_test_1`
- Run `psql ff_test_1 < schema.sql`
- Run `npm install` 
- Run `npm start` 
