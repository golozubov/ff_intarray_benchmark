import bluebird from 'bluebird'
import {default as faker} from 'faker'
import {knex} from './db.js'
import {DbCleaner} from './dbCleaner'


global.Promise = bluebird
global.Promise.onPossiblyUnhandledRejection((e) => { throw e; });


async function app() {
  let username      = faker.internet.userName().replace(/_/g, '').replace(/\./g, '')
  let screenName    = faker.name.findName()
  let email         = faker.internet.email()
  let passwordHash  = faker.internet.password()
  let id = await knex('users').returning('id').insert({
    username:   username,
    screenname: screenName,
    email:      email,
    pw_hash:    passwordHash
  })

  console.log(id)

  let res = await knex.select('id').from('users')
  console.log(res)
  await DbCleaner.clean()
}

app().then(()=>{
  console.log("finished")
})



