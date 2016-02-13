import bluebird from 'bluebird'
import {default as faker} from 'faker'
import {knex} from './db.js'
import {DbCleaner} from './dbCleaner'


global.Promise = bluebird
global.Promise.onPossiblyUnhandledRejection((e) => { throw e; });


async function app() {
  console.time('create 10000 users')
  for(let i = 1; i <= 10000; i++){
    let id = await createRandomUser()
    console.log(id)
  }
  console.timeEnd('create 10000 users')

  /*let res = await knex.select('id').from('users')
  console.log(res)*/

  let res
  let count

  res = await knex('users').count()
  count = res[0].count
  console.log(`Users created: ${count}`)

  res = await knex('feeds').count().where({type: 101})
  count = res[0].count
  console.log(`Private feeds created: ${count}`)

  res = await knex('feeds').count().where({type: 102})
  count = res[0].count
  console.log(`Direct feeds created: ${count}`)

  await DbCleaner.clean()
}

app().then(()=>{
  console.log("finished")
})


async function createRandomUser(){
  let userPayload = getRandomUserPayload()
  let id = await knex('users').returning('id').insert(userPayload)
  return id
}

function getRandomUserPayload(){
  let username      = faker.internet.userName().replace(/_/g, '').replace(/\./g, '') + faker.random.number()
  let screenName    = faker.name.findName()
  let email         = faker.internet.email()
  let passwordHash  = faker.internet.password()

  return {
    username:   username,
    screenname: screenName,
    email:      email,
    pw_hash:    passwordHash
  }
}


