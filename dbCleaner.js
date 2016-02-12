import {knex} from './db.js'

export class DbCleaner{
  static async clean(){
    const tableNames = [
      'aggregates',
      'comments',
      'feed_posts',
      'feed_readers',
      'feed_writers',
      'feeds',
      'files',
      'likes',
      'local_bumps',
      'post_attachments',
      'posts',
      'users'
    ]

    let promises = tableNames.map((name)=>{
      //knex(name).truncate()
      return knex.raw(`truncate ${name} restart identity cascade`)
    })

    await Promise.all(promises)
  }
}
