import {knex} from './db.js'

export class DbCleaner{
  static async clean(){
    const tableNames = [
      'feeds',
      'posts',
      'users'
    ]

    const indexNames = [
      "posts_feed_ids_idx",
      "posts_is_public_idx",
      "users_private_feed_ids_idx",
      "users_subscr_feed_ids_idx",
      "feeds_is_public_idx",
      "feeds_type_idx"
    ]

    let promises = tableNames.map((name)=>{
      //knex(name).truncate()
      return knex.raw(`truncate ${name} restart identity cascade`)
    })

    promises = promises.concat(indexNames.map((name)=>{
      return knex.raw(`DROP INDEX IF EXISTS ${name}`)
    }))

    await Promise.all(promises)
  }
}
